import { readFile } from 'fs/promises';
import { pathToFileURL } from 'url';
import path from 'path';

/*
  A config file can build on another: `"extends": ".config.json"` (a path from the config's own folder) starts from that
  file and changes only what this one says. Objects are merged key by key, and anything else (a list, a string, a
  number) replaces what the base had. A chain of files works, and a file that extends itself is refused.
*/
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

const merge = (base, over) => {
  const merged = { ...base };
  for(const [key, value] of Object.entries(over)) merged[key] = isObject(value) && isObject(base[key]) ? merge(base[key], value) : value;
  return merged;
};

const load = async file => {
  if(file.endsWith('.js')) return (await import(pathToFileURL(file).href + `?t=${Date.now()}`)).default;
  return JSON.parse(await readFile(file, 'utf8'));
};

const extend = async (userConfig, file, seen) => {
  if(!userConfig?.extends) return userConfig;
  const { extends: baseName, ...own } = userConfig;
  const basePath = path.resolve(path.dirname(file), baseName);
  if(seen.includes(basePath)) throw new Error(`Config files extend each other in a loop: ${[...seen, basePath].join(' -> ')}`);
  const base = await extend(await load(basePath), basePath, [...seen, basePath]);
  return merge(base ?? {}, own);
};

export default (userConfig, file) => extend(userConfig, file, [path.resolve(file)]);
