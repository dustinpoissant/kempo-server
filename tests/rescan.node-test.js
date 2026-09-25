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
        throw new Error('should 404 before file exists');
      }

      await write(dir, 'added.html', '<h1>Added</h1>');

      const stillMiss = await httpGet(`http://localhost:${port}/added.html`);
      if(stillMiss.res.statusCode !== 404) {
        server.close();
        process.chdir(prev);
        throw new Error('should still 404 with maxRescanAttempts=0');
      }

      const count = await rescan();
      if(typeof count !== 'number' || count < 2) {
        server.close();
        process.chdir(prev);
        throw new Error(`rescan should return file count, got: ${count}`);
      }

      const hit = await httpGet(`http://localhost:${port}/added.html`);
      if(hit.res.statusCode !== 200) {
        server.close();
        process.chdir(prev);
        throw new Error('should serve file after rescan()');
      }

      if(!hit.body.toString().includes('Added')) {
        server.close();
        process.chdir(prev);
        throw new Error('should serve correct content after rescan');
      }

      server.close();
      process.chdir(prev);
    });
    pass('rescan() works from imported function');
  },

  'a router stops answering rescans once its server closes': async ({pass}) => {
    /*
      The emitter is module-level, so a router that never unregisters would scan its directory on every
      later rescan for the life of the process, including after its server and its root are gone.
    */
    await withTestDir(async dir => {
      const prev = process.cwd();
      process.chdir(dir);
      await write(dir, 'index.html', '<h1>Home</h1>');

      const scans = [];
      const handler = await router({root: '.', logging: 0}, (message) => { if(String(message).startsWith('Rescan found')) scans.push(message); });
      const server = http.createServer(handler);
      await new Promise(r => server.listen(0, r));
      const port = server.address().port;

      // A request is how the router learns which server to watch
      await httpGet(`http://localhost:${port}/index.html`);

      await rescan();
      if(scans.length !== 1) {
        server.close();
        process.chdir(prev);
        throw new Error(`a live router should answer a rescan, scans: ${scans.length}`);
      }

      await new Promise(r => server.close(r));
      await new Promise(r => setTimeout(r, 50));

      await rescan();
      process.chdir(prev);
      if(scans.length !== 1) throw new Error(`a closed router still answered a rescan, scans: ${scans.length}`);
    });
    pass('router unregisters with its server');
  },

  'dispose() removes a router that never received a request': async ({pass}) => {
    await withTestDir(async dir => {
      const prev = process.cwd();
      process.chdir(dir);

      const scans = [];
      const handler = await router({root: '.', logging: 0}, (message) => { if(String(message).startsWith('Rescan found')) scans.push(message); });
      process.chdir(prev);

      handler.dispose();
      await rescan();
      if(scans.length !== 0) throw new Error(`a disposed router still answered a rescan, scans: ${scans.length}`);
    });
    pass('dispose');
  },

  'rescan waits for every router and returns the largest count, not the fastest': async ({pass}) => {
    /*
      Answering with whichever router finishes first made the result depend on scan speed: a router whose
      root was already gone reported 0 files instantly and beat a live one.
    */
    // An isolated copy of the module has its own emitter, so routers left over from other test files cannot answer
    const {onRescan: on, default: isolatedRescan} = await import('../src/rescan.js?largest-count');
    on(done => done(null, 0));
    on(done => setTimeout(() => done(null, 42), 40));
    on(done => done(null, 7));

    const count = await isolatedRescan();
    if(count !== 42) throw new Error(`expected the largest count (42), got ${count}`);
    pass('largest count wins');
  },

  'rescan rejects only when every router failed': async ({pass}) => {
    const {onRescan: on, default: isolatedRescan} = await import('../src/rescan.js?error-handling');
    const stopFailing = on(done => done(new Error('scan failed')));

    let rejected = null;
    try { await isolatedRescan(); } catch(error) { rejected = error; }
    if(!rejected || rejected.message !== 'scan failed') throw new Error('a lone failing router should reject rescan()');

    // With a healthy router alongside, one failure must not sink the whole rescan
    on(done => done(null, 3));
    const count = await isolatedRescan();
    if(count !== 3) throw new Error(`expected 3 from the healthy router, got ${count}`);

    stopFailing();
    if(await isolatedRescan() !== 3) throw new Error('the healthy router alone should still answer');

    // With nothing registered at all there is nothing to scan, which is not an error
    const {default: emptyRescan} = await import('../src/rescan.js?empty');
    if(await emptyRescan() !== 0) throw new Error('rescan with no routers should resolve 0');
    pass('error handling');
  },
};
