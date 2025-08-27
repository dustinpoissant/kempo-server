import serveFile from '../serveFile.js';
import findFile from '../findFile.js';
import defaultConfig from '../defaultConfig.js';
import path from 'path';
import {createMockReq, createMockRes, withTempDir, write, log} from './test-utils.js';

export default {
  'serves static file with correct mime': async ({pass, fail}) => {
    try {
      await withTempDir(async (dir) => {
        const cfg = JSON.parse(JSON.stringify(defaultConfig));
        await write(dir, 'index.html', '<h1>Hi</h1>');
        const files = [path.join(dir, 'index.html')];
        const res = createMockRes();
        const ok = await serveFile(files, dir, '/index.html', 'GET', cfg, createMockReq(), res, log);
        if(ok !== true) return fail('should serve');
        if(res.statusCode !== 200) return fail('status');
        if(res.getHeader('Content-Type') !== 'text/html') return fail('mime');
      });
      pass('static');
    } catch(e){ fail(e.message); }
  },
  'executes route files by calling default export': async ({pass, fail}) => {
    try {
      await withTempDir(async (dir) => {
        const cfg = JSON.parse(JSON.stringify(defaultConfig));
        await write(dir, 'api/GET.js', "export default async (req, res) => { res.status(201).json({ok:true, params:req.params}); }\n");
        const files = [path.join(dir, 'api/GET.js')];
        const res = createMockRes();
        const ok = await serveFile(files, dir, '/api', 'GET', cfg, createMockReq(), res, log);
        if(ok !== true) return fail('served route');
        if(res.statusCode !== 201) return fail('route status');
        if(!res.getBody().toString().includes('ok')) return fail('body contains ok');
      });
      pass('route exec');
    } catch(e){ fail(e.message); }
  },
  'handles route file without default function': async ({pass, fail}) => {
    try {
      await withTempDir(async (dir) => {
        const cfg = JSON.parse(JSON.stringify(defaultConfig));
        await write(dir, 'api/GET.js', "export const x = 1;\n");
        const files = [path.join(dir, 'api/GET.js')];
        const res = createMockRes();
        const ok = await serveFile(files, dir, '/api', 'GET', cfg, createMockReq(), res, log);
        if(ok !== true) return fail('handled');
        if(res.statusCode !== 500) return fail('500');
      });
      pass('route no default');
    } catch(e){ fail(e.message); }
  }
};
