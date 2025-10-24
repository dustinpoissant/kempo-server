import {startNode} from './utils/process.js';
import {randomPort} from './utils/port.js';
import {httpGet} from './utils/http.js';
import {withTempDir} from './utils/temp-dir.js';
import {write} from './utils/file-writer.js';
import path from 'path';
import ensureBuild from './utils/ensure-build.js';

ensureBuild();

export default {
  'CLI uses default config file when no --config flag provided': async ({pass, fail}) => {
    await withTempDir(async (dir) => {
      // Create default config and test file
      const defaultConfig = {
        allowedMimes: {
          html: { mime: "text/html", encoding: "utf8" },
          default: { mime: "text/default", encoding: "utf8" }
        }
      };
      await write(dir, '.config.json', JSON.stringify(defaultConfig));
      await write(dir, 'test.default', 'default config content');
      
      const port = randomPort();
      const args = [path.join(process.cwd(), 'dist/index.js'), '-r', '.', '-p', String(port), '-l', '0'];
      const child = await startNode(args, {cwd: dir});
      
      // Wait briefly for server to start
      await new Promise(r => setTimeout(r, 400));
      
      try {
        const {res, body} = await httpGet(`http://localhost:${port}/test.default`);
        if (res.statusCode !== 200) {
          return fail('server should serve file with default config');
        }
        if (res.headers['content-type'] !== 'text/default; charset=utf-8') {
          return fail('should use default config mime type with charset');
        }
        if (body.toString() !== 'default config content') {
          return fail('should serve correct content');
        }
        pass('CLI default config usage');
      } finally {
        child.kill();
        await new Promise(r => setTimeout(r, 50));
      }
    });
  },

  'CLI uses custom config file with --config flag': async ({pass, fail}) => {
    await withTempDir(async (dir) => {
      // Create custom config and test file
      const customConfig = {
        allowedMimes: {
          html: { mime: "text/html", encoding: "utf8" },
          custom: { mime: "text/custom", encoding: "utf8" }
        }
      };
      await write(dir, 'dev.config.json', JSON.stringify(customConfig));
      await write(dir, 'test.custom', 'custom config content');
      
      const port = randomPort();
      const args = [
        path.join(process.cwd(), 'dist/index.js'), 
        '-r', '.', 
        '-p', String(port), 
        '-l', '0',
        '--config', 'dev.config.json'
      ];
      const child = await startNode(args, {cwd: dir});
      
      // Wait briefly for server to start
      await new Promise(r => setTimeout(r, 400));
      
      try {
        const {res, body} = await httpGet(`http://localhost:${port}/test.custom`);
        if (res.statusCode !== 200) {
          return fail('server should serve file with custom config');
        }
        if (res.headers['content-type'] !== 'text/custom; charset=utf-8') {
          return fail('should use custom config mime type with charset');
        }
        if (body.toString() !== 'custom config content') {
          return fail('should serve correct content');
        }
        pass('CLI custom config usage');
      } finally {
        child.kill();
        await new Promise(r => setTimeout(r, 50));
      }
    });
  },

  'CLI uses custom config file with -c short flag': async ({pass, fail}) => {
    await withTempDir(async (dir) => {
      // Create custom config and test file
      const customConfig = {
        allowedMimes: {
          html: { mime: "text/html", encoding: "utf8" },
          short: { mime: "text/short", encoding: "utf8" }
        }
      };
      await write(dir, 'short.config.json', JSON.stringify(customConfig));
      await write(dir, 'test.short', 'short flag content');
      
      const port = randomPort();
      const args = [
        path.join(process.cwd(), 'dist/index.js'), 
        '-r', '.', 
        '-p', String(port), 
        '-l', '0',
        '-c', 'short.config.json'
      ];
      const child = await startNode(args, {cwd: dir});
      
      // Wait briefly for server to start
      await new Promise(r => setTimeout(r, 400));
      
      try {
        const {res, body} = await httpGet(`http://localhost:${port}/test.short`);
        if (res.statusCode !== 200) {
          return fail('server should serve file with short flag config');
        }
        if (res.headers['content-type'] !== 'text/short; charset=utf-8') {
          return fail('should use short flag config mime type with charset');
        }
        if (body.toString() !== 'short flag content') {
          return fail('should serve correct content');
        }
        pass('CLI short config flag usage');
      } finally {
        child.kill();
        await new Promise(r => setTimeout(r, 50));
      }
    });
  },

  'CLI uses absolute path config file': async ({pass, fail}) => {
    await withTempDir(async (dir) => {
      // Create custom config in subdirectory
      const configDir = path.join(dir, 'configs');
      const customConfig = {
        allowedMimes: {
          html: { mime: "text/html", encoding: "utf8" },
          absolute: { mime: "text/absolute", encoding: "utf8" }
        }
      };
      const configPath = await write(configDir, 'prod.config.json', JSON.stringify(customConfig));
      await write(dir, 'test.absolute', 'absolute path content');
      
      const port = randomPort();
      const args = [
        path.join(process.cwd(), 'dist/index.js'), 
        '-r', '.', 
        '-p', String(port), 
        '-l', '0',
        '--config', configPath
      ];
      const child = await startNode(args, {cwd: dir});
      
      // Wait briefly for server to start
      await new Promise(r => setTimeout(r, 400));
      
      try {
        const {res, body} = await httpGet(`http://localhost:${port}/test.absolute`);
        if (res.statusCode !== 200) {
          return fail('server should serve file with absolute path config');
        }
        if (res.headers['content-type'] !== 'text/absolute; charset=utf-8') {
          return fail('should use absolute path config mime type with charset');
        }
        if (body.toString() !== 'absolute path content') {
          return fail('should serve correct content');
        }
        pass('CLI absolute path config usage');
      } finally {
        child.kill();
        await new Promise(r => setTimeout(r, 50));
      }
    });
  },

  'CLI gracefully handles missing config file': async ({pass, fail}) => {
    await withTempDir(async (dir) => {
      // Create test file but no config
      await write(dir, 'index.html', '<h1>Home</h1>');
      
      const port = randomPort();
      const args = [
        path.join(process.cwd(), 'dist/index.js'), 
        '-r', '.', 
        '-p', String(port), 
        '-l', '0',
        '--config', 'nonexistent.config.json'
      ];
      const child = await startNode(args, {cwd: dir});
      
      // Wait briefly for server to start
      await new Promise(r => setTimeout(r, 400));
      
      try {
        const {res, body} = await httpGet(`http://localhost:${port}/index.html`);
        if (res.statusCode !== 200) {
          return fail('server should start with missing config');
        }
        if (res.headers['content-type'] !== 'text/html; charset=utf-8') {
          return fail('should use default mime types with charset');
        }
        if (!body.toString().includes('<h1>Home</h1>')) {
          return fail('should serve HTML content');
        }
        pass('CLI missing config file handling');
      } finally {
        child.kill();
        await new Promise(r => setTimeout(r, 50));
      }
    });
  },

  'CLI config flag works with custom routes': async ({pass, fail}) => {
    await withTempDir(async (dir) => {
      // Create custom config with custom routes
      await write(dir, 'source.txt', 'source file content');
      const customConfig = {
        allowedMimes: {
          html: "text/html",
          txt: "text/plain"
        },
        customRoutes: {
          "/custom-route": "./source.txt"
        }
      };
      await write(dir, 'routes.config.json', JSON.stringify(customConfig));
      
      const port = randomPort();
      const args = [
        path.join(process.cwd(), 'dist/index.js'), 
        '-r', '.', 
        '-p', String(port), 
        '-l', '0',
        '--config', 'routes.config.json'
      ];
      const child = await startNode(args, {cwd: dir});
      
      // Wait briefly for server to start
      await new Promise(r => setTimeout(r, 400));
      
      try {
        const {res, body} = await httpGet(`http://localhost:${port}/custom-route`);
        if (res.statusCode !== 200) {
          return fail('custom route should work with config flag');
        }
        if (res.headers['content-type'] !== 'text/plain; charset=utf-8') {
          return fail('should use config mime type with charset');
        }
        if (body.toString() !== 'source file content') {
          return fail('should serve custom route content');
        }
        pass('CLI config flag with custom routes');
      } finally {
        child.kill();
        await new Promise(r => setTimeout(r, 50));
      }
    });
  }
};
