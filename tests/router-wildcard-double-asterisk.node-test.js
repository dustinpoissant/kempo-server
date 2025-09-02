import http from 'http';
import path from 'path';
import {withTempDir, write, randomPort, httpGet, log} from './test-utils.js';
import router from '../src/router.js';

export default {
  'double asterisk wildcard routes serve nested files': async ({pass, fail, log}) => {
    try {
      await withTempDir(async (dir) => {
        // Create nested file structure in source directory
        const fileA = await write(dir, 'src/components/Button.js', 'export default Button');
        const fileB = await write(dir, 'src/utils/helpers/format.js', 'export const format = () => {}');
        const fileC = await write(dir, 'src/deep/nested/folder/file.js', 'export const deep = true');
        
        // Create files in docs directory that should be ignored when custom routes match
        await write(dir, 'docs/src/components/Button.js', '// WRONG FILE');
        await write(dir, 'docs/src/utils/helpers/format.js', '// WRONG FILE');
        
        const prev = process.cwd();
        process.chdir(dir);
        
        const flags = {root: 'docs', logging: 0, scan: false};
        const logFn = () => {};
        
        // Configure double asterisk wildcard route
        const config = {
          customRoutes: {
            '/src/**': '../src/**'
          }
        };
        
        await write(dir, 'docs/.config.json', JSON.stringify(config));
        const handler = await router(flags, logFn);
        const server = http.createServer(handler);
        const port = randomPort();
        
        await new Promise(r => server.listen(port, r));
        await new Promise(r => setTimeout(r, 50));
        
        try {
          // Test nested component file
          const r1 = await httpGet(`http://localhost:${port}/src/components/Button.js`);
          log('nested component status: ' + r1.res.statusCode);
          if(r1.res.statusCode !== 200) throw new Error('nested component 200');
          if(r1.body.toString() !== 'export default Button') throw new Error('nested component content');
          
          // Test deeply nested helper file  
          const r2 = await httpGet(`http://localhost:${port}/src/utils/helpers/format.js`);
          log('deeply nested helper status: ' + r2.res.statusCode);
          if(r2.res.statusCode !== 200) throw new Error('deeply nested helper 200');
          if(r2.body.toString() !== 'export const format = () => {}') throw new Error('deeply nested helper content');
          
          // Test very deep file
          const r3 = await httpGet(`http://localhost:${port}/src/deep/nested/folder/file.js`);
          log('very deep file status: ' + r3.res.statusCode);
          if(r3.res.statusCode !== 200) throw new Error('very deep file 200');
          if(r3.body.toString() !== 'export const deep = true') throw new Error('very deep file content');
          
        } finally { 
          server.close(); 
          process.chdir(prev); 
        }
      });
      pass('double asterisk wildcard routes work correctly');
    } catch(e){ 
      fail(e.message); 
    }
  },
  
  'single asterisk only matches single path segments': async ({pass, fail, log}) => {
    try {
      await withTempDir(async (dir) => {
        // Create files at different nesting levels
        await write(dir, 'src/file.js', '// single level');
        await write(dir, 'src/nested/file.js', '// nested level');
        
        // Create docs directory with fallback file
        await write(dir, 'docs/src/nested/file.js', '// fallback file');
        
        const prev = process.cwd();
        process.chdir(dir);
        
        const flags = {root: 'docs', logging: 0, scan: false};
        const logFn = () => {};
        
        // Configure single asterisk wildcard route
        const config = {
          customRoutes: {
            '/src/*': '../src/*'
          }
        };
        
        await write(dir, 'docs/.config.json', JSON.stringify(config));
        const handler = await router(flags, logFn);
        const server = http.createServer(handler);
        const port = randomPort();
        
        await new Promise(r => server.listen(port, r));
        await new Promise(r => setTimeout(r, 50));
        
        try {
          // Single level should work with single asterisk
          const r1 = await httpGet(`http://localhost:${port}/src/file.js`);
          log('single level status: ' + r1.res.statusCode);
          if(r1.res.statusCode !== 200) throw new Error('single level 200');
          if(r1.body.toString() !== '// single level') throw new Error('single level content');
          
          // Nested level should NOT work with single asterisk, should fall back to docs
          const r2 = await httpGet(`http://localhost:${port}/src/nested/file.js`);
          log('nested level status: ' + r2.res.statusCode);
          if(r2.res.statusCode !== 200) throw new Error('nested level 200');
          if(r2.body.toString() !== '// fallback file') throw new Error('nested level should use fallback');
          
        } finally { 
          server.close(); 
          process.chdir(prev); 
        }
      });
      pass('single asterisk correctly limited to single segments');
    } catch(e){ 
      fail(e.message); 
    }
  },
  
  'wildcard routes take precedence over static files': async ({pass, fail, log}) => {
    try {
      await withTempDir(async (dir) => {
        // Create static file in docs
        await write(dir, 'docs/api/data.json', '{"source": "static"}');
        
        // Create custom file outside docs
        await write(dir, 'custom/data.json', '{"source": "custom"}');
        
        const prev = process.cwd();
        process.chdir(dir);
        
        const flags = {root: 'docs', logging: 0, scan: false};
        const logFn = () => {};
        
        // Configure wildcard route that overrides static file
        const config = {
          customRoutes: {
            '/api/**': '../custom/**'
          }
        };
        
        await write(dir, 'docs/.config.json', JSON.stringify(config));
        const handler = await router(flags, logFn);
        const server = http.createServer(handler);
        const port = randomPort();
        
        await new Promise(r => server.listen(port, r));
        await new Promise(r => setTimeout(r, 50));
        
        try {
          const response = await httpGet(`http://localhost:${port}/api/data.json`);
          log('precedence test status: ' + response.res.statusCode);
          if(response.res.statusCode !== 200) throw new Error('precedence 200');
          
          const data = JSON.parse(response.body.toString());
          if(data.source !== 'custom') throw new Error('should serve custom, not static');
          
        } finally { 
          server.close(); 
          process.chdir(prev); 
        }
      });
      pass('wildcard routes correctly override static files');
    } catch(e){ 
      fail(e.message); 
    }
  },

  'wildcard routes serve nested files from server root': async ({pass, fail, log}) => {
    try {
      await withTempDir(async (dir) => {
        // Create additional test files needed for this specific test
        await write(dir, 'src/components/Import.js', 'export default ImportComponent');
        await write(dir, 'src/utils/helpers.js', 'export const helpers = {}');
        await write(dir, 'src/deep/nested/file.js', 'export const deep = true');
        await write(dir, 'index.html', '<html><body>Test Index</body></html>');
        
        const prev = process.cwd();
        process.chdir(dir);
        
        // Server root is the current directory (dir)
        const flags = {root: '.', logging: 0, scan: false};
        const logFn = () => {};
        
        // Configure wildcard route to serve from ./src/**
        const config = {
          customRoutes: {
            '/src/**': './src/**'
          }
        };
        
        await write(dir, '.config.json', JSON.stringify(config));
        const handler = await router(flags, logFn);
        const server = http.createServer(handler);
        const port = randomPort();
        
        await new Promise(r => server.listen(port, r));
        await new Promise(r => setTimeout(r, 50));
        
        try {
          // Test that /src/components/Import.js is served correctly
          const r1 = await httpGet(`http://localhost:${port}/src/components/Import.js`);
          log('Import.js status: ' + r1.res.statusCode);
          if(r1.res.statusCode !== 200) throw new Error(`Expected 200, got ${r1.res.statusCode}`);
          if(r1.body.toString() !== 'export default ImportComponent') throw new Error('Import.js content mismatch');
          
          // Test deeper nested file
          const r2 = await httpGet(`http://localhost:${port}/src/utils/helpers.js`);
          log('helpers.js status: ' + r2.res.statusCode);
          if(r2.res.statusCode !== 200) throw new Error(`Expected 200 for helpers.js, got ${r2.res.statusCode}`);
          
          // Test very deeply nested file
          const r3 = await httpGet(`http://localhost:${port}/src/deep/nested/file.js`);
          log('deep nested file status: ' + r3.res.statusCode);
          if(r3.res.statusCode !== 200) throw new Error(`Expected 200 for deep nested file, got ${r3.res.statusCode}`);
          if(r3.body.toString() !== 'export const deep = true') throw new Error('Deep nested file content mismatch');
          
          // Test that index.html still works (non-wildcard route)
          const r4 = await httpGet(`http://localhost:${port}/index.html`);
          log('index.html status: ' + r4.res.statusCode);
          if(r4.res.statusCode !== 200) throw new Error(`Expected 200 for index.html, got ${r4.res.statusCode}`);
          
        } finally { 
          server.close(); 
          process.chdir(prev); 
        }
      });
      pass('wildcard routes serve nested files from server root');
    } catch(e){ 
      fail(e.message); 
    }
  }
};
