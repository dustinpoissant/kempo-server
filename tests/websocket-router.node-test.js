import http from 'http';
import {withTestDir} from './utils/test-dir.js';
import {write} from './utils/file-writer.js';
import {rawHandshake, clientFrame, oversizedHeader} from './utils/ws-raw.js';
import {OPCODES, CLOSE_CODES} from '../src/websocket/frames.js';
import router from '../src/router.js';

/*
  Route files are written into a temp dir, so a relative import of the registry would not resolve from
  there. Real consumers import 'kempo-server/websocket' instead.
*/
const REGISTRY_URL = new URL('../src/websocket/index.js', import.meta.url).href;

const ECHO_ROUTE = `export default async (request, socket) => {
  socket.data.path = request.path;
  socket.on('message', (data, isBinary) => {
    if(isBinary) return socket.send(data);
    socket.send('echo:' + data);
  });
};
`;

/*
  Boots a server on an ephemeral port with the upgrade listener wired the way src/index.js wires it, and
  always tears it down. Port 0 is used rather than a random guess so two concurrent tests cannot collide.
*/
const withServer = async (dir, fn, {config} = {}) => {
  if(config) await write(dir, '.config.json', JSON.stringify(config));

  const previousCwd = process.cwd();
  process.chdir(dir);

  const handler = await router({root: '.', logging: 0, config: '.config.json'}, () => {});
  const server = http.createServer(handler);
  server.on('upgrade', handler.upgrade);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;

  try {
    return await fn({port, server, handler});
  } finally {
    server.close();
    process.chdir(previousCwd);
  }
};

const openSocket = (port, path) => new Promise((resolve, reject) => {
  const socket = new WebSocket(`ws://localhost:${port}${path}`);
  socket.binaryType = 'arraybuffer';
  const timer = setTimeout(() => reject(new Error('open timeout')), 4000);
  socket.onopen = () => { clearTimeout(timer); resolve(socket); };
  socket.onerror = () => { clearTimeout(timer); reject(new Error('open failed')); };
});

const nextMessage = (socket, timeout = 3000) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('message timeout')), timeout);
  socket.onmessage = (event) => { clearTimeout(timer); resolve(event.data); };
});

export default {
  'a WS.js route echoes text and binary': async ({pass, fail}) => {
    await withTestDir(async (dir) => {
      await write(dir, 'chat/WS.js', ECHO_ROUTE);

      const problem = await withServer(dir, async ({port}) => {
        const socket = await openSocket(port, '/chat');

        socket.send('hello');
        if(await nextMessage(socket) !== 'echo:hello') return 'text echo failed';

        // 250 is not valid UTF-8 on its own, so a byte-preserving path is the only way it survives
        socket.send(new Uint8Array([0, 1, 250, 255]));
        const binary = new Uint8Array(await nextMessage(socket));
        if(binary.join(',') !== '0,1,250,255') return `binary echo mangled: ${binary.join(',')}`;

        socket.close();
        return null;
      });

      if(problem) return fail(problem);
    });
    pass('text and binary echo');
  },

  'a [param] segment resolves and populates request.params': async ({pass, fail}) => {
    await withTestDir(async (dir) => {
      await write(dir, 'room/[id]/WS.js', `export default async (request, socket) => {
        socket.send(JSON.stringify({id: request.params.id, path: request.path, q: request.query.x}));
      };
      `);

      const problem = await withServer(dir, async ({port}) => {
        const socket = await openSocket(port, '/room/abc123?x=7');
        const payload = JSON.parse(await nextMessage(socket));
        socket.close();

        if(payload.id !== 'abc123') return `params.id was ${payload.id}`;
        if(payload.path !== '/room/abc123') return `path was ${payload.path}`;
        if(payload.q !== '7') return `query.x was ${payload.q}`;
        return null;
      });

      if(problem) return fail(problem);
    });
    pass('dynamic segment and query');
  },

  'only a file named WS.js is ever run for an upgrade': async ({pass, fail}) => {
    await withTestDir(async (dir) => {
      /*
        findFile falls back to index.js and CATCH.js for a directory request. If that fallback reached the
        upgrade path, these HTTP routes would be invoked with a socket in place of a response.
      */
      await write(dir, 'plain/GET.js', `export default async (req, res) => res.end('http');`);
      await write(dir, 'plain/index.js', `export default async (req, res) => res.end('index');`);
      await write(dir, 'CATCH.js', `export default async (req, res) => res.end('catch');`);
      await write(dir, 'sock/WS.js', ECHO_ROUTE);

      const problem = await withServer(dir, async ({port}) => {
        for(const path of ['/plain', '/missing', '/']){
          const result = await rawHandshake({port, path});
          if(result.status !== 404){
            result.socket.destroy();
            return `${path} returned ${result.status}, expected 404`;
          }
          result.socket.destroy();
        }

        // The real socket route still works, so the check is not simply rejecting everything
        const ok = await rawHandshake({port, path: '/sock'});
        ok.socket.destroy();
        if(ok.status !== 101) return `/sock returned ${ok.status}, expected 101`;

        // And a normal HTTP request is untouched by any of this
        const body = await new Promise((resolve) => {
          http.get(`http://localhost:${port}/plain`, (res) => {
            let data = '';
            res.on('data', c => { data += c; });
            res.on('end', () => resolve(data));
          });
        });
        if(body !== 'http') return `HTTP GET returned "${body}", expected "http"`;
        return null;
      });

      if(problem) return fail(problem);
    });
    pass('WS.js only, no index/CATCH fallback');
  },

  'the handshake response follows RFC 6455': async ({pass, fail}) => {
    await withTestDir(async (dir) => {
      await write(dir, 'chat/WS.js', ECHO_ROUTE);

      const problem = await withServer(dir, async ({port}) => {
        const ok = await rawHandshake({port, path: '/chat'});
        if(ok.status !== 101) return `expected 101, got ${ok.status}`;
        if((ok.header('upgrade') || '').toLowerCase() !== 'websocket') return 'missing Upgrade header';
        if((ok.header('connection') || '').toLowerCase() !== 'upgrade') return 'missing Connection header';

        const {computeAccept} = await import('../src/websocket/handshake.js');
        if(ok.header('sec-websocket-accept') !== computeAccept(ok.sentKey)) return 'wrong Sec-WebSocket-Accept';
        ok.socket.destroy();

        const cases = [
          [{Upgrade: null}, 400, 'no Upgrade'],
          [{Connection: 'keep-alive'}, 400, 'wrong Connection'],
          [{'Sec-WebSocket-Key': null}, 400, 'no key'],
          [{'Sec-WebSocket-Key': 'not-sixteen-bytes'}, 400, 'malformed key'],
          [{'Sec-WebSocket-Version': '8'}, 426, 'old version'],
          [{Origin: 'http://evil.test'}, 403, 'foreign origin']
        ];

        for(const [headers, status, label] of cases){
          const result = await rawHandshake({port, path: '/chat', headers});
          result.socket.destroy();
          if(result.status !== status) return `${label}: got ${result.status}, expected ${status}`;
          if(status === 426 && result.header('sec-websocket-version') !== '13'){
            return '426 did not advertise version 13';
          }
        }
        return null;
      });

      if(problem) return fail(problem);
    });
    pass('handshake and its rejections');
  },

  'a same-origin handshake passes and an allow-list is honoured': async ({pass, fail}) => {
    await withTestDir(async (dir) => {
      await write(dir, 'chat/WS.js', ECHO_ROUTE);

      const problem = await withServer(dir, async ({port}) => {
        const same = await rawHandshake({port, path: '/chat', headers: {Origin: `http://localhost:${port}`}});
        same.socket.destroy();
        if(same.status !== 101) return `same origin got ${same.status}`;
        return null;
      });
      if(problem) return fail(problem);
    });

    await withTestDir(async (dir) => {
      await write(dir, 'chat/WS.js', ECHO_ROUTE);

      const problem = await withServer(dir, async ({port}) => {
        const allowed = await rawHandshake({port, path: '/chat', headers: {Origin: 'http://allowed.test'}});
        allowed.socket.destroy();
        if(allowed.status !== 101) return `allow-listed origin got ${allowed.status}`;

        const blocked = await rawHandshake({port, path: '/chat', headers: {Origin: 'http://other.test'}});
        blocked.socket.destroy();
        if(blocked.status !== 403) return `unlisted origin got ${blocked.status}`;
        return null;
      }, {config: {websocket: {allowedOrigins: ['http://allowed.test']}}});

      if(problem) return fail(problem);
    });
    pass('origin enforcement end to end');
  },

  'a route can refuse the upgrade with an HTTP status': async ({pass, fail}) => {
    await withTestDir(async (dir) => {
      await write(dir, 'private/WS.js', `export default async (request, socket) => {
        if(request.cookies.token !== 'good') return socket.reject(401, 'Unauthorized');
        socket.send('welcome');
      };
      `);

      const problem = await withServer(dir, async ({port}) => {
        const denied = await rawHandshake({port, path: '/private'});
        denied.socket.destroy();
        if(denied.status !== 401) return `expected 401, got ${denied.status}`;

        const allowed = await rawHandshake({port, path: '/private', headers: {Cookie: 'token=good'}});
        if(allowed.status !== 101) return `expected 101 with a cookie, got ${allowed.status}`;

        // The queued send still arrives, flushed after the handshake completes
        const client = allowed.client();
        const frame = await client.next();
        client.destroy();
        if(!frame || frame.payload.toString() !== 'welcome') return 'queued send did not arrive';
        return null;
      });

      if(problem) return fail(problem);
    });
    pass('cookie auth and reject()');
  },

  'middleware runs for the handshake and can reject it': async ({pass, fail}) => {
    await withTestDir(async (dir) => {
      await write(dir, 'chat/WS.js', ECHO_ROUTE);

      // Rate limit set to a single request, so the second handshake is refused by middleware
      const problem = await withServer(dir, async ({port}) => {
        const first = await rawHandshake({port, path: '/chat'});
        if(first.status !== 101) return `first handshake got ${first.status}`;
        // Security headers set by middleware must survive onto the 101
        if(first.header('x-frame-options') !== 'DENY') return 'security header missing from 101';
        first.socket.destroy();

        const second = await rawHandshake({port, path: '/chat'});
        second.socket.destroy();
        if(second.status !== 429) return `second handshake got ${second.status}, expected 429`;
        return null;
      }, {
        config: {
          middleware: {
            rateLimit: {enabled: true, maxRequests: 1, windowMs: 60000, message: 'Too many requests'},
            security: {enabled: true, headers: {'X-Frame-Options': 'DENY'}}
          }
        }
      });

      if(problem) return fail(problem);
    });
    pass('middleware chain on upgrade');
  },

  'fragmented messages are reassembled': async ({pass, fail}) => {
    await withTestDir(async (dir) => {
      await write(dir, 'chat/WS.js', ECHO_ROUTE);

      const problem = await withServer(dir, async ({port}) => {
        const handshake = await rawHandshake({port, path: '/chat'});
        const client = handshake.client();

        client.send(clientFrame({opcode: OPCODES.TEXT, payload: 'Hel', fin: false}));
        client.send(clientFrame({opcode: OPCODES.CONTINUATION, payload: 'lo ', fin: false}));
        client.send(clientFrame({opcode: OPCODES.CONTINUATION, payload: 'world', fin: true}));

        const frame = await client.next();
        client.destroy();
        if(!frame) return 'no reply to a fragmented message';
        if(frame.payload.toString() !== 'echo:Hello world') return `got "${frame.payload.toString()}"`;
        return null;
      });

      if(problem) return fail(problem);
    });
    pass('fragment reassembly');
  },

  'a ping is answered with a matching pong': async ({pass, fail}) => {
    await withTestDir(async (dir) => {
      await write(dir, 'chat/WS.js', ECHO_ROUTE);

      const problem = await withServer(dir, async ({port}) => {
        const handshake = await rawHandshake({port, path: '/chat'});
        const client = handshake.client();

        client.send(clientFrame({opcode: OPCODES.PING, payload: 'ping-payload'}));
        const frame = await client.next();
        client.destroy();

        if(!frame) return 'no pong';
        if(frame.opcode !== OPCODES.PONG) return `got opcode ${frame.opcode}, expected pong`;
        if(frame.payload.toString() !== 'ping-payload') return 'pong did not echo the ping payload';
        return null;
      });

      if(problem) return fail(problem);
    });
    pass('ping/pong');
  },

  'protocol violations close with the right code': async ({pass, fail}) => {
    await withTestDir(async (dir) => {
      await write(dir, 'chat/WS.js', ECHO_ROUTE);

      const problem = await withServer(dir, async ({port}) => {
        const cases = [
          ['unmasked frame', clientFrame({opcode: OPCODES.TEXT, payload: 'x', mask: false}), CLOSE_CODES.PROTOCOL_ERROR],
          ['reserved bit set', clientFrame({opcode: OPCODES.TEXT, payload: 'x', rsv: 4}), CLOSE_CODES.PROTOCOL_ERROR],
          ['unknown opcode', clientFrame({opcode: 0x3, payload: 'x'}), CLOSE_CODES.PROTOCOL_ERROR],
          ['oversized control frame', clientFrame({opcode: OPCODES.PING, payload: Buffer.alloc(126)}), CLOSE_CODES.PROTOCOL_ERROR],
          ['invalid UTF-8 text', clientFrame({opcode: OPCODES.TEXT, payload: Buffer.from([0xc3, 0x28])}), CLOSE_CODES.INVALID_PAYLOAD],
          ['stray continuation', clientFrame({opcode: OPCODES.CONTINUATION, payload: 'x'}), CLOSE_CODES.PROTOCOL_ERROR],
          ['oversized message', oversizedHeader(5 * 1024 * 1024), CLOSE_CODES.TOO_LARGE]
        ];

        for(const [label, frame, expected] of cases){
          const handshake = await rawHandshake({port, path: '/chat'});
          const client = handshake.client();
          client.send(frame);

          const reply = await client.next();
          client.destroy();

          if(!reply) return `${label}: connection closed with no close frame`;
          if(reply.opcode !== OPCODES.CLOSE) return `${label}: got opcode ${reply.opcode}, expected a close frame`;
          const code = reply.payload.readUInt16BE(0);
          if(code !== expected) return `${label}: closed with ${code}, expected ${expected}`;
        }
        return null;
      }, {config: {websocket: {maxMessageSize: 1024}}});

      if(problem) return fail(problem);
    });
    pass('close codes 1002, 1007 and 1009');
  },

  'the close handshake works from either side': async ({pass, fail}) => {
    await withTestDir(async (dir) => {
      await write(dir, 'chat/WS.js', ECHO_ROUTE);
      await write(dir, 'bye/WS.js', `export default async (request, socket) => {
        socket.on('message', () => socket.close(4001, 'done'));
      };
      `);

      const problem = await withServer(dir, async ({port}) => {
        // Client-initiated: the server echoes the code back and tears down
        const handshake = await rawHandshake({port, path: '/chat'});
        const client = handshake.client();
        const payload = Buffer.allocUnsafe(2);
        payload.writeUInt16BE(1000, 0);
        client.send(clientFrame({opcode: OPCODES.CLOSE, payload}));

        const reply = await client.next();
        if(!reply || reply.opcode !== OPCODES.CLOSE) return 'server did not answer the close';
        if(reply.payload.readUInt16BE(0) !== 1000) return `server echoed ${reply.payload.readUInt16BE(0)}`;
        if(!await client.waitForClose()) return 'socket was not torn down after close';

        // Server-initiated, with an application close code
        const second = await rawHandshake({port, path: '/bye'});
        const secondClient = second.client();
        secondClient.send(clientFrame({opcode: OPCODES.TEXT, payload: 'go'}));

        const serverClose = await secondClient.next();
        secondClient.destroy();
        if(!serverClose || serverClose.opcode !== OPCODES.CLOSE) return 'server did not start a close';
        if(serverClose.payload.readUInt16BE(0) !== 4001) return `server sent ${serverClose.payload.readUInt16BE(0)}`;
        if(serverClose.payload.subarray(2).toString() !== 'done') return 'close reason missing';
        return null;
      });

      if(problem) return fail(problem);
    });
    pass('bidirectional close');
  },

  'a throwing handler kills only its own connection': async ({pass, fail}) => {
    await withTestDir(async (dir) => {
      await write(dir, 'boom/WS.js', `export default async (request, socket) => {
        socket.on('message', () => { throw new Error('handler exploded'); });
      };
      `);
      await write(dir, 'chat/WS.js', ECHO_ROUTE);

      const problem = await withServer(dir, async ({port}) => {
        const survivor = await openSocket(port, '/chat');

        const handshake = await rawHandshake({port, path: '/boom'});
        const client = handshake.client();
        client.send(clientFrame({opcode: OPCODES.TEXT, payload: 'trigger'}));

        const reply = await client.next();
        client.destroy();
        if(!reply || reply.opcode !== OPCODES.CLOSE) return 'throwing handler did not close its socket';
        const code = reply.payload.readUInt16BE(0);
        if(code !== CLOSE_CODES.INTERNAL_ERROR) return `closed with ${code}, expected 1011`;

        // The other connection must be entirely unaffected
        survivor.send('still here');
        if(await nextMessage(survivor) !== 'echo:still here') return 'the surviving connection broke';
        survivor.close();
        return null;
      });

      if(problem) return fail(problem);
    });
    pass('1011 and isolation');
  },

  'sending on a closed socket returns false instead of throwing': async ({pass, fail}) => {
    await withTestDir(async (dir) => {
      await write(dir, 'late/WS.js', `export default async (request, socket) => {
        socket.on('close', () => {
          // Must not throw, and must report that nothing was sent
          const result = socket.send('after close');
          if(result !== false) throw new Error('send() on a closed socket returned ' + result);
        });
      };
      `);

      const problem = await withServer(dir, async ({port}) => {
        const handshake = await rawHandshake({port, path: '/late'});
        if(handshake.status !== 101) return `handshake got ${handshake.status}`;
        const client = handshake.client();
        client.destroy();
        // If the close handler threw, the process would have reported an unhandled error by now
        await new Promise(resolve => setTimeout(resolve, 150));
        return null;
      });

      if(problem) return fail(problem);
    });
    pass('send after close is a no-op');
  },

  'code outside the route can find and push to sockets': async ({pass, fail}) => {
    await withTestDir(async (dir) => {
      await write(dir, 'feed/WS.js', `export default async (request, socket) => {
        socket.data.room = request.query.room;
      };
      `);
      // An ordinary HTTP route reaching connected sockets, the way a webhook handler would
      await write(dir, 'push/POST.js', `import {sockets, broadcast} from '${REGISTRY_URL}';
      export default async (request, response) => {
        const total = sockets().length;
        const sent = broadcast('push:' + request.body.text, {path: '/feed', filter: s => s.data.room === request.body.room});
        response.writeHead(200, {'Content-Type': 'application/json'});
        response.end(JSON.stringify({total, sent}));
      };
      `);

      const problem = await withServer(dir, async ({port}) => {
        const alpha = await openSocket(port, '/feed?room=alpha');
        const beta = await openSocket(port, '/feed?room=beta');
        const alphaMessage = nextMessage(alpha);

        const result = await new Promise((resolve, reject) => {
          const req = http.request({
            port,
            path: '/push',
            method: 'POST',
            headers: {'Content-Type': 'application/json'}
          }, (res) => {
            let data = '';
            res.on('data', c => { data += c; });
            res.on('end', () => resolve(JSON.parse(data)));
          });
          req.on('error', reject);
          req.end(JSON.stringify({text: 'hello', room: 'alpha'}));
        });

        if(result.total !== 2) return `registry saw ${result.total} sockets, expected 2`;
        if(result.sent !== 1) return `broadcast reached ${result.sent} sockets, expected 1`;
        if(await alphaMessage !== 'push:hello') return 'the filtered socket did not receive the push';

        alpha.close();
        beta.close();
        return null;
      });

      if(problem) return fail(problem);
    });
    pass('outside-the-route sending');
  },

  'closing the server sends 1001 to open sockets': async ({pass, fail}) => {
    await withTestDir(async (dir) => {
      await write(dir, 'chat/WS.js', ECHO_ROUTE);

      const problem = await withServer(dir, async ({port, server}) => {
        const handshake = await rawHandshake({port, path: '/chat'});
        const client = handshake.client();

        server.close();
        const frame = await client.next();
        client.destroy();

        if(!frame) return 'no close frame on shutdown';
        if(frame.opcode !== OPCODES.CLOSE) return `got opcode ${frame.opcode}, expected close`;
        const code = frame.payload.readUInt16BE(0);
        if(code !== CLOSE_CODES.GOING_AWAY) return `closed with ${code}, expected 1001`;
        return null;
      });

      if(problem) return fail(problem);
    });
    pass('1001 on shutdown');
  },

  'the heartbeat drops a connection that stops answering': async ({pass, fail}) => {
    await withTestDir(async (dir) => {
      await write(dir, 'chat/WS.js', ECHO_ROUTE);

      const problem = await withServer(dir, async ({port}) => {
        const handshake = await rawHandshake({port, path: '/chat'});
        const client = handshake.client();

        // The server should ping an idle connection, then drop it when no pong comes back
        const ping = await client.next(2000);
        if(!ping) return 'no heartbeat ping was sent';
        if(ping.opcode !== OPCODES.PING) return `expected a ping, got opcode ${ping.opcode}`;

        if(!await client.waitForClose(2000)) return 'connection survived a missed pong';
        return null;
      }, {config: {websocket: {heartbeatInterval: 120, heartbeatTimeout: 150}}});

      if(problem) return fail(problem);
    });
    pass('heartbeat timeout');
  },

  'websocket support can be turned off': async ({pass, fail}) => {
    await withTestDir(async (dir) => {
      await write(dir, 'chat/WS.js', ECHO_ROUTE);

      const problem = await withServer(dir, async ({port}) => {
        const result = await rawHandshake({port, path: '/chat'});
        result.socket.destroy();
        if(result.status !== 404) return `expected 404 when disabled, got ${result.status}`;
        return null;
      }, {config: {websocket: {enabled: false}}});

      if(problem) return fail(problem);
    });
    pass('websocket.enabled: false');
  }
};
