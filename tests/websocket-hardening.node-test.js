import http from 'http';
import {withTestDir} from './utils/test-dir.js';
import {write} from './utils/file-writer.js';
import {rawHandshake} from './utils/ws-raw.js';
import {sockets, broadcast} from '../src/websocket/index.js';
import {decodeClose, encodeClose, CLOSE_CODES} from '../src/websocket/frames.js';
import router from '../src/router.js';

/*
  Backpressure and connection caps, against real sockets.

  A "slow client" here is a raw TCP socket that completes the handshake and then stops reading, so the
  server's writes really do back up in the kernel and then in Node's own queue, which is what
  bufferedAmount measures.
*/

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

const until = async (condition, description, timeout = 4000) => {
  const deadline = Date.now() + timeout;
  while(Date.now() < deadline){
    if(condition()) return;
    await wait(10);
  }
  throw new Error(`timed out waiting for ${description}`);
};

const ROUTE = `export default async (request, socket) => {
  if(request.query.deny) return socket.reject(401, 'Denied');
  socket.on('close', (code) => { globalThis[Symbol.for('kempo.test.closeCode.' + request.path)] = code; });
};
`;

const closeCodeFor = path => globalThis[Symbol.for('kempo.test.closeCode.' + path)];

const withServer = async (dir, fn, {config} = {}) => {
  await write(dir, '.config.json', JSON.stringify({websocket: config || {}}));
  const previousCwd = process.cwd();
  process.chdir(dir);

  const handler = await router({root: '.', logging: 0, config: '.config.json'}, () => {});
  const server = http.createServer(handler);
  server.on('upgrade', handler.upgrade);
  await new Promise(resolve => server.listen(0, resolve));

  try {
    return await fn({port: server.address().port});
  } finally {
    server.close();
    process.chdir(previousCwd);
  }
};

const FRAME = Buffer.alloc(256 * 1024);

// Connects a client that then stops reading, and returns it with the server-side socket that serves it
const connectSlowClient = async (port, path) => {
  const handshake = await rawHandshake({port, path});
  if(handshake.status !== 101) throw new Error(`handshake returned ${handshake.status}`);
  handshake.socket.pause();
  await until(() => sockets({path}).length === 1, `the server to register ${path}`);
  return {client: handshake, serverSide: sockets({path})[0]};
};

const flood = (serverSide, frames = 200) => {
  for(let i = 0; i < frames && serverSide.readyState === 'open'; i++) serverSide.send(FRAME);
};

// A test passes when its body finishes without throwing; anything thrown fails it and stops it at that line
const test = (body) => async ({pass}) => {
  await body();
  pass();
};

export default {
  'bufferedAmount shows what a slow client has not taken, and dropIfBackedUp skips a backed-up client': test(async () => {
    await withTestDir(async (dir) => {
      await write(dir, 'slow/WS.js', ROUTE);

      await withServer(dir, async ({port}) => {
        const {client, serverSide} = await connectSlowClient(port, '/slow');
        try {
          if(serverSide.bufferedAmount !== 0) throw new Error(`a fresh connection should have nothing queued, has ${serverSide.bufferedAmount}`);

          flood(serverSide);
          if(serverSide.bufferedAmount <= 65536) throw new Error(`a client that is not reading should back up past the 64KB high water mark, queued ${serverSide.bufferedAmount}`);

          if(serverSide.send('newest position', {dropIfBackedUp: true}) !== false) throw new Error('a send with dropIfBackedUp must be skipped while backed up');
          if(serverSide.send('newest position') !== true) throw new Error('an ordinary send must still be accepted, since dropping is opt-in');
          if(serverSide.readyState !== 'open') throw new Error('backing up alone (below the ceiling) must not close the connection');
        } finally {
          client.socket.destroy();
        }
      }, {config: {maxBufferedAmount: 0}});
    });
  }),

  'a send with dropIfBackedUp goes through when the client is keeping up': test(async () => {
    await withTestDir(async (dir) => {
      await write(dir, 'live/WS.js', ROUTE);

      await withServer(dir, async ({port}) => {
        const handshake = await rawHandshake({port, path: '/live'});
        const client = handshake.client();
        await until(() => sockets({path: '/live'}).length === 1, 'the server to register the socket');

        const serverSide = sockets({path: '/live'})[0];
        if(serverSide.send('hello', {dropIfBackedUp: true}) !== true) throw new Error('a healthy connection must never drop');

        const frame = await client.next();
        client.destroy();
        if(!frame || frame.payload.toString() !== 'hello') throw new Error('the message should arrive');
      });
    });
  }),

  'broadcast with dropIfBackedUp skips only the client that is behind': test(async () => {
    await withTestDir(async (dir) => {
      await write(dir, 'room/WS.js', ROUTE);

      await withServer(dir, async ({port}) => {
        const healthyHandshake = await rawHandshake({port, path: '/room'});
        const healthy = healthyHandshake.client();
        await until(() => sockets({path: '/room'}).length === 1, 'the healthy client');
        const healthyServerSide = sockets({path: '/room'})[0];

        const slowHandshake = await rawHandshake({port, path: '/room'});
        slowHandshake.socket.pause();
        await until(() => sockets({path: '/room'}).length === 2, 'the slow client');
        const slowServerSide = sockets({path: '/room'}).find(candidate => candidate !== healthyServerSide);

        try {
          flood(slowServerSide);
          if(slowServerSide.bufferedAmount <= 65536) throw new Error('the slow client should be backed up');

          const delivered = broadcast('tick', {path: '/room', dropIfBackedUp: true});
          if(delivered !== 1) throw new Error(`the tick should reach only the healthy client, reached ${delivered}`);

          const frame = await healthy.next();
          if(!frame || frame.payload.toString() !== 'tick') throw new Error('the healthy client should have received the tick');

          if(broadcast('tick', {path: '/room'}) !== 2) throw new Error('without the option a broadcast still queues onto every client');
        } finally {
          healthy.destroy();
          slowHandshake.socket.destroy();
        }
      }, {config: {maxBufferedAmount: 0}});
    });
  }),

  'a client that never reads is disconnected at the ceiling instead of growing memory': test(async () => {
    await withTestDir(async (dir) => {
      await write(dir, 'stuck/WS.js', ROUTE);
      delete globalThis[Symbol.for('kempo.test.closeCode./stuck')];

      await withServer(dir, async ({port}) => {
        const {client, serverSide} = await connectSlowClient(port, '/stuck');
        try {
          let sent = 0;
          while(serverSide.readyState === 'open' && sent < 400){
            serverSide.send(FRAME);
            sent++;
          }

          if(serverSide.readyState !== 'closed') throw new Error(`a stuck client must be cut off at the ceiling, still ${serverSide.readyState} after ${sent} frames`);
          if(closeCodeFor('/stuck') !== CLOSE_CODES.TRY_AGAIN_LATER) throw new Error(`the route should see close code 1013, got ${closeCodeFor('/stuck')}`);
          if(sent >= 400) throw new Error('the ceiling never engaged');
          if(serverSide.send('after') !== false) throw new Error('sending after the cut-off must be a harmless false');
          await until(() => sockets({path: '/stuck'}).length === 0, 'the registry to drop the socket');
        } finally {
          client.socket.destroy();
        }
      }, {config: {maxBufferedAmount: 1000000}});
    });
  }),

  'a single message larger than the ceiling is not refused on an empty queue': test(async () => {
    await withTestDir(async (dir) => {
      await write(dir, 'big/WS.js', ROUTE);

      await withServer(dir, async ({port}) => {
        const handshake = await rawHandshake({port, path: '/big'});
        const client = handshake.client();
        await until(() => sockets({path: '/big'}).length === 1, 'the server to register the socket');
        const serverSide = sockets({path: '/big'})[0];

        if(serverSide.send(Buffer.alloc(500000)) !== true) throw new Error('one large message on an empty queue must be accepted');
        const frame = await client.next(4000);
        client.destroy();
        if(!frame || frame.payload.length !== 500000) throw new Error('the large message should arrive whole');
        if(serverSide.readyState !== 'open') throw new Error('and it must not have closed the connection');
      }, {config: {maxBufferedAmount: 100000, maxMessageSize: 2000000}});
    });
  }),

  'close code 1013 is a valid code for a peer to send': test(async () => {
    const decoded = decodeClose(encodeClose(1013, 'try later').subarray(2));
    if(decoded.code !== 1013 || decoded.reason !== 'try later') throw new Error(`got ${JSON.stringify(decoded)}`);
  }),

  'the per-address cap refuses the extra connection with a 429 and frees a slot when one closes': test(async () => {
    await withTestDir(async (dir) => {
      await write(dir, 'cap/WS.js', ROUTE);

      await withServer(dir, async ({port}) => {
        const first = await rawHandshake({port, path: '/cap'});
        const second = await rawHandshake({port, path: '/cap'});
        if(first.status !== 101 || second.status !== 101) throw new Error(`the first two should be accepted, got ${first.status} and ${second.status}`);

        const third = await rawHandshake({port, path: '/cap'});
        third.socket.destroy();
        if(third.status !== 429) throw new Error(`the third from one address should be a 429, got ${third.status}`);

        first.socket.destroy();
        await until(() => sockets({path: '/cap'}).length === 1, 'the closed connection to be noticed');

        const replacement = await rawHandshake({port, path: '/cap'});
        replacement.socket.destroy();
        second.socket.destroy();
        if(replacement.status !== 101) throw new Error(`a slot freed by a close should be reusable, got ${replacement.status}`);
      }, {config: {maxConnectionsPerIp: 2}});
    });
  }),

  'the total cap refuses with a 503': test(async () => {
    await withTestDir(async (dir) => {
      await write(dir, 'total/WS.js', ROUTE);

      await withServer(dir, async ({port}) => {
        const open = [];
        for(let i = 0; i < 3; i++){
          const handshake = await rawHandshake({port, path: '/total'});
          if(handshake.status !== 101) throw new Error(`connection ${i + 1} should be accepted, got ${handshake.status}`);
          open.push(handshake);
        }

        const refused = await rawHandshake({port, path: '/total'});
        refused.socket.destroy();
        open.forEach(handshake => handshake.socket.destroy());
        if(refused.status !== 503) throw new Error(`the fourth should be a 503, got ${refused.status}`);
      }, {config: {maxConnections: 3}});
    });
  }),

  'a handshake that is refused does not leak its slot': test(async () => {
    await withTestDir(async (dir) => {
      await write(dir, 'leak/WS.js', ROUTE);

      await withServer(dir, async ({port}) => {
        // With a cap of one, any leaked slot turns the next attempt into a 429 instead of a 401
        for(let i = 0; i < 6; i++){
          const denied = await rawHandshake({port, path: '/leak?deny=1'});
          denied.socket.destroy();
          if(denied.status !== 401) throw new Error(`attempt ${i + 1} should be refused by the route (401), got ${denied.status}`);
        }

        const allowed = await rawHandshake({port, path: '/leak'});
        allowed.socket.destroy();
        if(allowed.status !== 101) throw new Error(`a real connection should still fit after the refusals, got ${allowed.status}`);
      }, {config: {maxConnectionsPerIp: 1}});
    });
  }),

  'behind a trusted proxy the cap is keyed on X-Forwarded-For, and without trust the header is ignored': test(async () => {
    await withTestDir(async (dir) => {
      await write(dir, 'proxy/WS.js', ROUTE);

      await withServer(dir, async ({port}) => {
        const one = await rawHandshake({port, path: '/proxy', headers: {'X-Forwarded-For': '203.0.113.1'}});
        const two = await rawHandshake({port, path: '/proxy', headers: {'X-Forwarded-For': '203.0.113.2, 10.0.0.1'}});
        if(one.status !== 101 || two.status !== 101) throw new Error(`distinct forwarded addresses should each get a slot, got ${one.status} and ${two.status}`);

        const repeat = await rawHandshake({port, path: '/proxy', headers: {'X-Forwarded-For': '203.0.113.1'}});
        repeat.socket.destroy();
        if(repeat.status !== 429) throw new Error(`a repeat forwarded address should be a 429, got ${repeat.status}`);

        const addresses = sockets({path: '/proxy'}).map(socket => socket.remoteAddress).sort();
        one.socket.destroy();
        two.socket.destroy();
        if(JSON.stringify(addresses) !== JSON.stringify(['203.0.113.1', '203.0.113.2'])) throw new Error(`remoteAddress should be the forwarded address, got ${addresses}`);
      }, {config: {maxConnectionsPerIp: 1, trustProxy: true}});
    });

    await withTestDir(async (dir) => {
      await write(dir, 'noproxy/WS.js', ROUTE);

      await withServer(dir, async ({port}) => {
        const first = await rawHandshake({port, path: '/noproxy', headers: {'X-Forwarded-For': '203.0.113.1'}});
        const second = await rawHandshake({port, path: '/noproxy', headers: {'X-Forwarded-For': '203.0.113.2'}});
        first.socket.destroy();
        second.socket.destroy();
        if(second.status !== 429) throw new Error(`without trustProxy a spoofed header must not dodge the cap, got ${second.status}`);
      }, {config: {maxConnectionsPerIp: 1}});
    });
  })
};
