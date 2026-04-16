import http from 'http';
import path from 'path';
import {withTempDir} from './utils/temp-dir.js';
import {write} from './utils/file-writer.js';
import {randomPort} from './utils/port.js';
import {httpGet} from './utils/http.js';
import router from '../src/router.js';

const template = '<html><body><location name="main" /></body></html>';
const noop = () => {};

const startServer = async (dir, flags, config = {}) => {
  await write(dir, `${flags.root}/.config.json`, JSON.stringify(config));
  const handler = await router({...flags, logging: 0}, noop);
  const server = http.createServer(handler);
  const port = randomPort();
  await new Promise(r => server.listen(port, r));
  await new Promise(r => setTimeout(r, 30));
  return {server, port};
};

export default {
  'CATCH.html in same directory serves with 404 status': async ({pass, fail}) => {
    try {
      await withTempDir(async (dir) => {
        await write(dir, 'public/index.html', '<h1>root</h1>');
        await write(dir, 'public/CATCH.html', '<h1>Not Found</h1>');

        const prev = process.cwd();
        process.chdir(dir);
        const {server, port} = await startServer(dir, {root: 'public'});

        try {
          const r = await httpGet(`http://localhost:${port}/nonexistent`);
          if(r.res.statusCode !== 404) throw new Error(`expected 404, got ${r.res.statusCode}`);
          const body = r.body.toString();
          if(!body.includes('<h1>Not Found</h1>')) throw new Error(`missing content: ${body}`);
        } finally {
          server.close();
          process.chdir(prev);
        }
      });
      pass();
    } catch(e) {
      fail(e.message);
    }
  },

  'CATCH.page.html renders through templating with 404 status': async ({pass, fail}) => {
    try {
      await withTempDir(async (dir) => {
        const page = '<page template="default"><content location="main"><h1>Custom Catch</h1></content></page>';
        await write(dir, 'public/default.template.html', template);
        await write(dir, 'public/CATCH.page.html', page);
        await write(dir, 'public/index.html', '<h1>root</h1>');

        const prev = process.cwd();
        process.chdir(dir);
        const {server, port} = await startServer(dir, {root: 'public'});

        try {
          const r = await httpGet(`http://localhost:${port}/nonexistent`);
          if(r.res.statusCode !== 404) throw new Error(`expected 404, got ${r.res.statusCode}`);
          const body = r.body.toString();
          if(!body.includes('<h1>Custom Catch</h1>')) throw new Error(`missing page content: ${body}`);
          if(!body.includes('<html>')) throw new Error(`missing template wrapper: ${body}`);
        } finally {
          server.close();
          process.chdir(prev);
        }
      });
      pass();
    } catch(e) {
      fail(e.message);
    }
  },

  'CATCH.js executes as route module': async ({pass, fail}) => {
    try {
      await withTempDir(async (dir) => {
        const handler = 'export default async (req, res) => { res.writeHead(404, {"Content-Type":"application/json"}); res.end(JSON.stringify({error: "catch handler", path: req.url})); };';
        await write(dir, 'public/CATCH.js', handler);
        await write(dir, 'public/index.html', '<h1>root</h1>');

        const prev = process.cwd();
        process.chdir(dir);
        const {server, port} = await startServer(dir, {root: 'public'});

        try {
          const r = await httpGet(`http://localhost:${port}/nonexistent`);
          const body = r.body.toString();
          const json = JSON.parse(body);
          if(json.error !== 'catch handler') throw new Error(`unexpected response: ${body}`);
        } finally {
          server.close();
          process.chdir(prev);
        }
      });
      pass();
    } catch(e) {
      fail(e.message);
    }
  },

  'CATCH fallback walks up directory tree to find closest handler': async ({pass, fail}) => {
    try {
      await withTempDir(async (dir) => {
        await write(dir, 'public/index.html', '<h1>root</h1>');
        await write(dir, 'public/CATCH.html', '<h1>Root Catch</h1>');
        await write(dir, 'public/deep/CATCH.html', '<h1>Deep Catch</h1>');

        const prev = process.cwd();
        process.chdir(dir);
        const {server, port} = await startServer(dir, {root: 'public'});

        try {
          // Request under /deep/ should find deep/CATCH.html
          const r1 = await httpGet(`http://localhost:${port}/deep/nonexistent`);
          if(r1.res.statusCode !== 404) throw new Error(`expected 404, got ${r1.res.statusCode}`);
          const body1 = r1.body.toString();
          if(!body1.includes('<h1>Deep Catch</h1>')) throw new Error(`expected deep catch, got: ${body1}`);

          // Request at root level should find root CATCH.html
          const r2 = await httpGet(`http://localhost:${port}/nonexistent`);
          if(r2.res.statusCode !== 404) throw new Error(`expected 404, got ${r2.res.statusCode}`);
          const body2 = r2.body.toString();
          if(!body2.includes('<h1>Root Catch</h1>')) throw new Error(`expected root catch, got: ${body2}`);
        } finally {
          server.close();
          process.chdir(prev);
        }
      });
      pass();
    } catch(e) {
      fail(e.message);
    }
  },

  'CATCH fallback walks up multiple levels': async ({pass, fail}) => {
    try {
      await withTempDir(async (dir) => {
        await write(dir, 'public/index.html', '<h1>root</h1>');
        await write(dir, 'public/CATCH.html', '<h1>Root Catch</h1>');

        const prev = process.cwd();
        process.chdir(dir);
        const {server, port} = await startServer(dir, {root: 'public'});

        try {
          // Deep nested request should walk up to root CATCH.html
          const r = await httpGet(`http://localhost:${port}/a/b/c/d/nonexistent`);
          if(r.res.statusCode !== 404) throw new Error(`expected 404, got ${r.res.statusCode}`);
          const body = r.body.toString();
          if(!body.includes('<h1>Root Catch</h1>')) throw new Error(`expected root catch, got: ${body}`);
        } finally {
          server.close();
          process.chdir(prev);
        }
      });
      pass();
    } catch(e) {
      fail(e.message);
    }
  },

  'CATCH.js takes priority over CATCH.html': async ({pass, fail}) => {
    try {
      await withTempDir(async (dir) => {
        const handler = 'export default async (req, res) => { res.writeHead(404, {"Content-Type":"text/plain"}); res.end("js-catch"); };';
        await write(dir, 'public/CATCH.js', handler);
        await write(dir, 'public/CATCH.html', '<h1>HTML Catch</h1>');
        await write(dir, 'public/index.html', '<h1>root</h1>');

        const prev = process.cwd();
        process.chdir(dir);
        const {server, port} = await startServer(dir, {root: 'public'});

        try {
          const r = await httpGet(`http://localhost:${port}/nonexistent`);
          const body = r.body.toString();
          if(body !== 'js-catch') throw new Error(`expected js catch, got: ${body}`);
        } finally {
          server.close();
          process.chdir(prev);
        }
      });
      pass();
    } catch(e) {
      fail(e.message);
    }
  },

  'CATCH.html takes priority over CATCH.page.html': async ({pass, fail}) => {
    try {
      await withTempDir(async (dir) => {
        const page = '<page template="default"><content location="main"><h1>Page Catch</h1></content></page>';
        await write(dir, 'public/default.template.html', template);
        await write(dir, 'public/CATCH.html', '<h1>HTML Catch</h1>');
        await write(dir, 'public/CATCH.page.html', page);
        await write(dir, 'public/index.html', '<h1>root</h1>');

        const prev = process.cwd();
        process.chdir(dir);
        const {server, port} = await startServer(dir, {root: 'public'});

        try {
          const r = await httpGet(`http://localhost:${port}/nonexistent`);
          if(r.res.statusCode !== 404) throw new Error(`expected 404, got ${r.res.statusCode}`);
          const body = r.body.toString();
          if(!body.includes('<h1>HTML Catch</h1>')) throw new Error(`expected html catch, got: ${body}`);
        } finally {
          server.close();
          process.chdir(prev);
        }
      });
      pass();
    } catch(e) {
      fail(e.message);
    }
  },

  'no CATCH fallback returns plain text Not Found': async ({pass, fail}) => {
    try {
      await withTempDir(async (dir) => {
        await write(dir, 'public/index.html', '<h1>root</h1>');

        const prev = process.cwd();
        process.chdir(dir);
        const {server, port} = await startServer(dir, {root: 'public'});

        try {
          const r = await httpGet(`http://localhost:${port}/nonexistent`);
          if(r.res.statusCode !== 404) throw new Error(`expected 404, got ${r.res.statusCode}`);
          const body = r.body.toString();
          if(body !== 'Not Found') throw new Error(`expected plain 'Not Found', got: ${body}`);
        } finally {
          server.close();
          process.chdir(prev);
        }
      });
      pass();
    } catch(e) {
      fail(e.message);
    }
  },

  'CATCH can respond with any status code (not just 404)': async ({pass, fail}) => {
    try {
      await withTempDir(async (dir) => {
        const handler = 'export default async (req, res) => { res.writeHead(200, {"Content-Type":"application/json"}); res.end(JSON.stringify({message: "catch all handler", path: req.url})); };';
        await write(dir, 'public/CATCH.js', handler);
        await write(dir, 'public/index.html', '<h1>root</h1>');

        const prev = process.cwd();
        process.chdir(dir);
        const {server, port} = await startServer(dir, {root: 'public'});

        try {
          const r = await httpGet(`http://localhost:${port}/api/data/key/value`);
          if(r.res.statusCode !== 200) throw new Error(`expected 200, got ${r.res.statusCode}`);
          const body = r.body.toString();
          const json = JSON.parse(body);
          if(json.message !== 'catch all handler') throw new Error(`unexpected response: ${body}`);
          if(!json.path.includes('key/value')) throw new Error(`path params not captured: ${body}`);
        } finally {
          server.close();
          process.chdir(prev);
        }
      });
      pass();
    } catch(e) {
      fail(e.message);
    }
  }
};
