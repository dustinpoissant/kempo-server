import http from 'http';
import path from 'path';
import {withTempDir} from './utils/temp-dir.js';
import {write} from './utils/file-writer.js';
import {randomPort} from './utils/port.js';
import {httpGet} from './utils/http.js';
import router from '../src/router.js';

const startServer = async (dir, flags, config) => {
  await write(dir, `${flags.root}/.config.json`, JSON.stringify(config));
  const handler = await router({...flags, logging: 0}, () => {});
  const server = http.createServer(handler);
  const port = randomPort();
  await new Promise(r => server.listen(port, r));
  await new Promise(r => setTimeout(r, 30));
  return {server, port};
};

export default {
  'wildcard custom route renders .page.html via SSR': async ({pass, fail}) => {
    try {
      await withTempDir(async (dir) => {
        const template = '<html><body><location name="main" /></body></html>';
        const page = '<page template="default"><content location="main"><h1>Admin Page</h1></content></page>';

        await write(dir, 'admin/default.template.html', template);
        await write(dir, 'admin/dashboard.page.html', page);
        await write(dir, 'public/index.html', '<h1>root</h1>');

        const prev = process.cwd();
        process.chdir(dir);
        const {server, port} = await startServer(dir, {root: 'public'}, {
          customRoutes: {'/admin/**': '../admin/**'},
          templating: {ssr: true}
        });

        try {
          const r = await httpGet(`http://localhost:${port}/admin/dashboard`);
          if(r.res.statusCode !== 200) throw new Error(`expected 200, got ${r.res.statusCode}`);
          const body = r.body.toString();
          if(!body.includes('<h1>Admin Page</h1>')) throw new Error(`missing page content: ${body}`);
          if(!body.includes('<html>')) throw new Error(`missing template wrapper: ${body}`);
        } finally {
          server.close();
          process.chdir(prev);
        }
      });
      pass('wildcard custom route renders .page.html via SSR');
    } catch(e) {
      fail(e.message);
    }
  },

  'wildcard custom route renders index.page.html for directory path': async ({pass, fail}) => {
    try {
      await withTempDir(async (dir) => {
        const template = '<html><body><location name="main" /></body></html>';
        const page = '<page template="default"><content location="main"><h1>Section Index</h1></content></page>';

        await write(dir, 'admin/default.template.html', template);
        await write(dir, 'admin/users/index.page.html', page);
        await write(dir, 'public/index.html', '<h1>root</h1>');

        const prev = process.cwd();
        process.chdir(dir);
        const {server, port} = await startServer(dir, {root: 'public'}, {
          customRoutes: {'/admin/**': '../admin/**'},
          templating: {ssr: true}
        });

        try {
          const r = await httpGet(`http://localhost:${port}/admin/users`);
          if(r.res.statusCode !== 200) throw new Error(`expected 200, got ${r.res.statusCode}`);
          const body = r.body.toString();
          if(!body.includes('<h1>Section Index</h1>')) throw new Error(`missing page content: ${body}`);
        } finally {
          server.close();
          process.chdir(prev);
        }
      });
      pass('wildcard custom route renders index.page.html for directory path');
    } catch(e) {
      fail(e.message);
    }
  },

  'SSR not attempted for custom route when templating.ssr is false': async ({pass, fail}) => {
    try {
      await withTempDir(async (dir) => {
        const template = '<html><body><location name="main" /></body></html>';
        const page = '<page template="default"><content location="main"><h1>Should Not Render</h1></content></page>';

        await write(dir, 'admin/default.template.html', template);
        await write(dir, 'admin/dashboard.page.html', page);
        await write(dir, 'public/index.html', '<h1>root</h1>');

        const prev = process.cwd();
        process.chdir(dir);
        const {server, port} = await startServer(dir, {root: 'public'}, {
          customRoutes: {'/admin/**': '../admin/**'},
          templating: {ssr: false}
        });

        try {
          const r = await httpGet(`http://localhost:${port}/admin/dashboard`);
          if(r.res.statusCode !== 404) throw new Error(`expected 404, got ${r.res.statusCode}`);
        } finally {
          server.close();
          process.chdir(prev);
        }
      });
      pass('SSR not attempted when templating.ssr is false');
    } catch(e) {
      fail(e.message);
    }
  },

  'wildcard custom route SSR uses custom root for template/fragment lookup': async ({pass, fail}) => {
    try {
      await withTempDir(async (dir) => {
        const template = '<html><fragment name="nav" /><location name="main" /></html>';
        const fragment = '<nav>Custom Nav</nav>';
        const page = '<page template="default"><content location="main"><p>Content</p></content></page>';

        await write(dir, 'admin/default.template.html', template);
        await write(dir, 'admin/nav.fragment.html', fragment);
        await write(dir, 'admin/about.page.html', page);
        await write(dir, 'public/index.html', '<h1>root</h1>');

        const prev = process.cwd();
        process.chdir(dir);
        const {server, port} = await startServer(dir, {root: 'public'}, {
          customRoutes: {'/admin/**': '../admin/**'},
          templating: {ssr: true}
        });

        try {
          const r = await httpGet(`http://localhost:${port}/admin/about`);
          if(r.res.statusCode !== 200) throw new Error(`expected 200, got ${r.res.statusCode}`);
          const body = r.body.toString();
          if(!body.includes('<nav>Custom Nav</nav>')) throw new Error(`fragment not resolved: ${body}`);
          if(!body.includes('<p>Content</p>')) throw new Error(`page content missing: ${body}`);
        } finally {
          server.close();
          process.chdir(prev);
        }
      });
      pass('custom route SSR uses custom root for template/fragment lookup');
    } catch(e) {
      fail(e.message);
    }
  },

  'preRender renders .page.html files in wildcard custom route directory': async ({pass, fail}) => {
    try {
      await withTempDir(async (dir) => {
        const template = '<html><body><location name="main" /></body></html>';
        const page = '<page template="default"><content location="main"><h1>Pre-rendered</h1></content></page>';

        await write(dir, 'admin/default.template.html', template);
        await write(dir, 'admin/info.page.html', page);
        await write(dir, 'public/index.html', '<h1>root</h1>');

        const prev = process.cwd();
        process.chdir(dir);
        const {server, port} = await startServer(dir, {root: 'public'}, {
          customRoutes: {'/admin/**': '../admin/**'},
          templating: {preRender: true}
        });

        try {
          // preRender should have written admin/info.html
          const {readFile} = await import('fs/promises');
          const rendered = await readFile(path.join(dir, 'admin', 'info.html'), 'utf8');
          if(!rendered.includes('<h1>Pre-rendered</h1>')) throw new Error(`missing content: ${rendered}`);
          // Serving the static pre-rendered file should also work
          const r = await httpGet(`http://localhost:${port}/admin/info.html`);
          if(r.res.statusCode !== 200) throw new Error(`expected 200, got ${r.res.statusCode}`);
        } finally {
          server.close();
          process.chdir(prev);
        }
      });
      pass('preRender renders .page.html files in wildcard custom route directory');
    } catch(e) {
      fail(e.message);
    }
  }
};
