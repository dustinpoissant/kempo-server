import {startNode, expect, randomPort, httpGet, withTempDir, write} from './test-utils.js';
import path from 'path';

export default {
  'index.js CLI starts server and serves root': async ({pass, fail}) => {
    try {
      await withTempDir(async (dir) => {
  await write(dir, 'index.html', 'home');
  const port = randomPort();
  const args = [path.join(process.cwd(), 'index.js'), '-r', '.', '-p', String(port), '-l', '0'];
  const child = await startNode(args, {cwd: dir});
  // wait briefly for server to start
  await new Promise(r => setTimeout(r, 400));
        const {res, body} = await httpGet(`http://localhost:${port}/index.html`);
        expect(res.statusCode === 200, 'server running');
        expect(body.toString() === 'home', 'served');
  child.kill();
  await new Promise(r => setTimeout(r, 50));
      });
      pass('cli');
    } catch(e){ fail(e.message); }
  }
};
