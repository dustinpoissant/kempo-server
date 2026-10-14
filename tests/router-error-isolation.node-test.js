import http from 'http';
import {withTestDir} from './utils/test-dir.js';
import {write} from './utils/file-writer.js';
import {randomPort} from './utils/port.js';
import router from '../src/router.js';

/*
  One broken route must not take the server down with it.

  Found on a site running several extensions: one extension's node_modules had been emptied, so a
  route of its imported a package that no longer existed. The import failed inside the request,
  nothing caught the rejection, and Node ended the process — every page of the site went with it,
  on the first visit to the admin dashboard that touched that route.
*/

const get = (port, path) => new Promise((resolve, reject) => {
  http.get(`http://localhost:${port}${path}`, response => {
    const chunks = [];
    response.on('data', chunk => chunks.push(chunk));
    response.on('end', () => resolve({ status: response.statusCode, body: Buffer.concat(chunks).toString() }));
  }).on('error', reject);
});

export default {
  /*
    Through custom middleware, which is how kempo serves an extension's routes: the middleware
    imports the extension's route module itself, so nothing of kempo-server's own route handling is
    around that import to catch it.
  */
  'a route module that fails to import inside middleware answers 500, and the server keeps serving': async ({pass, fail}) => {
    await withTestDir(async (dir) => {
      await write(dir, 'extension-route.js', `import 'a-package-that-is-not-installed';\nexport default (request, response) => response.json({ ok: true });\n`);
      await write(dir, 'extension-router.js', [
        `export default () => async (request, response, next) => {`,
        `  if(request.url !== '/broken') return next();`,
        `  const route = await import(new URL('./extension-route.js', import.meta.url).href);`,
        `  return route.default(request, response);`,
        `};`,
      ].join('\n'));
      await write(dir, '.config.json', JSON.stringify({ middleware: { custom: ['./extension-router.js'] } }));
      await write(dir, 'working/GET.js', `export default (request, response) => response.json({ ok: true });\n`);

      const prev = process.cwd();
      process.chdir(dir);
      const handler = await router({root: '.', logging: -1, scan: false}, () => {});
      const server = http.createServer(handler);
      const port = randomPort();
      await new Promise(resolve => server.listen(port, resolve));

      const rejections = [];
      const onRejection = reason => rejections.push(reason);
      process.on('unhandledRejection', onRejection);

      try {
        const broken = await get(port, '/broken');
        if(broken.status !== 500) return fail(`the broken route answered ${broken.status}`);

        await new Promise(resolve => setTimeout(resolve, 50));
        if(rejections.length) return fail(`an unhandled rejection escaped: ${rejections[0]}`);

        const working = await get(port, '/working');
        if(working.status !== 200 || !working.body.includes('ok')) return fail(`the server stopped serving: ${working.status}`);
        pass('500 for the broken route, 200 for the next request');
      } finally {
        process.off('unhandledRejection', onRejection);
        server.close();
        handler.dispose?.();
        process.chdir(prev);
      }
    });
  },

  'a route handler that throws after starting a response does not leave it hanging': async ({pass, fail}) => {
    await withTestDir(async (dir) => {
      await write(dir, 'half/GET.js', `export default (request, response) => { response.writeHead(200); response.write('partial'); throw new Error('half way'); };\n`);

      const prev = process.cwd();
      process.chdir(dir);
      const handler = await router({root: '.', logging: -1, scan: false}, () => {});
      const server = http.createServer(handler);
      const port = randomPort();
      await new Promise(resolve => server.listen(port, resolve));

      try {
        const half = await Promise.race([
          get(port, '/half'),
          new Promise(resolve => setTimeout(() => resolve(null), 3000)),
        ]);
        if(!half) return fail('the response was never ended');
        pass(`ended with ${half.status}`);
      } finally {
        server.close();
        handler.dispose?.();
        process.chdir(prev);
      }
    });
  },
};
