import findFile from '../src/findFile.js';
import path from 'path';

const toAbs = (root, p) => path.join(root, p);

export default {
  'exact match returns file': async ({pass, fail, log}) => {
    try {
      const root = path.join(process.cwd(), 'tmp-root');
      const files = [toAbs(root, 'a/b/GET.js')];
      const [file, params] = await findFile(files, root, '/a/b/GET.js', 'GET', log);
      if(file !== files[0]) throw new Error('not exact');
      if(Object.keys(params).length !== 0) throw new Error('params present');
      pass('exact');
    } catch(e){ fail(e.message); }
  },
  'directory index prioritization and method specific': async ({pass, fail, log}) => {
    try {
  const root = path.join(process.cwd(), 'tmp-root');
  const files = ['a/index.html', 'a/GET.js', 'a/index.js'].map(p => toAbs(root, p));
  const [file] = await findFile(files, root, '/a', 'GET', log);
  if(!file || path.basename(file) !== 'GET.js') throw new Error('priority not respected');
      pass('dir index');
    } catch(e){ fail(e.message); }
  },
  'dynamic match with params and best priority': async ({pass, fail, log}) => {
    try {
  const root = path.join(process.cwd(), 'tmp-root');
      const files = ['user/[id]/GET.js', 'user/[id]/index.html', 'user/[id]/index.js'].map(p => toAbs(root, p));
  const [file, params] = await findFile(files, root, '/user/42', 'GET', log);
  if(!file || path.basename(file) !== 'GET.js') throw new Error('did not pick GET.js');
      if(params.id !== '42') throw new Error('param missing');
      pass('dynamic');
    } catch(e){ fail(e.message); }
  },
  'no match returns false and empty params': async ({pass, fail, log}) => {
    try {
  const root = path.join(process.cwd(), 'tmp-root');
      const files = ['x/y/index.html'].map(p => toAbs(root, p));
      const [file, params] = await findFile(files, root, '/nope', 'GET', log);
      if(file !== false) throw new Error('should be false');
      if(Object.keys(params).length !== 0) throw new Error('params not empty');
      pass('no match');
    } catch(e){ fail(e.message); }
  }
};
