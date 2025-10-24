import serveFile from '../src/serveFile.js';
import findFile from '../src/findFile.js';
import defaultConfig from '../src/defaultConfig.js';
import path from 'path';
import {createMockReq} from './utils/mock-req.js';
import {createMockRes} from './utils/mock-res.js';
import {withTestDir} from './utils/test-dir.js';
import {write} from './utils/file-writer.js';
import {log} from './utils/logging.js';

export default {
  'serves static file with correct mime': async ({pass, fail}) => {
    try {
      await withTestDir(async (dir) => {
        const cfg = JSON.parse(JSON.stringify(defaultConfig));
        const files = [path.join(dir, 'index.html')];
        const res = createMockRes();
        const ok = await serveFile(files, dir, '/index.html', 'GET', cfg, createMockReq(), res, log);
        if(ok !== true) return fail('should serve');
        if(res.statusCode !== 200) return fail('status');
        if(res.getHeader('Content-Type') !== 'text/html; charset=utf-8') return fail('mime');
      });
      pass('static');
    } catch(e){ fail(e.message); }
  },
  'executes route files by calling default export': async ({pass, fail}) => {
    try {
      await withTestDir(async (dir) => {
        const cfg = JSON.parse(JSON.stringify(defaultConfig));
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
      await withTestDir(async (dir) => {
        const cfg = JSON.parse(JSON.stringify(defaultConfig));
        const files = [path.join(dir, 'api/no-default.js')];
        const res = createMockRes();
        const ok = await serveFile(files, dir, '/api', 'GET', cfg, createMockReq(), res, log);
        if(ok !== true) return fail('handled');
        if(res.statusCode !== 500) return fail('500');
      });
      pass('route no default');
    } catch(e){ fail(e.message); }
  }
};
