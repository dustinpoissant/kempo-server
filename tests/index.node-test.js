import {startNode, randomPort, httpGet, withTestDir, write} from './test-utils.js';
import path from 'path';

export default {
  'index.js CLI starts server and serves root': async ({pass, fail}) => {
    await withTestDir(async (dir) => {
      // Create custom index.html for this test
      await write(dir, 'index.html', 'home');
      const port = randomPort();
      const args = [path.join(process.cwd(), 'dist/index.js'), '-r', '.', '-p', String(port), '-l', '0'];
      const child = await startNode(args, {cwd: dir});
      // wait briefly for server to start
      await new Promise(r => setTimeout(r, 400));
      const {res, body} = await httpGet(`http://localhost:${port}/index.html`);
      
      if(res.statusCode !== 200) {
        child.kill();
        return fail('server running');
      }
      
      if(body.toString() !== 'home') {
        child.kill();
        return fail('served');
      }
      
      child.kill();
      await new Promise(r => setTimeout(r, 50));
    });
    
    pass('cli');
  }
};
