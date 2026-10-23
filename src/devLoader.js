import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

/*
  The loader behind `dev.reload` (see devReload.js). It runs on its own thread and gives every file the app imports a
  version in its URL, so the module is loaded again when the version changes: Node keeps one copy of a module per URL
  and has no way to forget it. The version goes up when devReload.js says a file changed.
*/
let generation = 0;
let ignored = new Set();
const names = new Map();

/*
  The name of the package a file belongs to (the nearest package.json), remembered by folder. A package that is left
  alone keeps its one copy: kempo's own modules hold the database connection and the hook registry, and starting a
  second copy of those would lose what was registered in the first.
*/
const packageOf = file => {
  const visited = [];
  let dir = path.dirname(file);
  let name = '';
  while(true){
    if(names.has(dir)){
      name = names.get(dir);
      break;
    }
    visited.push(dir);
    try {
      name = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8')).name ?? '';
      break;
    } catch {
      const parent = path.dirname(dir);
      if(parent === dir) break;
      dir = parent;
    }
  }
  visited.forEach(folder => names.set(folder, name));
  return name;
};

export const initialize = ({ port, ignore }) => {
  ignored = new Set(ignore);
  port.on('message', () => { generation++; });
  port.unref();
};

export const resolve = async (specifier, context, nextResolve) => {
  const result = await nextResolve(specifier, context);
  if(!result.url.startsWith('file:') || result.url.includes('?') || result.url.includes('/node_modules/')) return result;
  if(ignored.has(packageOf(fileURLToPath(result.url)))) return result;
  return { ...result, url: `${result.url}?dev=${generation}` };
};
