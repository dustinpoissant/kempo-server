import defaultConfig from '../src/defaultConfig.js';
import router from '../src/router.js';
import http from 'http';
import { mkdtemp, writeFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';

const withTempDir = async (callback) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'kempo-test-'));
  try {
    await callback(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
};

const write = async (dir, filename, content) => {
  const filePath = path.join(dir, filename);
  await writeFile(filePath, content, 'utf8');
  return filePath;
};

const httpGet = (url) => new Promise((resolve, reject) => {
  http.get(url, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => resolve({ res, data }));
  }).on('error', reject);
});

const randomPort = () => Math.floor(Math.random() * 10000) + 10000;

export default {
  'allowedMimes should merge with defaults, not replace them': async ({pass, fail}) => {
    await withTempDir(async (dir) => {
      const customConfig = {
        allowedMimes: {
          js: { mime: "text/javascript", encoding: "utf8" },
          mjs: { mime: "text/javascript", encoding: "utf8" }
        }
      };
      
  await write(dir, '.config.json', JSON.stringify(customConfig));
  await write(dir, 'test.css', 'body { color: red; }');
  await write(dir, 'test.js', 'console.log("test");');
  await write(dir, 'test.html', '<html></html>');
  // Check config merge for mime and encoding
  const mergedConfig = { ...defaultConfig.allowedMimes, ...customConfig.allowedMimes };
  if(mergedConfig.js.mime !== 'text/javascript' || mergedConfig.js.encoding !== 'utf8') return fail('js mime/encoding merge failed');
  if(mergedConfig.css.mime !== 'text/css' || mergedConfig.css.encoding !== 'utf8') return fail('css mime/encoding merge failed');
      
      const flags = {root: dir, logging: 0, config: '.config.json'};
      const logFn = () => {};
      const handler = await router(flags, logFn);
      const server = http.createServer(handler);
      const port = randomPort();
      
      await new Promise(r => server.listen(port, r));
      await new Promise(r => setTimeout(r, 50));
      
      try {
        const cssResponse = await httpGet(`http://localhost:${port}/test.css`);
        if(cssResponse.res.statusCode !== 200){
          return fail('CSS file should be served');
        }
        if(cssResponse.res.headers['content-type'] !== 'text/css; charset=utf-8'){
          return fail(`CSS should have text/css MIME type with charset, got: ${cssResponse.res.headers['content-type']}`);
        }
        
        const jsResponse = await httpGet(`http://localhost:${port}/test.js`);
        if(jsResponse.res.statusCode !== 200){
          return fail('JS file should be served');
        }
        if(jsResponse.res.headers['content-type'] !== 'text/javascript; charset=utf-8'){
          return fail(`JS should have custom text/javascript MIME type with charset, got: ${jsResponse.res.headers['content-type']}`);
        }
        
        const htmlResponse = await httpGet(`http://localhost:${port}/test.html`);
        if(htmlResponse.res.statusCode !== 200){
          return fail('HTML file should be served');
        }
        if(htmlResponse.res.headers['content-type'] !== 'text/html; charset=utf-8'){
          return fail(`HTML should have text/html MIME type with charset, got: ${htmlResponse.res.headers['content-type']}`);
        }
        
        pass('allowedMimes merges correctly with defaults');
      } finally {
        server.close();
      }
    });
  },

  'custom MIME types should override defaults': async ({pass, fail}) => {
    await withTempDir(async (dir) => {
      const customConfig = {
        allowedMimes: {
          js: { mime: "custom/javascript", encoding: "utf8" },
          custom: { mime: "application/custom", encoding: "utf8" }
        }
      };
      
      await write(dir, '.config.json', JSON.stringify(customConfig));
      await write(dir, 'test.js', 'console.log("test");');
      await write(dir, 'test.custom', 'custom content');
      
      const flags = {root: dir, logging: 0, config: '.config.json'};
      const logFn = () => {};
      const handler = await router(flags, logFn);
      const server = http.createServer(handler);
      const port = randomPort();
      
      await new Promise(r => server.listen(port, r));
      await new Promise(r => setTimeout(r, 50));
      
      try {
        const jsResponse = await httpGet(`http://localhost:${port}/test.js`);
        if(jsResponse.res.statusCode !== 200){
          return fail('JS file should be served');
        }
        if(jsResponse.res.headers['content-type'] !== 'custom/javascript'){
          return fail(`JS should have overridden MIME type custom/javascript, got: ${jsResponse.res.headers['content-type']}`);
        }
        const customResponse = await httpGet(`http://localhost:${port}/test.custom`);
        if(customResponse.res.statusCode !== 200){
          return fail('Custom file should be served');
        }
        if(customResponse.res.headers['content-type'] !== 'application/custom'){
          return fail(`Custom extension should have application/custom MIME type, got: ${customResponse.res.headers['content-type']}`);
        }
        
        pass('custom MIME types correctly override defaults');
      } finally {
        server.close();
      }
    });
  },

  'all default MIME types should be preserved when adding custom ones': async ({pass, fail}) => {
    await withTempDir(async (dir) => {
      const customConfig = {
        allowedMimes: {
          custom: { mime: "application/custom", encoding: "utf8" }
        }
      };
      
      await write(dir, '.config.json', JSON.stringify(customConfig));
      await write(dir, 'test.css', 'body {}');
      await write(dir, 'test.html', '<html></html>');
      await write(dir, 'test.json', '{}');
      await write(dir, 'test.svg', '<svg></svg>');
      await write(dir, 'test.png', 'fake png');
      await write(dir, 'test.custom', 'custom');
      
      const flags = {root: dir, logging: 0, config: '.config.json'};
      const logFn = () => {};
      const handler = await router(flags, logFn);
      const server = http.createServer(handler);
      const port = randomPort();
      
      await new Promise(r => server.listen(port, r));
      await new Promise(r => setTimeout(r, 50));
      
      try {
        const tests = [
          { file: 'test.css', expectedType: 'text/css; charset=utf-8' },
          { file: 'test.html', expectedType: 'text/html; charset=utf-8' },
          { file: 'test.json', expectedType: 'application/json' },
          { file: 'test.svg', expectedType: 'image/svg+xml' },
          { file: 'test.png', expectedType: 'image/png' },
          { file: 'test.custom', expectedType: 'application/custom' }
        ];
        
        for(const test of tests){
          const response = await httpGet(`http://localhost:${port}/${test.file}`);
          if(response.res.statusCode !== 200){
            return fail(`${test.file} should be served (status ${response.res.statusCode})`);
          }
          if(response.res.headers['content-type'] !== test.expectedType){
            return fail(`${test.file} should have ${test.expectedType} MIME type, got: ${response.res.headers['content-type']}`);
          }
        }
        
        pass('all default MIME types preserved when adding custom types');
      } finally {
        server.close();
      }
    });
  }
};
