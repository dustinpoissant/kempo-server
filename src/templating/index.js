import { readFile, writeFile, mkdir, readdir } from 'fs/promises';
import path from 'path';
import {
  extractAttrs,
  extractContentBlocks,
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
  Render a Single Page
*/
const renderPage = async (pageFilePath, rootDir, globals = {}, state = {}, maxDepth = 10) => {
  const pageContent = await readFile(pageFilePath, 'utf8');
  const pageTagMatch = pageContent.match(/^[\s\S]*?<page\s([^>]*)>/);
  if(!pageTagMatch) throw new Error(`Invalid page file: missing <page> root element in ${pageFilePath}`);
  const pageAttrs = extractAttrs(pageTagMatch[1]);
  const templateName = pageAttrs.template || 'default';
  delete pageAttrs.template;

  const contentBlocks = extractContentBlocks(pageContent);
  const pageDir = path.dirname(pageFilePath);
  const templateFile = findFileUpSync(`${templateName}.template.html`, pageDir, rootDir);
  if(!templateFile) throw new Error(`Template not found: ${templateName}.template.html (searched from ${pageDir} to ${rootDir})`);

  let templateHtml = readFileSync(templateFile, 'utf8');

  const findFragmentFile = name => {
    const filePath = findFileUpSync(name + '.fragment.html', pageDir, rootDir);
    if(!filePath) return null;
    return readFileSync(filePath, 'utf8');
  };

  templateHtml = resolveFragmentTags(templateHtml, findFragmentFile, 0, maxDepth);
  templateHtml = replaceLocations(templateHtml, contentBlocks);

  const rel = path.relative(rootDir, path.dirname(pageFilePath));
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
  const pages = await walkPages(inputDir);
  let count = 0;
  for(const page of pages){
    const rel = path.relative(inputDir, page);
    const outRel = rel.replace(/\.page\.html$/, '.html');
    const outPath = path.join(outputDir, outRel);
    await mkdir(path.dirname(outPath), {recursive: true});
    const html = await renderPage(page, inputDir, globals, state, maxDepth);
    await writeFile(outPath, html, 'utf8');
    count++;
  }
  return count;
};

export { renderPage, renderDir };
