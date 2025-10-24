import {writeFile, mkdir} from 'fs/promises';
import path from 'path';

export const write = async (root, rel, content = '') => {
  const full = path.join(root, rel);
  await mkdir(path.dirname(full), {recursive: true});
  await writeFile(full, content);
  return full;
};