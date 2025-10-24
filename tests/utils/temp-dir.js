import {mkdtemp, rm} from 'fs/promises';
import os from 'os';
import path from 'path';

export const withTempDir = async (fn) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'kempo-tests-'));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, {recursive: true, force: true});
  }
};