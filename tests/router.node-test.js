import http from 'http';
import path from 'path';
import {withTempDir, write, expect, randomPort, httpGet, log} from './test-utils.js';
import router from '../router.js';
import defaultConfig from '../defaultConfig.js';

export default {
  'serves static files and 404s unknown': async ({pass, fail, log}) => {
    try {
  await withTempDir(async (dir) => {
    await write(dir, 'index.html', '<h1>Home</h1>');
  const prev = process.cwd();
  process.chdir(dir);
  const flags = {root: '.', logging: 0, scan: false};
  const logFn = () => {};
  const handler = await router(flags, logFn);
  const server = http.createServer(handler);
        const port = randomPort();
  await new Promise(r => server.listen(port, r));
  await new Promise(r => setTimeout(r, 50));
        try {
          const ok = await httpGet(`http://localhost:${port}/index.html`);
          log('ok status: ' + ok.res.statusCode);
          if(ok.res.statusCode !== 200) throw new Error('static 200');
          const miss = await httpGet(`http://localhost:${port}/nope`);
          log('miss status: ' + miss.res.statusCode);
          if(miss.res.statusCode !== 404) throw new Error('404');
        } finally {
          server.close();
      process.chdir(prev);
        }
      });
      pass('static + 404');
    } catch(e){ fail(e.message); }
  },
  'rescan on 404 when enabled and not blacklisted': async ({pass, fail, log}) => {
    try {
  await withTempDir(async (dir) => {
  const prev = process.cwd();
  process.chdir(dir);
  const flags = {root: '.', logging: 0, scan: true};
  const handler = await router(flags, log);
        const server = http.createServer(handler);
        const port = randomPort();
  await new Promise(r => server.listen(port, r));
  await new Promise(r => setTimeout(r, 50));
        try {
          const miss1 = await httpGet(`http://localhost:${port}/late.html`);
          log('first miss: ' + miss1.res.statusCode);
          if(miss1.res.statusCode !== 404) throw new Error('first 404');
          await write(dir, 'late.html', 'later');
          const hit = await httpGet(`http://localhost:${port}/late.html`);
          log('hit after rescan: ' + hit.res.statusCode);
          if(hit.res.statusCode !== 200) throw new Error('served after rescan');
    } finally { server.close(); process.chdir(prev); }
      });
      pass('rescan');
    } catch(e){ fail(e.message); }
  },
  'custom and wildcard routes serve mapped files': async ({pass, fail, log}) => {
    try {
  await withTempDir(async (dir) => {
  const fileA = await write(dir, 'a.txt', 'A');
  const fileB = await write(dir, 'b/1.txt', 'B1');
  const prev = process.cwd();
  process.chdir(dir);
  const flags = {root: '.', logging: 0, scan: false};
  const logFn = () => {};
  // write config before init
  await write(dir, '.config.json', JSON.stringify({customRoutes: {'/a': fileA, 'b/*': path.join(dir, 'b/*')}}));
  const handler = await router(flags, logFn);
  const server = http.createServer(handler);
        const port = randomPort();
  await new Promise(r => server.listen(port, r));
  await new Promise(r => setTimeout(r, 50));
        try {
          const r1 = await httpGet(`http://localhost:${port}/a`);
          log('custom status: ' + r1.res.statusCode);
          if(r1.body.toString() !== 'A') throw new Error('custom route');
          const r2 = await httpGet(`http://localhost:${port}/b/1.txt`);
          log('wildcard status: ' + r2.res.statusCode);
          if(r2.body.toString() !== 'B1') throw new Error('wildcard');
    } finally { server.close(); process.chdir(prev); }
      });
      pass('custom+wildcard');
    } catch(e){ fail(e.message); }
  }
};
