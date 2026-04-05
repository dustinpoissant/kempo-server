import http from 'http';
import {withTempDir} from './utils/temp-dir.js';
import {write} from './utils/file-writer.js';
import {randomPort} from './utils/port.js';
import {httpGet, httpRequest} from './utils/http.js';
import router from '../src/router.js';

export default {
  'wildcard route resolves GET.js in directory': async ({pass, fail, log}) => {
    try {
      await withTempDir(async (dir) => {
        await write(dir, 'api/auth/session/GET.js',
          `export default (req, res) => { res.writeHead(200, {'Content-Type':'application/json'}); res.end('{"user":"test"}'); };`
        );
        await write(dir, 'docs/index.html', '<html></html>');
        await write(dir, 'docs/.config.json', JSON.stringify({
          customRoutes: { '/api/**': '../api/**' }
        }));

        const prev = process.cwd();
        process.chdir(dir);
        const handler = await router({root: 'docs', logging: 0}, () => {});
        const server = http.createServer(handler);
        const port = randomPort();
        await new Promise(r => server.listen(port, r));
        await new Promise(r => setTimeout(r, 50));

        try {
          const r1 = await httpGet(`http://localhost:${port}/api/auth/session`);
          log('status: ' + r1.res.statusCode);
          if(r1.res.statusCode !== 200) throw new Error('expected 200, got ' + r1.res.statusCode);
          const body = JSON.parse(r1.body.toString());
          if(body.user !== 'test') throw new Error('unexpected body: ' + r1.body.toString());
        } finally {
          server.close();
          process.chdir(prev);
        }
      });
      pass('wildcard route resolves GET.js in directory');
    } catch(e) {
      fail(e.message);
    }
  },

  'wildcard route resolves POST.js in directory': async ({pass, fail, log}) => {
    try {
      await withTempDir(async (dir) => {
        await write(dir, 'api/users/POST.js',
          `export default (req, res) => { res.writeHead(201, {'Content-Type':'application/json'}); res.end('{"created":true}'); };`
        );
        await write(dir, 'docs/index.html', '<html></html>');
        await write(dir, 'docs/.config.json', JSON.stringify({
          customRoutes: { '/api/**': '../api/**' }
        }));

        const prev = process.cwd();
        process.chdir(dir);
        const handler = await router({root: 'docs', logging: 0}, () => {});
        const server = http.createServer(handler);
        const port = randomPort();
        await new Promise(r => server.listen(port, r));
        await new Promise(r => setTimeout(r, 50));

        try {
          const r1 = await httpRequest(`http://localhost:${port}/api/users`, 'POST', '{"name":"alice"}');
          log('status: ' + r1.res.statusCode);
          if(r1.res.statusCode !== 201) throw new Error('expected 201, got ' + r1.res.statusCode);
          const body = JSON.parse(r1.body.toString());
          if(!body.created) throw new Error('unexpected body: ' + r1.body.toString());
        } finally {
          server.close();
          process.chdir(prev);
        }
      });
      pass('wildcard route resolves POST.js in directory');
    } catch(e) {
      fail(e.message);
    }
  },

  'wildcard route resolves index.html in directory': async ({pass, fail, log}) => {
    try {
      await withTempDir(async (dir) => {
        await write(dir, 'app/admin/index.html', '<h1>Admin Panel</h1>');
        await write(dir, 'docs/index.html', '<html></html>');
        await write(dir, 'docs/.config.json', JSON.stringify({
          customRoutes: { '/app/**': '../app/**' }
        }));

        const prev = process.cwd();
        process.chdir(dir);
        const handler = await router({root: 'docs', logging: 0}, () => {});
        const server = http.createServer(handler);
        const port = randomPort();
        await new Promise(r => server.listen(port, r));
        await new Promise(r => setTimeout(r, 50));

        try {
          const r1 = await httpGet(`http://localhost:${port}/app/admin`);
          log('status: ' + r1.res.statusCode);
          if(r1.res.statusCode !== 200) throw new Error('expected 200, got ' + r1.res.statusCode);
          if(!r1.body.toString().includes('Admin Panel')) throw new Error('missing content');
        } finally {
          server.close();
          process.chdir(prev);
        }
      });
      pass('wildcard route resolves index.html in directory');
    } catch(e) {
      fail(e.message);
    }
  },

  'exact custom route resolves GET.js in directory': async ({pass, fail, log}) => {
    try {
      await withTempDir(async (dir) => {
        await write(dir, 'api/status/GET.js',
          `export default (req, res) => { res.writeHead(200, {'Content-Type':'application/json'}); res.end('{"ok":true}'); };`
        );
        await write(dir, 'docs/index.html', '<html></html>');
        await write(dir, 'docs/.config.json', JSON.stringify({
          customRoutes: { '/status': '../api/status' }
        }));

        const prev = process.cwd();
        process.chdir(dir);
        const handler = await router({root: 'docs', logging: 0}, () => {});
        const server = http.createServer(handler);
        const port = randomPort();
        await new Promise(r => server.listen(port, r));
        await new Promise(r => setTimeout(r, 50));

        try {
          const r1 = await httpGet(`http://localhost:${port}/status`);
          log('status: ' + r1.res.statusCode);
          if(r1.res.statusCode !== 200) throw new Error('expected 200, got ' + r1.res.statusCode);
          const body = JSON.parse(r1.body.toString());
          if(!body.ok) throw new Error('unexpected body');
        } finally {
          server.close();
          process.chdir(prev);
        }
      });
      pass('exact custom route resolves GET.js in directory');
    } catch(e) {
      fail(e.message);
    }
  },

  'exact custom route resolves index.html in directory': async ({pass, fail, log}) => {
    try {
      await withTempDir(async (dir) => {
        await write(dir, 'site/dashboard/index.html', '<h1>Dashboard</h1>');
        await write(dir, 'docs/index.html', '<html></html>');
        await write(dir, 'docs/.config.json', JSON.stringify({
          customRoutes: { '/dashboard': '../site/dashboard' }
        }));

        const prev = process.cwd();
        process.chdir(dir);
        const handler = await router({root: 'docs', logging: 0}, () => {});
        const server = http.createServer(handler);
        const port = randomPort();
        await new Promise(r => server.listen(port, r));
        await new Promise(r => setTimeout(r, 50));

        try {
          const r1 = await httpGet(`http://localhost:${port}/dashboard`);
          log('status: ' + r1.res.statusCode);
          if(r1.res.statusCode !== 200) throw new Error('expected 200, got ' + r1.res.statusCode);
          if(!r1.body.toString().includes('Dashboard')) throw new Error('missing content');
        } finally {
          server.close();
          process.chdir(prev);
        }
      });
      pass('exact custom route resolves index.html in directory');
    } catch(e) {
      fail(e.message);
    }
  },

  'wildcard route still serves static files': async ({pass, fail, log}) => {
    try {
      await withTempDir(async (dir) => {
        await write(dir, 'assets/style.css', 'body { color: red; }');
        await write(dir, 'docs/index.html', '<html></html>');
        await write(dir, 'docs/.config.json', JSON.stringify({
          customRoutes: { '/assets/**': '../assets/**' }
        }));

        const prev = process.cwd();
        process.chdir(dir);
        const handler = await router({root: 'docs', logging: 0}, () => {});
        const server = http.createServer(handler);
        const port = randomPort();
        await new Promise(r => server.listen(port, r));
        await new Promise(r => setTimeout(r, 50));

        try {
          const r1 = await httpGet(`http://localhost:${port}/assets/style.css`);
          log('status: ' + r1.res.statusCode);
          if(r1.res.statusCode !== 200) throw new Error('expected 200');
          if(!r1.body.toString().includes('color: red')) throw new Error('wrong content');
        } finally {
          server.close();
          process.chdir(prev);
        }
      });
      pass('wildcard route still serves static files');
    } catch(e) {
      fail(e.message);
    }
  },

  'wildcard directory with no matching files returns 404': async ({pass, fail, log}) => {
    try {
      await withTempDir(async (dir) => {
        await write(dir, 'api/empty/.gitkeep', '');
        await write(dir, 'docs/index.html', '<html></html>');
        await write(dir, 'docs/.config.json', JSON.stringify({
          customRoutes: { '/api/**': '../api/**' }
        }));

        const prev = process.cwd();
        process.chdir(dir);
        const handler = await router({root: 'docs', logging: 0}, () => {});
        const server = http.createServer(handler);
        const port = randomPort();
        await new Promise(r => server.listen(port, r));
        await new Promise(r => setTimeout(r, 50));

        try {
          const r1 = await httpGet(`http://localhost:${port}/api/empty`);
          log('status: ' + r1.res.statusCode);
          if(r1.res.statusCode !== 404) throw new Error('expected 404, got ' + r1.res.statusCode);
        } finally {
          server.close();
          process.chdir(prev);
        }
      });
      pass('wildcard directory with no matching files returns 404');
    } catch(e) {
      fail(e.message);
    }
  },

  'route file GET.js takes priority over index.html in directory': async ({pass, fail, log}) => {
    try {
      await withTempDir(async (dir) => {
        await write(dir, 'api/data/GET.js',
          `export default (req, res) => { res.writeHead(200, {'Content-Type':'application/json'}); res.end('{"from":"route"}'); };`
        );
        await write(dir, 'api/data/index.html', '<h1>Index</h1>');
        await write(dir, 'docs/index.html', '<html></html>');
        await write(dir, 'docs/.config.json', JSON.stringify({
          customRoutes: { '/api/**': '../api/**' }
        }));

        const prev = process.cwd();
        process.chdir(dir);
        const handler = await router({root: 'docs', logging: 0}, () => {});
        const server = http.createServer(handler);
        const port = randomPort();
        await new Promise(r => server.listen(port, r));
        await new Promise(r => setTimeout(r, 50));

        try {
          const r1 = await httpGet(`http://localhost:${port}/api/data`);
          log('status: ' + r1.res.statusCode);
          if(r1.res.statusCode !== 200) throw new Error('expected 200');
          const body = JSON.parse(r1.body.toString());
          if(body.from !== 'route') throw new Error('GET.js should take priority over index.html');
        } finally {
          server.close();
          process.chdir(prev);
        }
      });
      pass('route file GET.js takes priority over index.html');
    } catch(e) {
      fail(e.message);
    }
  },

  'wildcard route executes route file directly mapped to a file': async ({pass, fail, log}) => {
    try {
      await withTempDir(async (dir) => {
        await write(dir, 'handlers/GET.js',
          `export default (req, res) => { res.writeHead(200, {'Content-Type':'text/plain'}); res.end('handled'); };`
        );
        await write(dir, 'docs/index.html', '<html></html>');
        await write(dir, 'docs/.config.json', JSON.stringify({
          customRoutes: { '/handler': '../handlers/GET.js' }
        }));

        const prev = process.cwd();
        process.chdir(dir);
        const handler = await router({root: 'docs', logging: 0}, () => {});
        const server = http.createServer(handler);
        const port = randomPort();
        await new Promise(r => server.listen(port, r));
        await new Promise(r => setTimeout(r, 50));

        try {
          const r1 = await httpGet(`http://localhost:${port}/handler`);
          log('status: ' + r1.res.statusCode);
          if(r1.res.statusCode !== 200) throw new Error('expected 200');
          if(r1.body.toString() !== 'handled') throw new Error('expected route execution');
        } finally {
          server.close();
          process.chdir(prev);
        }
      });
      pass('exact custom route executes route file directly');
    } catch(e) {
      fail(e.message);
    }
  },

  'wildcard route supports [param] directory segments': async ({pass, fail, log}) => {
    try {
      await withTempDir(async (dir) => {
        await write(dir, 'api/users/[id]/GET.js',
          `export default (req, res) => { res.writeHead(200, {'Content-Type':'application/json'}); res.end(JSON.stringify({id: req.params.id})); };`
        );
        await write(dir, 'docs/index.html', '<html></html>');
        await write(dir, 'docs/.config.json', JSON.stringify({
          customRoutes: { '/api/**': '../api/**' }
        }));

        const prev = process.cwd();
        process.chdir(dir);
        const handler = await router({root: 'docs', logging: 0}, () => {});
        const server = http.createServer(handler);
        const port = randomPort();
        await new Promise(r => server.listen(port, r));
        await new Promise(r => setTimeout(r, 50));

        try {
          const r1 = await httpGet(`http://localhost:${port}/api/users/abc123`);
          log('status: ' + r1.res.statusCode);
          if(r1.res.statusCode !== 200) throw new Error('expected 200, got ' + r1.res.statusCode);
          const body = JSON.parse(r1.body.toString());
          if(body.id !== 'abc123') throw new Error('expected id=abc123, got: ' + r1.body.toString());
        } finally {
          server.close();
          process.chdir(prev);
        }
      });
      pass('wildcard route supports [param] directory segments');
    } catch(e) {
      fail(e.message);
    }
  },

  'wildcard route supports multiple [param] segments': async ({pass, fail, log}) => {
    try {
      await withTempDir(async (dir) => {
        await write(dir, 'api/[org]/[repo]/GET.js',
          `export default (req, res) => { res.writeHead(200, {'Content-Type':'application/json'}); res.end(JSON.stringify({org: req.params.org, repo: req.params.repo})); };`
        );
        await write(dir, 'docs/index.html', '<html></html>');
        await write(dir, 'docs/.config.json', JSON.stringify({
          customRoutes: { '/api/**': '../api/**' }
        }));

        const prev = process.cwd();
        process.chdir(dir);
        const handler = await router({root: 'docs', logging: 0}, () => {});
        const server = http.createServer(handler);
        const port = randomPort();
        await new Promise(r => server.listen(port, r));
        await new Promise(r => setTimeout(r, 50));

        try {
          const r1 = await httpGet(`http://localhost:${port}/api/acme/myrepo`);
          log('status: ' + r1.res.statusCode);
          if(r1.res.statusCode !== 200) throw new Error('expected 200, got ' + r1.res.statusCode);
          const body = JSON.parse(r1.body.toString());
          if(body.org !== 'acme') throw new Error('wrong org: ' + body.org);
          if(body.repo !== 'myrepo') throw new Error('wrong repo: ' + body.repo);
        } finally {
          server.close();
          process.chdir(prev);
        }
      });
      pass('wildcard route supports multiple [param] segments');
    } catch(e) {
      fail(e.message);
    }
  },

  'wildcard route [param] exact match takes priority over [param]': async ({pass, fail, log}) => {
    try {
      await withTempDir(async (dir) => {
        // Both a literal and [param] directory exist
        await write(dir, 'api/users/me/GET.js',
          `export default (req, res) => { res.writeHead(200, {'Content-Type':'application/json'}); res.end('{"who":"me"}'); };`
        );
        await write(dir, 'api/users/[id]/GET.js',
          `export default (req, res) => { res.writeHead(200, {'Content-Type':'application/json'}); res.end(JSON.stringify({id: req.params.id})); };`
        );
        await write(dir, 'docs/index.html', '<html></html>');
        await write(dir, 'docs/.config.json', JSON.stringify({
          customRoutes: { '/api/**': '../api/**' }
        }));

        const prev = process.cwd();
        process.chdir(dir);
        const handler = await router({root: 'docs', logging: 0}, () => {});
        const server = http.createServer(handler);
        const port = randomPort();
        await new Promise(r => server.listen(port, r));
        await new Promise(r => setTimeout(r, 50));

        try {
          // Literal 'me' should win over [id]
          const r1 = await httpGet(`http://localhost:${port}/api/users/me`);
          log('me status: ' + r1.res.statusCode);
          if(r1.res.statusCode !== 200) throw new Error('expected 200');
          const b1 = JSON.parse(r1.body.toString());
          if(b1.who !== 'me') throw new Error('literal match should win: ' + r1.body.toString());

          // Dynamic [id] still works for other values
          const r2 = await httpGet(`http://localhost:${port}/api/users/456`);
          log('dynamic status: ' + r2.res.statusCode);
          if(r2.res.statusCode !== 200) throw new Error('expected 200 for dynamic');
          const b2 = JSON.parse(r2.body.toString());
          if(b2.id !== '456') throw new Error('dynamic param wrong: ' + r2.body.toString());
        } finally {
          server.close();
          process.chdir(prev);
        }
      });
      pass('wildcard route [param] exact match takes priority over [param]');
    } catch(e) {
      fail(e.message);
    }
  }
};
