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
        const req = createMockReq();
        req._bufferedBody = '';
        const ok = await serveFile(files, dir, '/api', 'GET', cfg, req, res, log);
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
        const req = createMockReq();
        req._bufferedBody = '';
        const ok = await serveFile(files, dir, '/api', 'GET', cfg, req, res, log);
        if(ok !== true) return fail('handled');
        if(res.statusCode !== 500) return fail('500');
      });
      pass('route no default');
    } catch(e){ fail(e.message); }
  },
  'static text file has no Accept-Ranges header and ignores Range requests': async ({pass, fail}) => {
    try {
      await withTestDir(async (dir) => {
        const cfg = JSON.parse(JSON.stringify(defaultConfig));
        const files = [path.join(dir, 'index.html')];
        const res = createMockRes();
        const req = createMockReq({headers: {range: 'bytes=0-3'}});
        const ok = await serveFile(files, dir, '/index.html', 'GET', cfg, req, res, log);
        if(ok !== true) return fail('should serve');
        if(res.statusCode !== 200) return fail(`expected 200, got ${res.statusCode}`);
        if(res.getHeader('Accept-Ranges')) return fail('text files should not advertise Accept-Ranges');
      });
      pass('text ignores range');
    } catch(e){ fail(e.message); }
  },
  'binary file without Range header serves full content and advertises Accept-Ranges': async ({pass, fail}) => {
    try {
      await withTestDir(async (dir) => {
        const cfg = JSON.parse(JSON.stringify(defaultConfig));
        const content = Buffer.from('0123456789');
        await write(dir, 'video.mp4', content);
        const files = [path.join(dir, 'video.mp4')];
        const res = createMockRes();
        const req = createMockReq();
        const ok = await serveFile(files, dir, '/video.mp4', 'GET', cfg, req, res, log);
        if(ok !== true) return fail('should serve');
        if(res.statusCode !== 200) return fail(`expected 200, got ${res.statusCode}`);
        if(res.getHeader('Accept-Ranges') !== 'bytes') return fail('binary files should advertise Accept-Ranges: bytes');
        if(!res.getBody().equals(content)) return fail('full content should be served when no Range header is sent');
      });
      pass('binary full content');
    } catch(e){ fail(e.message); }
  },
  'binary file with Range header serves 206 Partial Content with the requested slice': async ({pass, fail}) => {
    try {
      await withTestDir(async (dir) => {
        const cfg = JSON.parse(JSON.stringify(defaultConfig));
        const content = Buffer.from('0123456789');
        await write(dir, 'video.mp4', content);
        const files = [path.join(dir, 'video.mp4')];
        const res = createMockRes();
        const req = createMockReq({headers: {range: 'bytes=2-4'}});
        const ok = await serveFile(files, dir, '/video.mp4', 'GET', cfg, req, res, log);
        if(ok !== true) return fail('should serve');
        if(res.statusCode !== 206) return fail(`expected 206, got ${res.statusCode}`);
        if(res.getHeader('Content-Range') !== 'bytes 2-4/10') return fail(`unexpected Content-Range: ${res.getHeader('Content-Range')}`);
        if(res.getHeader('Content-Length') !== 3) return fail(`unexpected Content-Length: ${res.getHeader('Content-Length')}`);
        if(res.getBody().toString() !== '234') return fail(`unexpected body: ${res.getBody().toString()}`);
      });
      pass('binary partial content');
    } catch(e){ fail(e.message); }
  },
  'binary file with open-ended Range header serves to end of file': async ({pass, fail}) => {
    try {
      await withTestDir(async (dir) => {
        const cfg = JSON.parse(JSON.stringify(defaultConfig));
        const content = Buffer.from('0123456789');
        await write(dir, 'video.mp4', content);
        const files = [path.join(dir, 'video.mp4')];
        const res = createMockRes();
        const req = createMockReq({headers: {range: 'bytes=7-'}});
        const ok = await serveFile(files, dir, '/video.mp4', 'GET', cfg, req, res, log);
        if(ok !== true) return fail('should serve');
        if(res.statusCode !== 206) return fail(`expected 206, got ${res.statusCode}`);
        if(res.getHeader('Content-Range') !== 'bytes 7-9/10') return fail(`unexpected Content-Range: ${res.getHeader('Content-Range')}`);
        if(res.getBody().toString() !== '789') return fail(`unexpected body: ${res.getBody().toString()}`);
      });
      pass('binary open-ended range');
    } catch(e){ fail(e.message); }
  },
  'binary file with suffix Range header serves the last N bytes': async ({pass, fail}) => {
    try {
      await withTestDir(async (dir) => {
        const cfg = JSON.parse(JSON.stringify(defaultConfig));
        const content = Buffer.from('0123456789');
        await write(dir, 'video.mp4', content);
        const files = [path.join(dir, 'video.mp4')];
        const res = createMockRes();
        const req = createMockReq({headers: {range: 'bytes=-3'}});
        const ok = await serveFile(files, dir, '/video.mp4', 'GET', cfg, req, res, log);
        if(ok !== true) return fail('should serve');
        if(res.statusCode !== 206) return fail(`expected 206, got ${res.statusCode}`);
        if(res.getHeader('Content-Range') !== 'bytes 7-9/10') return fail(`unexpected Content-Range: ${res.getHeader('Content-Range')}`);
        if(res.getBody().toString() !== '789') return fail(`unexpected body: ${res.getBody().toString()}`);
      });
      pass('binary suffix range');
    } catch(e){ fail(e.message); }
  },
  'binary file with unsatisfiable Range header returns 416': async ({pass, fail}) => {
    try {
      await withTestDir(async (dir) => {
        const cfg = JSON.parse(JSON.stringify(defaultConfig));
        const content = Buffer.from('0123456789');
        await write(dir, 'video.mp4', content);
        const files = [path.join(dir, 'video.mp4')];
        const res = createMockRes();
        const req = createMockReq({headers: {range: 'bytes=50-60'}});
        const ok = await serveFile(files, dir, '/video.mp4', 'GET', cfg, req, res, log);
        if(ok !== true) return fail('should be handled');
        if(res.statusCode !== 416) return fail(`expected 416, got ${res.statusCode}`);
        if(res.getHeader('Content-Range') !== 'bytes */10') return fail(`unexpected Content-Range: ${res.getHeader('Content-Range')}`);
      });
      pass('binary unsatisfiable range');
    } catch(e){ fail(e.message); }
  }
};
