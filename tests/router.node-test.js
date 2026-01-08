import http from 'http';
import path from 'path';
import {withTestDir} from './utils/test-dir.js';
import {write} from './utils/file-writer.js';
import {randomPort} from './utils/port.js';
import {httpGet} from './utils/http.js';
import {log} from './utils/logging.js';
import router from '../src/router.js';
import defaultConfig from '../src/defaultConfig.js';

export default {
  'serves static files and 404s unknown': async ({pass, fail}) => {
    await withTestDir(async (dir) => {
      const prev = process.cwd();
      process.chdir(dir);
      const flags = {root: '.', logging: 0};
      const logFn = () => {};
      const handler = await router(flags, logFn);
      const server = http.createServer(handler);
      const port = randomPort();
      await new Promise(r => server.listen(port, r));
      await new Promise(r => setTimeout(r, 50));
      
      const ok = await httpGet(`http://localhost:${port}/index.html`);
      if(ok.res.statusCode !== 200) {
        server.close();
        process.chdir(prev);
        return fail('static 200');
      }
      
      const miss = await httpGet(`http://localhost:${port}/nope`);
      if(miss.res.statusCode !== 404) {
        server.close();
        process.chdir(prev);
        return fail('404');
      }
      
      server.close();
      process.chdir(prev);
    });
    pass('static + 404');
  },
  'rescan on 404 when enabled and not blacklisted': async ({pass, fail}) => {
    await withTestDir(async (dir) => {
      const prev = process.cwd();
      process.chdir(dir);
      const flags = {root: '.', logging: 0};
      const handler = await router(flags, log);
      const server = http.createServer(handler);
      const port = randomPort();
      await new Promise(r => server.listen(port, r));
      await new Promise(r => setTimeout(r, 50));
      
      const miss1 = await httpGet(`http://localhost:${port}/late.html`);
      if(miss1.res.statusCode !== 404) {
        server.close();
        process.chdir(prev);
        return fail('first 404');
      }
      
      // File already exists, should be found on rescan
      const hit = await httpGet(`http://localhost:${port}/late.html`);
      if(hit.res.statusCode !== 200) {
        server.close();
        process.chdir(prev);
        return fail('served after rescan');
      }
      
      server.close();
      process.chdir(prev);
    });
    pass('rescan');
  },
  'custom and wildcard routes serve mapped files': async ({pass, fail}) => {
    await withTestDir(async (dir) => {
      const fileA = path.join(dir, 'a.txt');
      const fileB = path.join(dir, 'b/1.txt');
      const prev = process.cwd();
      process.chdir(dir);
      const flags = {root: '.', logging: 0};
      const logFn = () => {};
      // write config before init
      await write(dir, '.config.json', JSON.stringify({
        customRoutes: {'/a': fileA, 'b/*': path.join(dir, 'b/*')}
      }));
      const handler = await router(flags, logFn);
      const server = http.createServer(handler);
      const port = randomPort();
      await new Promise(r => server.listen(port, r));
      await new Promise(r => setTimeout(r, 50));
      
      const r1 = await httpGet(`http://localhost:${port}/a`);
      if(r1.body.toString() !== 'A') {
        server.close();
        process.chdir(prev);
        return fail('custom route');
      }
      
      const r2 = await httpGet(`http://localhost:${port}/b/1.txt`);
      if(r2.body.toString() !== 'B1') {
        server.close();
        process.chdir(prev);
        return fail('wildcard');
      }
      
      server.close();
      process.chdir(prev);
    });
    pass('custom+wildcard');
  },

  'handles malformed URLs gracefully': async ({pass, fail, log}) => {
    await withTestDir(async (dir) => {
      const prev = process.cwd();
      process.chdir(dir);
      const flags = {root: '.', logging: 0};
      const logFn = () => {};
      const handler = await router(flags, logFn);
      const server = http.createServer(handler);
      const port = randomPort();
      await new Promise(r => server.listen(port, r));
      await new Promise(r => setTimeout(r, 50));
      
      try {
        // Test various malformed URLs that could cause decodeURIComponent to throw
        const malformedUrls = [
          '/test%',        // Incomplete percent encoding
          '/test%2',       // Incomplete percent encoding 
          '/test%G1',      // Invalid hex characters
          '/test%ZZ',      // Invalid hex characters
          '/test%1G',      // Invalid hex characters
          '/%E0%A4%A',     // Incomplete UTF-8 sequence
          '/%C0%80'        // Overlong UTF-8 encoding
        ];
        
        for (const url of malformedUrls) {
          log(`Testing malformed URL: ${url}`);
          const response = await httpGet(`http://localhost:${port}${url}`);
          // Server should handle the request gracefully (return 404 or serve content)
          // and not crash with URIError
          if (response.res.statusCode !== 404 && response.res.statusCode !== 200) {
            throw new Error(`Unexpected status code ${response.res.statusCode} for URL ${url}`);
          }
          log(`URL ${url} handled gracefully with status ${response.res.statusCode}`);
        }
        
        server.close();
        process.chdir(prev);
        pass('malformed URLs handled gracefully');
      } catch (e) {
        server.close();
        process.chdir(prev);
        fail(`Error handling malformed URL: ${e.message}`);
      }
    });
  }
};
