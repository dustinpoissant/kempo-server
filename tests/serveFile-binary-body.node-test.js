import http from 'http';
import {withTempDir} from './utils/temp-dir.js';
import {write} from './utils/file-writer.js';
import {randomPort} from './utils/port.js';
import router from '../src/router.js';

/*
  router-binary-body.node-test.js proves request bodies survive intact, but every one of its
  requests goes through a customRoutes entry, which routes through router.js's own
  executeRouteModule — a second, separate call site for readRawBody(req, config.maxBodySize).
  Nothing exercised the far more common case: a plain POST.js route sitting directly in the
  project's own file tree, dispatched through serveFile.js instead.

  That path is not just "the same code, different config" — readRawBody's early return
  (`if(req._bufferedBody !== undefined) return Promise.resolve(req._bufferedBody)`) is the only
  thing standing between it and re-attaching 'data'/'end' listeners to a request stream the router
  already fully drained upstream. Node never replays 'end' for a listener added after it already
  fired, so if that short-circuit ever broke, a route reached this way would not corrupt its body —
  it would hang forever waiting for bytes that already arrived. This exists so that failure mode,
  and plain binary corruption, both fail a `npm test` run instead of only showing up on a route
  nobody happened to put behind a customRoutes entry first.
*/

const post = (port, path, body, headers = {}) => new Promise((resolve, reject) => {
  const payload = Buffer.isBuffer(body) ? body : Buffer.from(body);
  const req = http.request({
    hostname: '127.0.0.1',
    port,
    path,
    method: 'POST',
    headers: {'Content-Length': payload.length, ...headers}
  }, res => {
    const chunks = [];
    res.on('data', c => chunks.push(c));
    res.on('end', () => resolve({res, body: Buffer.concat(chunks)}));
  });
  req.on('error', reject);
  req.write(payload);
  req.end();
});

const ECHO_ROUTE = `export default async (request, response) => {
  const buf = await request.buffer();
  response.status(200).json({ hex: buf.toString('hex') });
};`;

// No customRoutes anywhere in this config — api/echo/POST.js is found by the ordinary directory
// scan and dispatched through serveFile.js, never through executeRouteModule.
const withServer = fn => withTempDir(async (dir) => {
  await write(dir, 'site/api/echo/POST.js', ECHO_ROUTE);
  await write(dir, 'site/index.html', '<html></html>');

  const prev = process.cwd();
  process.chdir(dir);
  const handler = await router({root: 'site', logging: 0}, () => {});
  const server = http.createServer(handler);
  const port = randomPort();
  await new Promise(r => server.listen(port, r));
  await new Promise(r => setTimeout(r, 50));
  try {
    return await fn(port);
  } finally {
    server.close();
    process.chdir(prev);
  }
});

export default {
  'a plain file-tree POST route receives a binary body byte for byte': async ({pass, fail, log}) => {
    try {
      // Same fixture as router-binary-body.node-test.js: no byte sequence here is valid UTF-8.
      const original = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
        0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46,
        0xff, 0xfe, 0xfd, 0x80, 0x00, 0xc0, 0xc1, 0xf5
      ]);

      await withServer(async (port) => {
        const {res, body} = await post(port, '/api/echo', original, {'Content-Type': 'application/octet-stream'});
        if(res.statusCode !== 200) throw new Error(`expected 200, got ${res.statusCode}`);

        const received = Buffer.from(JSON.parse(body.toString()).hex, 'hex');
        log(`sent ${original.length} bytes, received ${received.length}`);
        if(!received.equals(original)){
          throw new Error(`bytes changed in transit\n      sent:     ${original.toString('hex')}\n      received: ${received.toString('hex')}`);
        }
      });
      pass('binary body preserved exactly via serveFile.js');
    } catch(e) {
      fail(e.message);
    }
  }
};
