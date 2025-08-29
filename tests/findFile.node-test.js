import findFile from '../src/findFile.js';
import path from 'path';

const toAbs = (root, p) => path.join(root, p);

export default {
  'exact match returns file': async ({pass, fail}) => {
    const root = path.join(process.cwd(), 'tmp-root');
    const files = [toAbs(root, 'a/b/GET.js')];
    const [file, params] = await findFile(files, root, '/a/b/GET.js', 'GET', () => {});
    
    if(file !== files[0]) return fail('not exact');
    if(Object.keys(params).length !== 0) return fail('params present');
    
    pass('exact');
  },
  'directory index prioritization and method specific': async ({pass, fail}) => {
    const root = path.join(process.cwd(), 'tmp-root');
    const files = ['a/index.html', 'a/GET.js', 'a/index.js'].map(p => toAbs(root, p));
    const [file] = await findFile(files, root, '/a', 'GET', () => {});
    
    if(!file || path.basename(file) !== 'GET.js') return fail('priority not respected');
    
    pass('dir index');
  },
  'dynamic match with params and best priority': async ({pass, fail}) => {
    const root = path.join(process.cwd(), 'tmp-root');
    const files = ['user/[id]/GET.js', 'user/[id]/index.html', 'user/[id]/index.js'].map(p => toAbs(root, p));
    const [file, params] = await findFile(files, root, '/user/42', 'GET', () => {});
    
    if(!file || path.basename(file) !== 'GET.js') return fail('did not pick GET.js');
    if(params.id !== '42') return fail('param missing');
    
    pass('dynamic');
  },
  'no match returns false and empty params': async ({pass, fail}) => {
    const root = path.join(process.cwd(), 'tmp-root');
    const files = ['x/y/index.html'].map(p => toAbs(root, p));
    const [file, params] = await findFile(files, root, '/nope', 'GET', () => {});
    
    if(file !== false) return fail('should be false');
    if(Object.keys(params).length !== 0) return fail('params not empty');
    
    pass('no match');
  }
};
