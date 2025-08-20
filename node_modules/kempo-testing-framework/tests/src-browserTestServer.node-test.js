import http from 'http';
import { startServer, stopServer } from '../src/browserTestServer.js';

const get = (port, path) => new Promise((resolve, reject) => {
  const req = http.request({ hostname: 'localhost', port, path, method: 'GET' }, (res) => {
    let data = '';
    res.on('data', chunk => { data += chunk.toString(); });
    res.on('end', () => resolve({ status: res.statusCode, body: data }));
  });
  req.on('error', reject);
  req.end();
});

export default {
  'serves index html at /': async ({ pass, fail, log }) => {
    const port = 3101;
    try {
      const url = await startServer(port);
      const { status, body } = await get(port, '/');
    log(`GET / -> ${status}`);
    if (status === 200 && /<title>Test<\/title>/.test(body)) pass('Browser test server served index.html');
    else fail(`Bad response from /: status=${status} body=${body?.slice(0,80)}`);
    } catch (e) {
      fail(e.stack || String(e));
    } finally {
      await stopServer();
    }
  },
  'serves test runner script and static files, 404s missing': async ({ pass, fail, log }) => {
    const port = 3101;
    try {
      await startServer(port);
      const a = await get(port, '/runTests.js');
      const b = await get(port, '/tests/counter.browser-test.js');
      const c = await get(port, '/does-not-exist.js');
    log(`Statuses: /runTests.js=${a.status} /tests/counter.browser-test.js=${b.status} /does-not-exist.js=${c.status}`);
      const ok = a.status === 200 && /export default|const wait/.test(a.body)
        && b.status === 200 && /Counter component/.test(b.body)
        && c.status === 404;
    ok ? pass('Static and test files served; missing files 404 as expected') : fail(`Unexpected statuses: a=${a.status}, b=${b.status}, c=${c.status}`);
    } catch (e) {
      fail(e.stack || String(e));
    } finally {
      await stopServer();
    }
  }
};
