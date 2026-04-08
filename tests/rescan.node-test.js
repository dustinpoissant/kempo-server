import http from 'http';
import {withTestDir} from './utils/test-dir.js';
import {write} from './utils/file-writer.js';
import {randomPort} from './utils/port.js';
import {httpGet} from './utils/http.js';
import router from '../src/router.js';
import rescan from '../src/rescan.js';

export default {
  'rescan() triggers file rescan and returns file count': async ({pass, fail}) => {
    await withTestDir(async dir => {
      const prev = process.cwd();
      process.chdir(dir);
      const flags = {root: '.', logging: 0};
      const logFn = () => {};

      await write(dir, '.config.json', JSON.stringify({
        maxRescanAttempts: 0
      }));
      await write(dir, 'index.html', '<h1>Home</h1>');

      const handler = await router(flags, logFn);
      const server = http.createServer(handler);
      const port = randomPort();
      await new Promise(r => server.listen(port, r));
      await new Promise(r => setTimeout(r, 50));

      const miss = await httpGet(`http://localhost:${port}/added.html`);
      if(miss.res.statusCode !== 404) {
        server.close();
        process.chdir(prev);
        return fail('should 404 before file exists');
      }

      await write(dir, 'added.html', '<h1>Added</h1>');

      const stillMiss = await httpGet(`http://localhost:${port}/added.html`);
      if(stillMiss.res.statusCode !== 404) {
        server.close();
        process.chdir(prev);
        return fail('should still 404 with maxRescanAttempts=0');
      }

      const count = await rescan();
      if(typeof count !== 'number' || count < 2) {
        server.close();
        process.chdir(prev);
        return fail(`rescan should return file count, got: ${count}`);
      }

      const hit = await httpGet(`http://localhost:${port}/added.html`);
      if(hit.res.statusCode !== 200) {
        server.close();
        process.chdir(prev);
        return fail('should serve file after rescan()');
      }

      if(!hit.body.toString().includes('Added')) {
        server.close();
        process.chdir(prev);
        return fail('should serve correct content after rescan');
      }

      server.close();
      process.chdir(prev);
    });
    pass('rescan() works from imported function');
  },
};
