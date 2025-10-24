import path from 'path';
import {fileURLToPath} from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_SERVER_ROOT = path.join(__dirname, '..', 'test-server-root');

export const getTestFilePath = (relativePath) => {
  return path.join(TEST_SERVER_ROOT, relativePath);
};