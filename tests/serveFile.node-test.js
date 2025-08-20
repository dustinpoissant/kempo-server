import serveFile from '../serveFile.js';
import findFile from '../findFile.js';
import defaultConfig from '../defaultConfig.js';
import path from 'path';
import {createMockReq, createMockRes, withTempDir, write, expect, log} from './test-utils.js';

export default {
  'serves static file with correct mime': async ({pass, fail}) => {
    try {
      await withTempDir(async (dir) => {
        const cfg = JSON.parse(JSON.stringify(defaultConfig));
        await write(dir, 'index.html', '<h1>Hi</h1>');
        const files = [path.join(dir, 'index.html')];
        const res = createMockRes();
        const ok = await serveFile(files, dir, '/index.html', 'GET', cfg, createMockReq(), res, log);
        expect(ok === true, 'should serve');
        expect(res.statusCode === 200, 'status');
        expect(res.getHeader('Content-Type') === 'text/html', 'mime');
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
        expect(ok === true, 'served route');
        expect(res.statusCode === 201, 'route status');
        expect(res.getBody().toString().includes('ok'), 'body contains ok');
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
        expect(ok === true, 'handled');
        expect(res.statusCode === 500, '500');
      });
      pass('route no default');
    } catch(e){ fail(e.message); }
  }
};
