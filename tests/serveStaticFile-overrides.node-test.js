import serveStaticFile from '../src/serveStaticFile.js';
import defaultConfig from '../src/defaultConfig.js';
import {createMockReq} from './utils/mock-req.js';
import {createMockRes} from './utils/mock-res.js';
import {withTestDir} from './utils/test-dir.js';
import {write} from './utils/file-writer.js';
import {log} from './utils/logging.js';

/*
  `serveStaticFile` is exported publicly (package exports "./serve-static-file") so callers that
  serve files from outside the static file scan — an extension gating downloads behind permissions,
  say — get identical Range/206 behavior instead of reimplementing it. Those callers decide their
  own headers, which is what `overrides` is for. These cover that contract; the range behavior
  itself is already covered by serveFile.node-test.js.
*/
export default {
  'contentType override replaces the extension-derived MIME': async ({pass, fail}) => {
    try {
      await withTestDir(async (dir) => {
        const cfg = JSON.parse(JSON.stringify(defaultConfig));
        const file = await write(dir, 'script.js', 'alert(1)');
        const res = createMockRes();
        await serveStaticFile(file, createMockReq(), res, cfg, log, {contentType: 'text/plain'});
        if(res.statusCode !== 200) return fail(`expected 200, got ${res.statusCode}`);
        if(res.getHeader('Content-Type') !== 'text/plain') return fail(`expected the override, got ${res.getHeader('Content-Type')}`);
      });
      pass('contentType override');
    } catch(e){ fail(e.message); }
  },
  'extra headers are merged into a 200 response': async ({pass, fail}) => {
    try {
      await withTestDir(async (dir) => {
        const cfg = JSON.parse(JSON.stringify(defaultConfig));
        const file = await write(dir, 'script.js', 'alert(1)');
        const res = createMockRes();
        await serveStaticFile(file, createMockReq(), res, cfg, log, {
          contentType: 'text/plain',
          headers: {'X-Content-Type-Options': 'nosniff'}
        });
        if(res.getHeader('X-Content-Type-Options') !== 'nosniff') return fail('nosniff header should be present');
        if(res.getHeader('Content-Type') !== 'text/plain') return fail('content type should survive the merge');
      });
      pass('headers merged on 200');
    } catch(e){ fail(e.message); }
  },
  'extra headers are merged into a 206 response and the override still applies': async ({pass, fail}) => {
    try {
      await withTestDir(async (dir) => {
        const cfg = JSON.parse(JSON.stringify(defaultConfig));
        const content = Buffer.from('0123456789');
        const file = await write(dir, 'clip.mp4', content);
        const res = createMockRes();
        const req = createMockReq({headers: {range: 'bytes=2-4'}});
        await serveStaticFile(file, req, res, cfg, log, {
          contentType: 'application/octet-stream',
          headers: {'X-Gated-By': 'test'}
        });
        if(res.statusCode !== 206) return fail(`expected 206, got ${res.statusCode}`);
        if(res.getHeader('X-Gated-By') !== 'test') return fail('extra header should survive on a range response');
        if(res.getHeader('Content-Type') !== 'application/octet-stream') return fail('override should apply on a range response');
        if(res.getBody().toString() !== '234') return fail(`wrong slice: ${res.getBody().toString()}`);
      });
      pass('headers merged on 206');
    } catch(e){ fail(e.message); }
  },
  'overrides cannot clobber Content-Range on a partial response': async ({pass, fail}) => {
    try {
      await withTestDir(async (dir) => {
        const cfg = JSON.parse(JSON.stringify(defaultConfig));
        await write(dir, 'clip.mp4', Buffer.from('0123456789'));
        const res = createMockRes();
        const req = createMockReq({headers: {range: 'bytes=2-4'}});
        await serveStaticFile(`${dir}/clip.mp4`, req, res, cfg, log, {
          headers: {'Content-Range': 'bytes 0-0/1', 'Accept-Ranges': 'none'}
        });
        if(res.getHeader('Content-Range') !== 'bytes 2-4/10') return fail('range metadata must win over caller headers');
        if(res.getHeader('Accept-Ranges') !== 'bytes') return fail('Accept-Ranges must win over caller headers');
      });
      pass('range metadata protected');
    } catch(e){ fail(e.message); }
  },
  'works without a log function or allowedMimes when contentType is overridden': async ({pass, fail}) => {
    try {
      await withTestDir(async (dir) => {
        const file = await write(dir, 'model.weird', 'body');
        const res = createMockRes();
        await serveStaticFile(file, createMockReq(), res, {}, undefined, {contentType: 'text/plain'});
        if(res.statusCode !== 200) return fail(`expected 200, got ${res.statusCode}`);
        if(res.getHeader('Content-Type') !== 'text/plain') return fail('override should apply with no mime config');
      });
      pass('no log or mimes needed');
    } catch(e){ fail(e.message); }
  },
  'unknown extension with no override still falls back to octet-stream': async ({pass, fail}) => {
    try {
      await withTestDir(async (dir) => {
        const cfg = JSON.parse(JSON.stringify(defaultConfig));
        const file = await write(dir, 'thing.unknownext', 'body');
        const res = createMockRes();
        await serveStaticFile(file, createMockReq(), res, cfg, log);
        if(res.getHeader('Content-Type') !== 'application/octet-stream') return fail(`got ${res.getHeader('Content-Type')}`);
      });
      pass('default preserved');
    } catch(e){ fail(e.message); }
  }
};
