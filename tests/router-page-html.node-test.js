import http from 'http';
import path from 'path';
import {withTempDir} from './utils/temp-dir.js';
import {write} from './utils/file-writer.js';
import {randomPort} from './utils/port.js';
import {httpGet} from './utils/http.js';
import router from '../src/router.js';
import findFile from '../src/findFile.js';

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

const toAbs = (root, p) => path.join(root, p);

export default {
  'findFile resolves METHOD.page.html after METHOD.html': async ({pass, fail}) => {
    const root = path.join(process.cwd(), 'tmp-root');
    const files = [
      toAbs(root, 'docs/GET.page.html'),
      toAbs(root, 'docs/index.html')
    ];
    const [file] = await findFile(files, root, '/docs', 'GET', noop);
    if(!file || path.basename(file) !== 'GET.page.html') return fail(`expected GET.page.html, got ${file ? path.basename(file) : 'none'}`);
    pass();
  },

  'findFile prefers METHOD.js over METHOD.page.html': async ({pass, fail}) => {
    const root = path.join(process.cwd(), 'tmp-root');
    const files = [
      toAbs(root, 'api/GET.js'),
      toAbs(root, 'api/GET.page.html')
    ];
    const [file] = await findFile(files, root, '/api', 'GET', noop);
    if(!file || path.basename(file) !== 'GET.js') return fail(`expected GET.js, got ${file ? path.basename(file) : 'none'}`);
    pass();
  },

  'findFile prefers METHOD.html over METHOD.page.html': async ({pass, fail}) => {
    const root = path.join(process.cwd(), 'tmp-root');
    const files = [
      toAbs(root, 'info/GET.html'),
      toAbs(root, 'info/GET.page.html')
    ];
    const [file] = await findFile(files, root, '/info', 'GET', noop);
    if(!file || path.basename(file) !== 'GET.html') return fail(`expected GET.html, got ${file ? path.basename(file) : 'none'}`);
    pass();
  },

  'findFile resolves index.page.html': async ({pass, fail}) => {
    const root = path.join(process.cwd(), 'tmp-root');
    const files = [toAbs(root, 'section/index.page.html')];
    const [file] = await findFile(files, root, '/section', 'GET', noop);
    if(!file || path.basename(file) !== 'index.page.html') return fail(`expected index.page.html, got ${file ? path.basename(file) : 'none'}`);
    pass();
  },

  'findFile prefers index.js over index.page.html': async ({pass, fail}) => {
    const root = path.join(process.cwd(), 'tmp-root');
    const files = [
      toAbs(root, 'section/index.js'),
      toAbs(root, 'section/index.page.html')
    ];
    const [file] = await findFile(files, root, '/section', 'GET', noop);
    if(!file || path.basename(file) !== 'index.js') return fail(`expected index.js, got ${file ? path.basename(file) : 'none'}`);
    pass();
  },

  'findFile resolves dynamic route with METHOD.page.html': async ({pass, fail}) => {
    const root = path.join(process.cwd(), 'tmp-root');
    const files = [toAbs(root, 'users/[id]/GET.page.html')];
    const [file, params] = await findFile(files, root, '/users/42', 'GET', noop);
    if(!file || path.basename(file) !== 'GET.page.html') return fail(`expected GET.page.html, got ${file ? path.basename(file) : 'none'}`);
    if(params.id !== '42') return fail(`expected id=42, got ${params.id}`);
    pass();
  },

  'router serves GET.page.html rendered through templating': async ({pass, fail}) => {
    try {
      await withTempDir(async (dir) => {
        const page = '<page template="default"><content location="main"><h1>Page Route</h1></content></page>';
        await write(dir, 'public/default.template.html', template);
        await write(dir, 'public/api/GET.page.html', page);

        const prev = process.cwd();
        process.chdir(dir);
        const {server, port} = await startServer(dir, {root: 'public'});

        try {
          const r = await httpGet(`http://localhost:${port}/api`);
          if(r.res.statusCode !== 200) throw new Error(`expected 200, got ${r.res.statusCode}`);
          const body = r.body.toString();
          if(!body.includes('<h1>Page Route</h1>')) throw new Error(`missing page content: ${body}`);
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

  'router serves index.page.html for directory request': async ({pass, fail}) => {
    try {
      await withTempDir(async (dir) => {
        const page = '<page template="default"><content location="main"><h1>Dir Index</h1></content></page>';
        await write(dir, 'public/default.template.html', template);
        await write(dir, 'public/section/index.page.html', page);

        const prev = process.cwd();
        process.chdir(dir);
        const {server, port} = await startServer(dir, {root: 'public'});

        try {
          const r = await httpGet(`http://localhost:${port}/section`);
          if(r.res.statusCode !== 200) throw new Error(`expected 200, got ${r.res.statusCode}`);
          const body = r.body.toString();
          if(!body.includes('<h1>Dir Index</h1>')) throw new Error(`missing page content: ${body}`);
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

  'router prefers GET.js over GET.page.html': async ({pass, fail}) => {
    try {
      await withTempDir(async (dir) => {
        const page = '<page template="default"><content location="main"><h1>Page</h1></content></page>';
        const routeJs = 'export default async (req, res) => { res.json({source: "js"}); };';
        await write(dir, 'public/default.template.html', template);
        await write(dir, 'public/api/GET.js', routeJs);
        await write(dir, 'public/api/GET.page.html', page);

        const prev = process.cwd();
        process.chdir(dir);
        const {server, port} = await startServer(dir, {root: 'public'});

        try {
          const r = await httpGet(`http://localhost:${port}/api`);
          if(r.res.statusCode !== 200) throw new Error(`expected 200, got ${r.res.statusCode}`);
          const body = r.body.toString();
          const json = JSON.parse(body);
          if(json.source !== 'js') throw new Error(`expected js route to win, got: ${body}`);
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
