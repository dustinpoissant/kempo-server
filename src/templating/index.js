import { readFile, writeFile, mkdir, readdir } from 'fs/promises';
import path from 'path';
import {
  extractAttrs,
  extractContentBlocks,
  mergeContentBlocks,
  replaceLocations,
  resolveVars,
  resolveIfs,
  resolveForeach,
  resolveFragmentTags,
  fragmentPriority
} from './parse.js';
import { extractPatchOps, applyPatchOps } from './patch.js';
import { readFileSync, statSync } from 'fs';

/*
  Synchronous File Lookup — walk up from startDir to rootDir
*/
const findFileUpSync = (filename, startDir, rootDir) => {
  let dir = startDir;
  const root = path.resolve(rootDir);
  while(true){
    const candidate = path.join(dir, filename);
    try {
      statSync(candidate);
      return candidate;
    } catch(e){ /* not found */ }
    if(path.resolve(dir) === root) return null;
    const parent = path.dirname(dir);
    if(parent === dir) return null;
    dir = parent;
  }
};

const loadVersion = rootDir => {
  try {
    return JSON.parse(readFileSync(path.join(rootDir, 'package.json'), 'utf8')).version || '';
  } catch(e){
    return '';
  }
};

/*
  Walk Directory for *.global.html Files
*/
const walkGlobals = async dir => {
  let entries;
  try {
    entries = await readdir(dir, {withFileTypes: true});
  } catch {
    // Extra global dirs are optional — a package that ships no globals is the common case
    return [];
  }
  const results = [];
  for(const entry of entries){
    const full = path.join(dir, entry.name);
    if(entry.isDirectory()){
      results.push(...await walkGlobals(full));
    } else if(entry.name.endsWith('.global.html')){
      results.push(full);
    }
  }
  return results;
};

/*
  Collects *.global.html from rootDir plus any extraGlobalDirs. Extra dirs let a host scan
  global content that lives outside rootDir — e.g. plugin packages contributing content to a
  render whose root is the host's own directory. Later dirs merge over earlier ones, and
  mergeContentBlocks still applies each entry's priority within a location.
*/
const loadGlobalContent = async (rootDir, extraGlobalDirs = []) => {
  const dirs = [rootDir, ...extraGlobalDirs];
  const files = (await Promise.all(dirs.map(walkGlobals))).flat();
  const maps = await Promise.all(files.map(async f => extractContentBlocks(await readFile(f, 'utf8'))));
  return mergeContentBlocks(...maps);
};

/*
  Walk Directory for *.fragment.html Files
*/
const walkFragments = async dir => {
  let entries;
  try {
    entries = await readdir(dir, {withFileTypes: true});
  } catch {
    // Extra fragment dirs are optional — a package that ships no fragments is the common case
    return [];
  }
  const results = [];
  for(const entry of entries){
    const full = path.join(dir, entry.name);
    if(entry.isDirectory()){
      results.push(...await walkFragments(full));
    } else if(entry.name.endsWith('.fragment.html')){
      results.push(full);
    }
  }
  return results;
};

/*
  Collects *.fragment.html from extraFragmentDirs into a name -> markup map, once per render rather
  than once per <fragment> tag: a page with many tags and a host with many plugin dirs would
  otherwise re-walk every directory for every tag.

  Where global content merges every contribution into a location, a <fragment> tag inserts exactly
  one thing, so same-named files compete instead of combining and only the winner is kept. Highest
  `priority` wins; ties keep the earliest, making the caller's dir order the tiebreaker rather than
  filesystem enumeration order.
*/
const loadExtraFragments = async (extraFragmentDirs = []) => {
  const winners = new Map();
  for(const dir of extraFragmentDirs){
    const files = await walkFragments(dir);
    // Shallowest first, then alphabetical, so collisions inside one dir resolve the same way twice
    files.sort((a, b) => {
      const depth = a.split(path.sep).length - b.split(path.sep).length;
      return depth !== 0 ? depth : a.localeCompare(b);
    });
    for(const file of files){
      const name = path.basename(file).slice(0, -'.fragment.html'.length);
      const markup = await readFile(file, 'utf8');
      const priority = fragmentPriority(markup);
      const current = winners.get(name);
      if(!current || priority > current.priority) winners.set(name, {markup, priority});
    }
  }
  return winners;
};

/*
  Template Patches

  A *.template-patch.html file is not a template. It describes changes to another template — named
  in its own frontmatter — and is applied to that template on every render.

  It exists so a template can build on one it does not own. The alternative, copying the original
  and editing the copy, is what this replaces: a copy is a snapshot, and it stops matching the
  original the moment that original is edited, silently, with nothing to signal the drift. Nor can
  that be patched over by regenerating on change, because the edit is often somebody opening the
  file in an editor, which raises no event at all.

  A patch may do two things, and usually does both:

    <content location="…">   fill a <location> the template deliberately marked
    <replace id="…"> etc.    change an element by id, marked or not

  Filling a location leaves a <location> inside the patch's own content intact, since replaced text
  is not rescanned. That is what lets a patch wrap the page rather than merely replace it:

    template  <body><nav/><location /></body>
    patch     <content><article><location /></article></content>
    composed  <body><nav/><article><location /></article></body>
    page      <body><nav/><article>…page body…</article></body>
*/
const FRONTMATTER = /^\s*<!--([\s\S]*?)-->/;

const parseFrontmatter = raw => {
  const match = raw.match(FRONTMATTER);
  if(!match) return { meta: {}, body: raw };
  const meta = {};
  for(const line of match[1].split('\n')){
    const idx = line.indexOf(':');
    if(idx === -1) continue;
    const key = line.slice(0, idx).trim();
    if(key) meta[key] = line.slice(idx + 1).trim();
  }
  return { meta, body: raw.slice(match[0].length) };
};

const resolveTemplate = (name, find, depth, maxDepth) => {
  if(depth > maxDepth) throw new Error(`Template patch depth exceeded maximum of ${maxDepth} at "${name}"`);

  const templateFile = find(`${name}.template`);
  if(templateFile) return readFileSync(templateFile, 'utf8');

  const patchFile = find(`${name}.template-patch`);
  if(!patchFile) return null;

  const { meta, body } = parseFrontmatter(readFileSync(patchFile, 'utf8'));
  const parentName = meta.extends;
  if(!parentName) throw new Error(`${patchFile} has no "extends" in its frontmatter — a patch must name the template it applies to`);
  if(parentName === name) throw new Error(`${patchFile} extends itself`);

  const parentHtml = resolveTemplate(parentName, find, depth + 1, maxDepth);
  if(parentHtml === null) throw new Error(`Template not found: ${parentName}, extended by ${patchFile}`);

  // Locations the patch does not fill stay open for the page and for global content
  const filled = replaceLocations(parentHtml, extractContentBlocks(body), true);

  /*
    Patch operations run after the content blocks, so an id can target markup the patch itself just
    inserted.
  */
  return applyPatchOps(filled, extractPatchOps(body), patchFile);
};

/*
  Render a Single Page (internal — accepts explicit resolveDir)
*/
const renderPageCore = async (pageFilePath, rootDir, resolveDir, globals = {}, state = {}, maxDepth = 10, preloadedGlobalContent = null, extraGlobalDirs = [], extraFragmentDirs = []) => {
  const pageContent = await readFile(pageFilePath, 'utf8');
  const pageTagMatch = pageContent.match(/^[\s\S]*?<page((?:[^>"']|"[^"]*"|'[^']*')*)>/);
  if(!pageTagMatch) throw new Error(`Invalid page file: missing <page> root element in ${pageFilePath}`);
  const pageAttrs = extractAttrs(pageTagMatch[1]);
  const templateName = pageAttrs.template || 'default';
  delete pageAttrs.template;

  /*
    `template="x"` resolves to x.template.html, or to x.template-patch.html if there is no template
    by that name — so a page names what it wants and does not care which of the two provides it.
  */
  const find = stem => findFileUpSync(`${stem}.html`, resolveDir, rootDir);

  let templateHtml = resolveTemplate(templateName, find, 0, maxDepth);

  // If the specified template is not found, fall back to the default one
  if(templateHtml === null && templateName !== 'default'){
    templateHtml = resolveTemplate('default', find, 0, maxDepth);
  }

  if(templateHtml === null) throw new Error(`Template not found: ${templateName}.template.html, ${templateName}.template-patch.html or default.template.html (searched from ${resolveDir} to ${rootDir})`);

  const globalContent = preloadedGlobalContent ?? await loadGlobalContent(rootDir, extraGlobalDirs);
  const rawPageBlocks = extractContentBlocks(pageContent);

  const extraFragments = await loadExtraFragments(extraFragmentDirs);

  /*
    The walk up from resolveDir to rootDir is unchanged and still yields at most one candidate — the
    nearest match — so with no extraFragmentDirs a fragment resolves exactly as it always has,
    including the "a more specific copy shadows a more general one" behaviour walk-up exists for.

    Extra dirs then compete with that match on `priority` alone, never on proximity: an extra dir
    sits outside the directory chain, so there is no distance to compare it by. Highest priority
    wins, and a tie keeps the local file — which is what makes overriding something the site
    already has a deliberate act rather than an accident of which plugin was installed.
  */
  const findFragmentFile = name => {
    const filePath = findFileUpSync(name + '.fragment.html', resolveDir, rootDir);
    const local = filePath ? readFileSync(filePath, 'utf8') : null;
    const extra = extraFragments.get(name);
    if(!extra) return local;
    if(local === null) return extra.markup;
    return extra.priority > fragmentPriority(local) ? extra.markup : local;
  };

  /*
    Page content blocks get the same two passes a template does: <fragment> tags resolved, then
    <location> tags filled from global content. A page asking for a fragment by name is the whole
    point of the pull model, so it cannot be a thing only templates may do.
  */
  const pageBlocks = {};
  for(const [name, entries] of Object.entries(rawPageBlocks)){
    pageBlocks[name] = entries.map(e => ({
      ...e,
      html: replaceLocations(resolveFragmentTags(e.html, findFragmentFile, 0, maxDepth), globalContent)
    }));
  }

  const contentBlocks = mergeContentBlocks(pageBlocks, globalContent);

  templateHtml = resolveFragmentTags(templateHtml, findFragmentFile, 0, maxDepth);
  templateHtml = replaceLocations(templateHtml, contentBlocks);

  const rel = path.relative(rootDir, resolveDir);
  const depth = rel ? rel.split(path.sep).length : 0;
  const now = new Date();

  const vars = {
    pathToRoot: depth > 0 ? '../'.repeat(depth) : './',
    year: String(now.getFullYear()),
    date: now.toISOString().slice(0, 10),
    datetime: now.toISOString(),
    timestamp: String(Date.now()),
    version: loadVersion(rootDir),
    env: process.env.NODE_ENV || '',
    ...globals,
    ...state,
    ...pageAttrs
  };

  // Call function values in globals/state to resolve them
  for(const [key, val] of Object.entries(vars)){
    if(typeof val === 'function') vars[key] = val();
  }

  templateHtml = resolveIfs(templateHtml, vars);
  templateHtml = resolveForeach(templateHtml, vars);
  templateHtml = resolveVars(templateHtml, vars);

  return templateHtml;
};

/*
  Render a Single Page
*/
const renderPage = (pageFilePath, rootDir, globals = {}, state = {}, maxDepth = 10, preloadedGlobalContent = null) =>
  renderPageCore(pageFilePath, rootDir, path.dirname(pageFilePath), globals, state, maxDepth, preloadedGlobalContent);

/*
  Render a Page File That Lives Outside rootDir
*/
const renderExternalPage = (pageFilePath, rootDir, resolveDir, globals = {}, state = {}, maxDepth = 10, extraGlobalDirs = [], extraFragmentDirs = []) =>
  renderPageCore(pageFilePath, rootDir, resolveDir, globals, state, maxDepth, null, extraGlobalDirs, extraFragmentDirs);

/*
  Recursively Walk Directory for *.page.html
*/
const walkPages = async dir => {
  const entries = await readdir(dir, {withFileTypes: true});
  const results = [];
  for(const entry of entries){
    const full = path.join(dir, entry.name);
    if(entry.isDirectory()){
      results.push(...await walkPages(full));
    } else if(entry.name.endsWith('.page.html')){
      results.push(full);
    }
  }
  return results;
};

/*
  Render All Pages in a Directory
*/
const renderDir = async (inputDir, outputDir, globals = {}, state = {}, maxDepth = 10) => {
  const [pages, globalContent] = await Promise.all([walkPages(inputDir), loadGlobalContent(inputDir)]);
  let count = 0;
  for(const page of pages){
    const rel = path.relative(inputDir, page);
    const outRel = rel.replace(/\.page\.html$/, '.html');
    const outPath = path.join(outputDir, outRel);
    await mkdir(path.dirname(outPath), {recursive: true});
    const html = await renderPage(page, inputDir, globals, state, maxDepth, globalContent);
    await writeFile(outPath, html, 'utf8');
    count++;
  }
  return count;
};

const renderPageToString = (pagePath, vars = {}, rootDir = path.dirname(pagePath)) =>
  renderPage(pagePath, rootDir, {}, vars);

export { renderPage, renderDir, renderPageToString, renderExternalPage };
