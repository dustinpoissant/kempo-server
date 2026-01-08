import http from 'http';
import {withTestDir} from './utils/test-dir.js';
import {write} from './utils/file-writer.js';
import {randomPort} from './utils/port.js';
import {httpGet} from './utils/http.js';
import router from '../src/router.js';

export default {
  'rescans for new files up to maxRescanAttempts': async ({pass, fail}) => {
    await withTestDir(async (dir) => {
      const prev = process.cwd();
      process.chdir(dir);
      const flags = {root: '.', logging: 0, scan: true};
      const logFn = () => {};
      
      await write(dir, '.config.json', JSON.stringify({
        maxRescanAttempts: 3
      }));
      
      const handler = await router(flags, logFn);
      const server = http.createServer(handler);
      const port = randomPort();
      await new Promise(r => server.listen(port, r));
      await new Promise(r => setTimeout(r, 50));
      
      const miss1 = await httpGet(`http://localhost:${port}/newfile.html`);
      if(miss1.res.statusCode !== 404) {
        server.close();
        process.chdir(prev);
        return fail('should 404 on first attempt');
      }
      
      await write(dir, 'newfile.html', '<h1>New File</h1>');
      
      const hit = await httpGet(`http://localhost:${port}/newfile.html`);
      if(hit.res.statusCode !== 200) {
        server.close();
        process.chdir(prev);
        return fail('should find file after creation on rescan');
      }
      
      if(!hit.body.toString().includes('New File')) {
        server.close();
        process.chdir(prev);
        return fail('should serve correct content');
      }
      
      server.close();
      process.chdir(prev);
    });
    pass('rescans and finds new files');
  },

  'resets rescan counter when file is found': async ({pass, fail}) => {
    await withTestDir(async (dir) => {
      const prev = process.cwd();
      process.chdir(dir);
      const flags = {root: '.', logging: 0, scan: true};
      const logFn = () => {};
      
      await write(dir, '.config.json', JSON.stringify({
        maxRescanAttempts: 2
      }));
      
      const handler = await router(flags, logFn);
      const server = http.createServer(handler);
      const port = randomPort();
      await new Promise(r => server.listen(port, r));
      await new Promise(r => setTimeout(r, 50));
      
      const miss1 = await httpGet(`http://localhost:${port}/test.html`);
      if(miss1.res.statusCode !== 404) {
        server.close();
        process.chdir(prev);
        return fail('should 404 initially');
      }
      
      await write(dir, 'test.html', '<h1>Test</h1>');
      
      const hit = await httpGet(`http://localhost:${port}/test.html`);
      if(hit.res.statusCode !== 200) {
        server.close();
        process.chdir(prev);
        return fail('should find file on second request');
      }
      
      await new Promise(r => setTimeout(r, 50));
      
      const hit2 = await httpGet(`http://localhost:${port}/test.html`);
      if(hit2.res.statusCode !== 200) {
        server.close();
        process.chdir(prev);
        return fail('should continue serving found file');
      }
      
      server.close();
      process.chdir(prev);
    });
    pass('counter reset on found file');
  },

  'blacklists path after maxRescanAttempts failed rescans': async ({pass, fail}) => {
    await withTestDir(async (dir) => {
      const prev = process.cwd();
      process.chdir(dir);
      const flags = {root: '.', logging: 0, scan: true};
      const logFn = () => {};
      
      await write(dir, '.config.json', JSON.stringify({
        maxRescanAttempts: 3
      }));
      
      const handler = await router(flags, logFn);
      const server = http.createServer(handler);
      const port = randomPort();
      await new Promise(r => server.listen(port, r));
      await new Promise(r => setTimeout(r, 50));
      
      for(let i = 1; i <= 3; i++) {
        const miss = await httpGet(`http://localhost:${port}/never-exists.html`);
        if(miss.res.statusCode !== 404) {
          server.close();
          process.chdir(prev);
          return fail(`should 404 on attempt ${i}`);
        }
      }
      
      await write(dir, 'never-exists.html', '<h1>Now it exists</h1>');
      
      const stillMiss = await httpGet(`http://localhost:${port}/never-exists.html`);
      if(stillMiss.res.statusCode !== 404) {
        server.close();
        process.chdir(prev);
        return fail('should still 404 after blacklisting');
      }
      
      server.close();
      process.chdir(prev);
    });
    pass('blacklists after max attempts');
  },

  'tracks rescan attempts independently per path': async ({pass, fail}) => {
    await withTestDir(async (dir) => {
      const prev = process.cwd();
      process.chdir(dir);
      const flags = {root: '.', logging: 0, scan: true};
      const logFn = () => {};
      
      await write(dir, '.config.json', JSON.stringify({
        maxRescanAttempts: 2
      }));
      
      const handler = await router(flags, logFn);
      const server = http.createServer(handler);
      const port = randomPort();
      await new Promise(r => server.listen(port, r));
      await new Promise(r => setTimeout(r, 50));
      
      const miss1a = await httpGet(`http://localhost:${port}/file-a.html`);
      if(miss1a.res.statusCode !== 404) {
        server.close();
        process.chdir(prev);
        return fail('file-a should 404 initially');
      }
      
      const miss1b = await httpGet(`http://localhost:${port}/file-b.html`);
      if(miss1b.res.statusCode !== 404) {
        server.close();
        process.chdir(prev);
        return fail('file-b should 404 initially');
      }
      
      const miss2a = await httpGet(`http://localhost:${port}/file-a.html`);
      if(miss2a.res.statusCode !== 404) {
        server.close();
        process.chdir(prev);
        return fail('file-a should 404 on attempt 2');
      }
      
      await write(dir, 'file-b.html', '<h1>File B</h1>');
      
      const hitB = await httpGet(`http://localhost:${port}/file-b.html`);
      if(hitB.res.statusCode !== 200) {
        server.close();
        process.chdir(prev);
        return fail('file-b should be found after creation');
      }
      
      await write(dir, 'file-a.html', '<h1>File A</h1>');
      
      const missA = await httpGet(`http://localhost:${port}/file-a.html`);
      if(missA.res.statusCode !== 404) {
        server.close();
        process.chdir(prev);
        return fail('file-a should be blacklisted after 2 attempts');
      }
      
      server.close();
      process.chdir(prev);
    });
    pass('independent tracking per path');
  },

  'respects noRescanPaths config patterns': async ({pass, fail}) => {
    await withTestDir(async (dir) => {
      const prev = process.cwd();
      process.chdir(dir);
      const flags = {root: '.', logging: 0, scan: true};
      const logFn = () => {};
      
      await write(dir, '.config.json', JSON.stringify({
        maxRescanAttempts: 3,
        noRescanPaths: ['/skip-.*']
      }));
      
      const handler = await router(flags, logFn);
      const server = http.createServer(handler);
      const port = randomPort();
      await new Promise(r => server.listen(port, r));
      await new Promise(r => setTimeout(r, 50));
      
      const miss1 = await httpGet(`http://localhost:${port}/skip-this.html`);
      if(miss1.res.statusCode !== 404) {
        server.close();
        process.chdir(prev);
        return fail('should 404 initially');
      }
      
      await write(dir, 'skip-this.html', '<h1>Skip</h1>');
      
      const stillMiss = await httpGet(`http://localhost:${port}/skip-this.html`);
      if(stillMiss.res.statusCode !== 404) {
        server.close();
        process.chdir(prev);
        return fail('should not rescan paths matching noRescanPaths');
      }
      
      server.close();
      process.chdir(prev);
    });
    pass('respects noRescanPaths patterns');
  },

  'scan flag disabled prevents rescanning': async ({pass, fail}) => {
    await withTestDir(async (dir) => {
      const prev = process.cwd();
      process.chdir(dir);
      const flags = {root: '.', logging: 0, scan: false};
      const logFn = () => {};
      
      const handler = await router(flags, logFn);
      const server = http.createServer(handler);
      const port = randomPort();
      await new Promise(r => server.listen(port, r));
      await new Promise(r => setTimeout(r, 50));
      
      const miss1 = await httpGet(`http://localhost:${port}/no-scan.html`);
      if(miss1.res.statusCode !== 404) {
        server.close();
        process.chdir(prev);
        return fail('should 404 initially');
      }
      
      await write(dir, 'no-scan.html', '<h1>No Scan</h1>');
      
      const stillMiss = await httpGet(`http://localhost:${port}/no-scan.html`);
      if(stillMiss.res.statusCode !== 404) {
        server.close();
        process.chdir(prev);
        return fail('should not rescan when scan flag is disabled');
      }
      
      server.close();
      process.chdir(prev);
    });
    pass('scan disabled prevents rescan');
  }
};
