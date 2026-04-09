#!/usr/bin/env node
import { readFile } from 'fs/promises';
import { join, resolve, dirname } from 'path';
import { pathToFileURL, fileURLToPath } from 'url';
import { renderDir } from './templating/index.js';

const args = process.argv.slice(2);
const inputDir = args[0];

if(!inputDir){
  console.error('Usage: kempo-render <inputDir> [outputDir] [stateFile]');
  process.exit(1);
}

const outputDir = args[1] || inputDir;
const stateFile = args[2];
const resolvedInput = resolve(inputDir);
const resolvedOutput = resolve(outputDir);

let globals = {};
let state = {};
let maxDepth = 10;

const loadConfig = async dir => {
  const jsPath = join(dir, '.config.js');
  try {
    const mod = await import(pathToFileURL(jsPath).href);
    return mod.default;
  } catch(e){
    try {
      const json = await readFile(join(dir, '.config.json'), 'utf8');
      return JSON.parse(json);
    } catch(e2){
      return null;
    }
  }
};

const config = await loadConfig(resolvedInput);
if(config?.templating){
  globals = config.templating.globals || {};
  state = config.templating.state || {};
  maxDepth = config.templating.maxFragmentDepth || 10;
}

if(stateFile){
  const resolvedState = resolve(stateFile);
  if(resolvedState.endsWith('.js')){
    const mod = await import(pathToFileURL(resolvedState).href);
    state = {...state, ...mod.default};
  } else {
    const json = await readFile(resolvedState, 'utf8');
    state = {...state, ...JSON.parse(json)};
  }
}

const count = await renderDir(resolvedInput, resolvedOutput, globals, state, maxDepth);
console.log(`Rendered ${count} page${count !== 1 ? 's' : ''}`);
