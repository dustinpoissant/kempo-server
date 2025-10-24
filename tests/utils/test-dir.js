import {mkdtemp, rm, cp} from 'fs/promises';
import os from 'os';
import path from 'path';
import {fileURLToPath} from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_SERVER_ROOT = path.join(__dirname, '..', 'test-server-root');

export const withTestDir = async (fn, {subdir = null} = {}) => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'kempo-tests-'));
  try {
    // Copy the test server root to the temporary directory
    await cp(TEST_SERVER_ROOT, tempDir, {recursive: true});
    let workingDir = tempDir;
    
    if (subdir) {
      workingDir = path.join(tempDir, subdir);
    }
    
    return await fn(workingDir);
  } finally {
    await rm(tempDir, {recursive: true, force: true});
  }
};