import http from 'http';
import {mkdtemp, rm} from 'fs/promises';
import os from 'os';
import path from 'path';
import {write} from './utils/file-writer.js';
import {rawHandshake} from './utils/ws-raw.js';
import {OPCODES} from '../src/websocket/frames.js';
import router from '../src/router.js';

/*
  Mimics how kempo (CMS core) will be installed and served once it ships a WebSocket route, rather than a
  hand-built server. The layout, config and middleware contract below are copied from kempo, so a
  regression that only shows up in that arrangement fails here first:

    <project>/
      public/                                  the server root (`kempo-server -r public`)
        .config.json                           same shape as kempo's app-public/.config.json
        account/live/WS.js                     a consumer's own socket route behind kempo's auth gate
      node_modules/kempo/
        middleware/kempo.js                    stand-in for kempo's middleware (contract below)
        server/utils/auth/getSession.js        stand-in for kempo's getSession (token in, tuple out)
        dist/kempo/api/realtime/               kempo core's API, reached ONLY through the wildcard
          WS.js  GET.js  notify/POST.js          "/kempo/**" -> "../node_modules/kempo/dist/kempo/**"

  The stand-in middleware reproduces the parts of middleware/kempo.js and middleware/kempo-auth.js that
  matter to a handshake: it destructures `request.path`, reads `request.cookies`, gates /account and
  /admin, redirects through `response.redirect()`, and otherwise calls next(). Those are properties of the
  enhanced request and response, which is exactly what a raw IncomingMessage / ServerResponse lacks.

  The real middleware cannot be imported here: it pulls in kempo's database layer. Route files import the
  registry by file URL for the same reason; a real consumer writes `from 'kempo-server/websocket'`.
*/

const REGISTRY_URL = new URL('../src/websocket/index.js', import.meta.url).href;

const CONFIG = {
  customRoutes: {
    '/kempo-css/**': '../node_modules/kempo-css/dist/**',
    '/kempo/**': '../node_modules/kempo/dist/kempo/**'
  },
  middleware: {
    custom: ['../node_modules/kempo/middleware/kempo.js']
  },
  templating: {ssr: true, ssrPriority: true, preRender: false},
  disallowedRegex: ['-disabled\\.html$']
};

const MIDDLEWARE = `import getSession from '../server/utils/auth/getSession.js';

export default (config) => async (request, response, next) => {
  const { path } = request;
  request.viaKempoMiddleware = true;

  if(path.startsWith('/account') || path.startsWith('/admin')){
    const [error, session] = await getSession({ token: request.cookies.session_token });
    if(error || !session || !session.user) return response.redirect('/login');
    if(path.startsWith('/admin') && !session.user.admin) return response.redirect('/account');
  }

  return next();
};
`;

const GET_SESSION = `const SESSIONS = {
  'token-ada': { user: { id: 'ada', admin: false } },
  'token-bob': { user: { id: 'bob', admin: false } },
  'token-root': { user: { id: 'root', admin: true } }
};

export default async ({ token }) => {
  if(!token) return [{ code: 401, msg: 'No session' }, null];
  const session = SESSIONS[token];
  if(!session) return [{ code: 401, msg: 'Invalid session' }, null];
  return [null, session];
};
`;

const REALTIME_WS = `import getSession from '../../../../server/utils/auth/getSession.js';

export default async (request, socket) => {
  const [error, session] = await getSession({ token: request.cookies.session_token });
  if(error) return socket.reject(error.code, error.msg);

  socket.data.userId = session.user.id;
  socket.send(JSON.stringify({
    type: 'ready',
    userId: session.user.id,
    viaMiddleware: request.viaKempoMiddleware === true
  }));
  socket.on('message', (data) => socket.send(JSON.stringify({ type: 'echo', data })));
};
`;

const REALTIME_GET = `export default async (request, response) => response.json({ http: true });
`;

const NOTIFY_POST = `import { broadcast } from '${REGISTRY_URL}';

export default async (request, response) => {
  const { userId, text } = request.body;
  const delivered = broadcast(JSON.stringify({ type: 'notify', text }), {
    path: '/kempo/api/realtime',
    filter: (socket) => socket.data.userId === userId
  });
  response.json({ delivered });
};
`;

const ACCOUNT_LIVE_WS = `export default async (request, socket) => {
  socket.send('live:' + (request.viaKempoMiddleware === true));
};
`;

const withKempoProject = async (fn) => {
  const project = await mkdtemp(path.join(os.tmpdir(), 'kempo-project-'));
  const previousCwd = process.cwd();

  try {
    await write(project, 'public/.config.json', JSON.stringify(CONFIG, null, 2));
    await write(project, 'public/account/live/WS.js', ACCOUNT_LIVE_WS);
    await write(project, 'node_modules/kempo/middleware/kempo.js', MIDDLEWARE);
    await write(project, 'node_modules/kempo/server/utils/auth/getSession.js', GET_SESSION);
    await write(project, 'node_modules/kempo/dist/kempo/api/realtime/WS.js', REALTIME_WS);
    await write(project, 'node_modules/kempo/dist/kempo/api/realtime/GET.js', REALTIME_GET);
    await write(project, 'node_modules/kempo/dist/kempo/api/realtime/notify/POST.js', NOTIFY_POST);

    // Run from the project root, as `kempo-server -r public` does; kempo's real middleware reads process.cwd()
    process.chdir(project);
    const handler = await router({root: 'public', logging: 0, config: '.config.json'}, () => {});
    const server = http.createServer(handler);
    server.on('upgrade', handler.upgrade);
    await new Promise(resolve => server.listen(0, resolve));

    try {
      return await fn({port: server.address().port});
    } finally {
      server.close();
    }
  } finally {
    process.chdir(previousCwd);
    await rm(project, {recursive: true, force: true});
  }
};

const nextJson = async (client) => {
  const frame = await client.next(3000);
  if(!frame || frame.opcode !== OPCODES.TEXT) return null;
  return JSON.parse(frame.payload.toString());
};

const request = (port, {method = 'GET', path: urlPath, body}) => new Promise((resolve, reject) => {
  const req = http.request({
    port,
    path: urlPath,
    method,
    headers: body ? {'Content-Type': 'application/json'} : {}
  }, (res) => {
    let data = '';
    res.on('data', chunk => { data += chunk; });
    res.on('end', () => resolve({status: res.statusCode, body: data}));
  });
  req.on('error', reject);
  req.end(body ? JSON.stringify(body) : undefined);
});

export default {
  'a signed-in user connects to kempo core\'s socket route through the /kempo/** mapping': async ({pass}) => {
    const problem = await withKempoProject(async ({port}) => {
      const handshake = await rawHandshake({
        port,
        path: '/kempo/api/realtime',
        headers: {Cookie: 'session_token=token-ada', Origin: `http://localhost:${port}`}
      });
      if(handshake.status !== 101) return `expected 101, got ${handshake.status}`;

      const client = handshake.client();
      const ready = await nextJson(client);
      if(!ready) return 'no ready message';
      if(ready.userId !== 'ada') return `route saw user "${ready.userId}", expected ada`;
      // Data a middleware attaches to the request has to reach the route, not be dropped in the handoff
      if(ready.viaMiddleware !== true) return 'the route did not receive the request the middleware modified';

      client.destroy();
      return null;
    });
    if(problem) throw new Error(problem);
    pass('authenticated connect through the wildcard mapping');
  },

  'a handshake with no session is refused by the route with 401': async ({pass}) => {
    const problem = await withKempoProject(async ({port}) => {
      const anonymous = await rawHandshake({port, path: '/kempo/api/realtime'});
      anonymous.socket.destroy();
      if(anonymous.status !== 401) return `no cookie: expected 401, got ${anonymous.status}`;

      const forged = await rawHandshake({port, path: '/kempo/api/realtime', headers: {Cookie: 'session_token=forged'}});
      forged.socket.destroy();
      if(forged.status !== 401) return `bad cookie: expected 401, got ${forged.status}`;
      return null;
    });
    if(problem) throw new Error(problem);
    pass('session auth refuses before any socket exists');
  },

  'a valid session cookie sent from a foreign origin is refused': async ({pass}) => {
    /*
      The whole reason for the origin check: a page on another site can make the browser attach the victim's
      session cookie to a WebSocket handshake. With a perfectly valid session, this must still be refused.
    */
    const problem = await withKempoProject(async ({port}) => {
      const hijack = await rawHandshake({
        port,
        path: '/kempo/api/realtime',
        headers: {Cookie: 'session_token=token-ada', Origin: 'http://evil.test'}
      });
      hijack.socket.destroy();
      if(hijack.status !== 403) return `expected 403, got ${hijack.status}`;
      return null;
    });
    if(problem) throw new Error(problem);
    pass('cross-site hijack blocked');
  },

  'kempo middleware runs on the handshake with the enhanced request and response': async ({pass}) => {
    /*
      The consumer's own socket route lives under /account, which kempo's middleware gates. Refusing the
      handshake needs `request.path`, `request.cookies` and `response.redirect()`; none of them exist on a
      raw IncomingMessage / ServerResponse, so the middleware threw and every handshake died.
    */
    const problem = await withKempoProject(async ({port}) => {
      const anonymous = await rawHandshake({port, path: '/account/live'});
      anonymous.socket.destroy();
      if(anonymous.status !== 302) return `signed out: expected a 302 redirect, got ${anonymous.status}`;
      if(anonymous.header('location') !== '/login') return `redirected to "${anonymous.header('location')}", expected /login`;

      const signedIn = await rawHandshake({port, path: '/account/live', headers: {Cookie: 'session_token=token-ada'}});
      if(signedIn.status !== 101) {
        signedIn.socket.destroy();
        return `signed in: expected 101, got ${signedIn.status}`;
      }

      const client = signedIn.client();
      const frame = await client.next(3000);
      client.destroy();
      if(!frame || frame.payload.toString() !== 'live:true') return `route did not see the middleware's changes: ${frame && frame.payload.toString()}`;
      return null;
    });
    if(problem) throw new Error(problem);
    pass('middleware contract holds on an upgrade');
  },

  'a rejected handshake does not leave the connection open': async ({pass}) => {
    const problem = await withKempoProject(async ({port}) => {
      const refused = await rawHandshake({port, path: '/account/live'});
      const closed = await new Promise((resolve) => {
        const timer = setTimeout(() => resolve(false), 1500);
        refused.socket.on('close', () => { clearTimeout(timer); resolve(true); });
        refused.socket.resume();
      });
      refused.socket.destroy();
      if(!closed) return 'the server kept the connection open after refusing the upgrade';
      return null;
    });
    if(problem) throw new Error(problem);
    pass('rejected upgrades close their connection');
  },

  'the same kempo URL serves an ordinary HTTP route and a socket': async ({pass}) => {
    const problem = await withKempoProject(async ({port}) => {
      const http1 = await request(port, {path: '/kempo/api/realtime'});
      if(http1.status !== 200 || JSON.parse(http1.body).http !== true) return `HTTP GET returned ${http1.status} "${http1.body}"`;

      const handshake = await rawHandshake({port, path: '/kempo/api/realtime', headers: {Cookie: 'session_token=token-ada'}});
      handshake.socket.destroy();
      if(handshake.status !== 101) return `handshake at the same URL returned ${handshake.status}`;
      return null;
    });
    if(problem) throw new Error(problem);
    pass('one URL, both transports');
  },

  'an HTTP route in kempo core pushes to one user\'s sockets': async ({pass}) => {
    /*
      The payments-webhook shape: a POST handler mapped in through the same wildcard finds the sockets by
      the user id the socket route attached, and reaches only that user.
    */
    const problem = await withKempoProject(async ({port}) => {
      const ada = await rawHandshake({port, path: '/kempo/api/realtime', headers: {Cookie: 'session_token=token-ada'}});
      const bob = await rawHandshake({port, path: '/kempo/api/realtime', headers: {Cookie: 'session_token=token-bob'}});
      const adaClient = ada.client();
      const bobClient = bob.client();

      await nextJson(adaClient);
      await nextJson(bobClient);

      const result = await request(port, {
        method: 'POST',
        path: '/kempo/api/realtime/notify',
        body: {userId: 'ada', text: 'order paid'}
      });
      if(result.status !== 200) return `notify returned ${result.status} "${result.body}"`;
      if(JSON.parse(result.body).delivered !== 1) return `delivered to ${JSON.parse(result.body).delivered} sockets, expected 1`;

      const notice = await nextJson(adaClient);
      if(!notice || notice.type !== 'notify' || notice.text !== 'order paid') return 'ada did not receive the push';

      const stray = await bobClient.next(400);
      if(stray) return 'bob received a push addressed to ada';

      adaClient.destroy();
      bobClient.destroy();
      return null;
    });
    if(problem) throw new Error(problem);
    pass('targeted push through the wildcard mapping');
  }
};
