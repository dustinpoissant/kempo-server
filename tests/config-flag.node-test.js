import http from 'http';
import path from 'path';
import {withTempDir} from './utils/temp-dir.js';
import {write} from './utils/file-writer.js';
import {randomPort} from './utils/port.js';
import {httpGet} from './utils/http.js';
import router from '../src/router.js';
import getFlags from '../src/getFlags.js';

export default {
  'getFlags includes config flag with default value': async ({pass, fail}) => {
    const args = ['--root', 'public', '--port', '8080'];
    const flags = getFlags(args, {
      port: 3000,
      logging: 2,
      root: './',
      scan: false,
      config: '.config.json'
    }, {
      p: 'port',
      l: 'logging',
      r: 'root',
      s: 'scan',
      c: 'config'
    });
    
    if (flags.config !== '.config.json') {
      return fail('default config should be .config.json');
    }
    if (flags.port !== '8080') {
      return fail('other flags should still work');
    }
    if (flags.root !== 'public') {
      return fail('root flag should work');
    }
    
    pass('config flag has correct default');
  },

  'getFlags parses custom config flag with long form': async ({pass, fail}) => {
    const args = ['--root', 'public', '--config', 'dev.config.json'];
    const flags = getFlags(args, {
      port: 3000,
      logging: 2,
      root: './',
      scan: false,
      config: '.config.json'
    }, {
      p: 'port',
      l: 'logging',
      r: 'root',
      s: 'scan',
      c: 'config'
    });
    
    if (flags.config !== 'dev.config.json') {
      return fail('should parse custom config file');
    }
    if (flags.root !== 'public') {
      return fail('other flags should still work');
    }
    
    pass('long form config flag parsing');
  },

  'getFlags parses custom config flag with short form': async ({pass, fail}) => {
    const args = ['--root', 'public', '-c', 'production.config.json'];
    const flags = getFlags(args, {
      port: 3000,
      logging: 2,
      root: './',
      scan: false,
      config: '.config.json'
    }, {
      p: 'port',
      l: 'logging',
      r: 'root',
      s: 'scan',
      c: 'config'
    });
    
    if (flags.config !== 'production.config.json') {
      return fail('should parse short form config flag');
    }
    if (flags.root !== 'public') {
      return fail('other flags should still work');
    }
    
    pass('short form config flag parsing');
  },

  'router uses default config file when none specified': async ({pass, fail}) => {
    await withTempDir(async (dir) => {
      // Create a custom config file as .config.json (default name)
      const customConfig = {
        allowedMimes: {
          html: { mime: "text/html", encoding: "utf8" },
          custom: { mime: "text/custom", encoding: "utf8" }
        }
      };
      await write(dir, '.config.json', JSON.stringify(customConfig));
      await write(dir, 'test.custom', 'custom content');
      
      const prev = process.cwd();
      process.chdir(dir);
      const flags = {root: '.', logging: 0, scan: false, config: '.config.json'};
      const logFn = () => {};
      const handler = await router(flags, logFn);
      const server = http.createServer(handler);
      const port = randomPort();
      
      await new Promise(r => server.listen(port, r));
      await new Promise(r => setTimeout(r, 50));
      
      try {
        const response = await httpGet(`http://localhost:${port}/test.custom`);
        if (response.res.statusCode !== 200) {
          return fail('custom mime type should be served');
        }
        if (response.res.headers['content-type'] !== 'text/custom; charset=utf-8') {
          return fail('should use custom mime type with charset');
        }
        pass('default config file usage');
      } finally {
        server.close();
        process.chdir(prev);
      }
    });
  },

  'router uses custom config file with relative path': async ({pass, fail}) => {
    await withTempDir(async (dir) => {
      // Create a custom config file with different name
        const customConfig = {
          allowedMimes: {
            html: { mime: "text/html", encoding: "utf8" },
            special: { mime: "text/special", encoding: "utf8" }
          }
        };
      await write(dir, 'dev.config.json', JSON.stringify(customConfig));
      await write(dir, 'test.special', 'special content');
      
      const prev = process.cwd();
      process.chdir(dir);
      const flags = {root: '.', logging: 0, scan: false, config: 'dev.config.json'};
      const logFn = () => {};
      const handler = await router(flags, logFn);
      const server = http.createServer(handler);
      const port = randomPort();
      
      await new Promise(r => server.listen(port, r));
      await new Promise(r => setTimeout(r, 50));
      
      try {
        const response = await httpGet(`http://localhost:${port}/test.special`);
        if (response.res.statusCode !== 200) {
          return fail('custom config should be loaded');
        }
        if (response.res.headers['content-type'] !== 'text/special; charset=utf-8') {
          return fail('should use custom config mime type with charset');
        }
        pass('relative path config file usage');
      } finally {
        server.close();
        process.chdir(prev);
      }
    });
  },

  'router uses custom config file with absolute path': async ({pass, fail}) => {
    await withTempDir(async (dir) => {
      // Create a custom config file in different location
      const configDir = path.join(dir, 'configs');
        const customConfig = {
          allowedMimes: {
            html: { mime: "text/html", encoding: "utf8" },
            absolute: { mime: "text/absolute", encoding: "utf8" }
          }
        };
      const configPath = await write(configDir, 'prod.config.json', JSON.stringify(customConfig));
      await write(dir, 'test.absolute', 'absolute content');
      
      const prev = process.cwd();
      process.chdir(dir);
      const flags = {root: '.', logging: 0, scan: false, config: configPath};
      const logFn = () => {};
      const handler = await router(flags, logFn);
      const server = http.createServer(handler);
      const port = randomPort();
      
      await new Promise(r => server.listen(port, r));
      await new Promise(r => setTimeout(r, 50));
      
      try {
        const response = await httpGet(`http://localhost:${port}/test.absolute`);
        if (response.res.statusCode !== 200) {
          return fail('absolute config path should work');
        }
        if (response.res.headers['content-type'] !== 'text/absolute; charset=utf-8') {
          return fail('should use absolute config mime type with charset');
        }
        pass('absolute path config file usage');
      } finally {
        server.close();
        process.chdir(prev);
      }
    });
  },

  'router falls back to default config when custom config file missing': async ({pass, fail}) => {
    await withTempDir(async (dir) => {
      await write(dir, 'index.html', '<h1>Home</h1>');
      
      const prev = process.cwd();
      process.chdir(dir);
      // Point to non-existent config file
      const flags = {root: '.', logging: 0, scan: false, config: 'nonexistent.config.json'};
      const logFn = () => {};
      const handler = await router(flags, logFn);
      const server = http.createServer(handler);
      const port = randomPort();
      
      await new Promise(r => server.listen(port, r));
      await new Promise(r => setTimeout(r, 50));
      
      try {
        const response = await httpGet(`http://localhost:${port}/index.html`);
        if (response.res.statusCode !== 200) {
          return fail('should fall back to default config and serve HTML');
        }
        if (!response.body.toString().includes('<h1>Home</h1>')) {
          return fail('should serve the file content');
        }
        pass('fallback to default config when file missing');
      } finally {
        server.close();
        process.chdir(prev);
      }
    });
  },

  'router handles malformed config file gracefully': async ({pass, fail}) => {
    await withTempDir(async (dir) => {
      // Create malformed JSON config
      await write(dir, 'bad.config.json', '{ invalid json }');
      await write(dir, 'index.html', '<h1>Home</h1>');
      
      const prev = process.cwd();
      process.chdir(dir);
      const flags = {root: '.', logging: 0, scan: false, config: 'bad.config.json'};
      const logFn = () => {};
      const handler = await router(flags, logFn);
      const server = http.createServer(handler);
      const port = randomPort();
      
      await new Promise(r => server.listen(port, r));
      await new Promise(r => setTimeout(r, 50));
      
      try {
        const response = await httpGet(`http://localhost:${port}/index.html`);
        if (response.res.statusCode !== 200) {
          return fail('should fall back to default config with malformed JSON');
        }
        if (!response.body.toString().includes('<h1>Home</h1>')) {
          return fail('should serve the file content');
        }
        pass('graceful handling of malformed config');
      } finally {
        server.close();
        process.chdir(prev);
      }
    });
  },

  'router merges custom config with default config': async ({pass, fail}) => {
    await withTempDir(async (dir) => {
      // Create partial config that only overrides some settings
      const partialConfig = {
        allowedMimes: {
            custom: { mime: "text/custom", encoding: "utf8" }
        },
        maxRescanAttempts: 5
      };
      await write(dir, 'partial.config.json', JSON.stringify(partialConfig));
      await write(dir, 'test.js', 'console.log("test");'); // JS should still work from default config
      await write(dir, 'test.custom', 'custom content');
      
      const prev = process.cwd();
      process.chdir(dir);
      const flags = {root: '.', logging: 0, scan: false, config: 'partial.config.json'};
      const logFn = () => {};
      const handler = await router(flags, logFn);
      const server = http.createServer(handler);
      const port = randomPort();
      
      await new Promise(r => server.listen(port, r));
      await new Promise(r => setTimeout(r, 50));
      
      try {
        // Test that default config is still used for JS files
        const jsResponse = await httpGet(`http://localhost:${port}/test.js`);
        if (jsResponse.res.statusCode !== 200) {
          return fail('JS files should still be served from default config');
        }
        if (jsResponse.res.headers['content-type'] !== 'application/javascript') {
          return fail('should use default JS mime type');
        }
        
        // Test that custom config overrides work
        const customResponse = await httpGet(`http://localhost:${port}/test.custom`);
        if (customResponse.res.statusCode !== 200) {
          return fail('custom mime type should work');
        }
        if (customResponse.res.headers['content-type'] !== 'text/custom; charset=utf-8') {
          return fail('should use custom mime type with charset');
        }
        pass('config merging with defaults');
      } finally {
        server.close();
        process.chdir(prev);
      }
    });
  },

  'router throws error when config file is outside server root': async ({pass, fail, log}) => {
    await withTempDir(async (dir) => {
      // Create a config file outside the server root
      const configDir = path.join(dir, '..', 'config-outside-root');
      const configFilePath = await write(configDir, 'outside.config.json', '{"allowedMimes": {"test": "application/test"}}');
      
      // Create a file in the server root to verify it doesn't start
      await write(dir, 'index.html', '<h1>Home</h1>');
      
      const prev = process.cwd();
      process.chdir(dir);
      
      try {
        // Try to use config file outside server root with relative path
        const flags = {root: '.', logging: 0, scan: false, config: '../config-outside-root/outside.config.json'};
        
        log('Test setup:');
        log('dir: ' + dir);
        log('configDir: ' + configDir);
        log('configFilePath: ' + configFilePath);
        log('flags.root: ' + flags.root);
        log('flags.config: ' + flags.config);
        
        // Check if file exists
        const fs = await import('fs/promises');
        try {
          await fs.access(configFilePath);
          log('Config file exists at: ' + configFilePath);
        } catch (e) {
          log('Config file does NOT exist at: ' + configFilePath);
        }
        
        // This should throw an error
        await router(flags, log);
        
        // If we reach here, the test failed
        return fail('router should have thrown error for config file outside root');
      } catch (error) {
        log('Error caught: ' + error.message);
        // Verify the error message contains expected text
        if (!error.message.includes('Config file must be within the server root directory')) {
          return fail(`unexpected error message: ${error.message}`);
        }
        
        pass('router correctly throws error for config file outside server root');
      } finally {
        process.chdir(prev);
      }
    });
  }
};
