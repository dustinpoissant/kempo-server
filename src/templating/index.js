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
  resolveFragmentTags
} from './parse.js';
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
  Render a Single Page (internal — accepts explicit resolveDir)
*/
const renderPageCore = async (pageFilePath, rootDir, resolveDir, globals = {}, state = {}, maxDepth = 10, preloadedGlobalContent = null, extraGlobalDirs = []) => {
  const pageContent = await readFile(pageFilePath, 'utf8');
  const pageTagMatch = pageContent.match(/^[\s\S]*?<page((?:[^>"']|"[^"]*"|'[^']*')*)>/);
  if(!pageTagMatch) throw new Error(`Invalid page file: missing <page> root element in ${pageFilePath}`);
  const pageAttrs = extractAttrs(pageTagMatch[1]);
  const templateName = pageAttrs.template || 'default';
  delete pageAttrs.template;

  let templateFile = findFileUpSync(`${templateName}.template.html`, resolveDir, rootDir);

  // If the specified template is not found, fall back to default.template.html
  if(!templateFile && templateName !== 'default'){
    templateFile = findFileUpSync('default.template.html', resolveDir, rootDir);
  }

  if(!templateFile) throw new Error(`Template not found: ${templateName}.template.html or default.template.html (searched from ${resolveDir} to ${rootDir})`);

  const globalContent = preloadedGlobalContent ?? await loadGlobalContent(rootDir, extraGlobalDirs);
  const rawPageBlocks = extractContentBlocks(pageContent);

  // Allow <location> tags inside page content blocks to be filled by global content
  const pageBlocks = {};
  for(const [name, entries] of Object.entries(rawPageBlocks)){
    pageBlocks[name] = entries.map(e => ({...e, html: replaceLocations(e.html, globalContent)}));
  }

  const contentBlocks = mergeContentBlocks(pageBlocks, globalContent);
  let templateHtml = readFileSync(templateFile, 'utf8');

  const findFragmentFile = name => {
    const filePath = findFileUpSync(name + '.fragment.html', resolveDir, rootDir);
    if(!filePath) return null;
    return readFileSync(filePath, 'utf8');
  };

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
const renderExternalPage = (pageFilePath, rootDir, resolveDir, globals = {}, state = {}, maxDepth = 10, extraGlobalDirs = []) =>
  renderPageCore(pageFilePath, rootDir, resolveDir, globals, state, maxDepth, null, extraGlobalDirs);

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
