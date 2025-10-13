import findFile from '../src/findFile.js';
import path from 'path';

export default {
  'should resolve directory to index.html with trailing slash': async ({pass, fail, log}) => {
    const root = path.join(process.cwd(), 'tests', 'test-server-root');
    const files = [
      path.join(root, 'sub-dir', 'index.html'),
      path.join(root, 'index.html'),
      path.join(root, 'hello.html')
    ];
    
    log('Testing /sub-dir/ (with trailing slash)');
    const [file, params] = findFile(files, root, '/sub-dir/', 'GET', () => {});
    
    if (!file) {
      return fail('No file found for /sub-dir/ request');
    }
    
    if (path.basename(file) !== 'index.html') {
      return fail(`Expected index.html, got ${path.basename(file)}`);
    }
    
    const relativePath = path.relative(root, file);
    if (relativePath !== path.join('sub-dir', 'index.html')) {
      return fail(`Expected sub-dir/index.html, got ${relativePath}`);
    }
    
    pass('Directory with trailing slash correctly resolves to index.html');
  },
  
  'should resolve directory to index.html without trailing slash': async ({pass, fail, log}) => {
    const root = path.join(process.cwd(), 'tests', 'test-server-root');
    const files = [
      path.join(root, 'sub-dir', 'index.html'),
      path.join(root, 'index.html'),
      path.join(root, 'hello.html')
    ];
    
    log('Testing /sub-dir (without trailing slash)');
    const [file, params] = findFile(files, root, '/sub-dir', 'GET', () => {});
    
    if (!file) {
      return fail('No file found for /sub-dir request');
    }
    
    if (path.basename(file) !== 'index.html') {
      return fail(`Expected index.html, got ${path.basename(file)}`);
    }
    
    const relativePath = path.relative(root, file);
    if (relativePath !== path.join('sub-dir', 'index.html')) {
      return fail(`Expected sub-dir/index.html, got ${relativePath}`);
    }
    
    pass('Directory without trailing slash correctly resolves to index.html');
  },
  
  'should prioritize GET.js over index.html for directory requests': async ({pass, fail, log}) => {
    const root = path.join(process.cwd(), 'tests', 'test-server-root');
    const files = [
      path.join(root, 'sub-dir', 'GET.js'),
      path.join(root, 'sub-dir', 'index.html'),
      path.join(root, 'index.html')
    ];
    
    log('Testing GET method priority with both GET.js and index.html present');
    const [file, params] = findFile(files, root, '/sub-dir/', 'GET', () => {});
    
    if (!file) {
      return fail('No file found for /sub-dir/ request');
    }
    
    if (path.basename(file) !== 'GET.js') {
      return fail(`Expected GET.js to take priority, got ${path.basename(file)}`);
    }
    
    pass('GET.js correctly takes priority over index.html');
  },
  
  'should resolve root directory to index.html': async ({pass, fail, log}) => {
    const root = path.join(process.cwd(), 'tests', 'test-server-root');
    const files = [
      path.join(root, 'index.html'),
      path.join(root, 'hello.html'),
      path.join(root, 'sub-dir', 'index.html')
    ];
    
    log('Testing root directory /');
    const [file, params] = findFile(files, root, '/', 'GET', () => {});
    
    if (!file) {
      return fail('No file found for / request');
    }
    
    if (path.basename(file) !== 'index.html') {
      return fail(`Expected index.html, got ${path.basename(file)}`);
    }
    
    const relativePath = path.relative(root, file);
    if (relativePath !== 'index.html') {
      return fail(`Expected root index.html, got ${relativePath}`);
    }
    
    pass('Root directory correctly resolves to index.html');
  },
  
  'should handle nested directory structures': async ({pass, fail, log}) => {
    const root = path.join(process.cwd(), 'tests', 'test-server-root');
    const files = [
      path.join(root, 'docs', 'api', 'data.json'),
      path.join(root, 'docs', 'src', 'components', 'Button.js'),
      path.join(root, 'src', 'components', 'Button.js'),
      path.join(root, 'src', 'components', 'index.html')
    ];
    
    log('Testing nested directory /src/components/');
    const [file, params] = findFile(files, root, '/src/components/', 'GET', () => {});
    
    if (!file) {
      return fail('No file found for /src/components/ request');
    }
    
    if (path.basename(file) !== 'index.html') {
      return fail(`Expected index.html, got ${path.basename(file)}`);
    }
    
    const relativePath = path.relative(root, file);
    const expected = path.join('src', 'components', 'index.html');
    if (relativePath !== expected) {
      return fail(`Expected ${expected}, got ${relativePath}`);
    }
    
    pass('Nested directory correctly resolves to index.html');
  },
  
  'should return false when no index file exists in directory': async ({pass, fail, log}) => {
    const root = path.join(process.cwd(), 'tests', 'test-server-root');
    const files = [
      path.join(root, 'index.html'),
      path.join(root, 'hello.html'),
      path.join(root, 'b', '1.txt') // b directory has no index file
    ];
    
    log('Testing directory with no index file /nonexistent/');
    const [file, params] = findFile(files, root, '/nonexistent/', 'GET', () => {});
    
    if (file !== false) {
      return fail(`Expected false, got ${file}`);
    }
    
    pass('Directory with no index file correctly returns false');
  }
};