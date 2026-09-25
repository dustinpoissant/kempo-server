import net from 'net';
import crypto from 'crypto';

/*
  A deliberately dumb WebSocket client built straight on a TCP socket.

  Node's built-in `WebSocket` is the right client for happy-path tests, but it refuses to send anything
  that violates the spec — which is exactly what the protocol-error tests need to send. This helper
  writes whatever bytes it is told to.
*/

// Server-to-client frames are unmasked, so this reader is simpler than the one in src/
const parseFrames = (buffer) => {
  const frames = [];
  let offset = 0;

  while(offset + 2 <= buffer.length){
    const fin = (buffer[offset] & 0x80) !== 0;
    const opcode = buffer[offset] & 0x0f;
    const masked = (buffer[offset + 1] & 0x80) !== 0;
    let length = buffer[offset + 1] & 0x7f;
    let cursor = offset + 2;

    if(length === 126){
      if(cursor + 2 > buffer.length) break;
      length = buffer.readUInt16BE(cursor);
      cursor += 2;
    } else if(length === 127){
      if(cursor + 8 > buffer.length) break;
      length = Number(buffer.readBigUInt64BE(cursor));
      cursor += 8;
    }

    if(masked) cursor += 4;
    if(cursor + length > buffer.length) break;

    frames.push({ fin, opcode, masked, payload: buffer.subarray(cursor, cursor + length) });
    offset = cursor + length;
  }

  return { frames, rest: buffer.subarray(offset) };
};

// Client-to-server frames must be masked, so masking is the default here
export const clientFrame = ({ opcode, payload = Buffer.alloc(0), fin = true, mask = true, rsv = 0 }) => {
  const body = Buffer.isBuffer(payload) ? payload : Buffer.from(payload, 'utf8');
  const length = body.length;

  let header;
  if(length < 126){
    header = Buffer.allocUnsafe(2);
    header[1] = length;
  } else if(length < 65536){
    header = Buffer.allocUnsafe(4);
    header[1] = 126;
    header.writeUInt16BE(length, 2);
  } else {
    header = Buffer.allocUnsafe(10);
    header[1] = 127;
    header.writeUInt32BE(0, 2);
    header.writeUInt32BE(length, 6);
  }

  header[0] = (fin ? 0x80 : 0x00) | (rsv << 4) | opcode;

  if(!mask) return Buffer.concat([header, body]);

  header[1] |= 0x80;
  const maskKey = crypto.randomBytes(4);
  const masked = Buffer.allocUnsafe(length);
  for(let i = 0; i < length; i++) masked[i] = body[i] ^ maskKey[i & 3];

  return Buffer.concat([header, maskKey, masked]);
};

/*
  Builds a frame whose declared length lies about the payload that follows, so the size limit can be
  tested without actually transmitting the bytes.
*/
export const oversizedHeader = (declaredLength) => {
  const header = Buffer.allocUnsafe(10);
  header[0] = 0x81;
  header[1] = 127 | 0x80;
  header.writeUInt32BE(Math.floor(declaredLength / 0x100000000), 2);
  header.writeUInt32BE(declaredLength % 0x100000000, 6);
  return Buffer.concat([header, crypto.randomBytes(4)]);
};

export class RawWsClient {
  #socket;
  #buffer = Buffer.alloc(0);
  #frames = [];
  #waiters = [];
  closed = false;

  constructor(socket, rest){
    this.#socket = socket;
    this.#socket.on('data', this.#onData);
    this.#socket.on('close', () => {
      this.closed = true;
      for(const waiter of this.#waiters) waiter.resolve(null);
      this.#waiters = [];
    });
    if(rest && rest.length) this.#onData(rest);
  }

  #onData = (chunk) => {
    this.#buffer = Buffer.concat([this.#buffer, chunk]);
    const { frames, rest } = parseFrames(this.#buffer);
    this.#buffer = rest;

    for(const frame of frames){
      const waiter = this.#waiters.shift();
      if(waiter) waiter.resolve(frame);
      else this.#frames.push(frame);
    }
  };

  send(frame){
    this.#socket.write(frame);
  }

  // Resolves the next frame, or null if the connection closed first
  next(timeout = 2000){
    if(this.#frames.length) return Promise.resolve(this.#frames.shift());
    if(this.closed) return Promise.resolve(null);

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.#waiters = this.#waiters.filter(w => w.resolve !== resolve);
        resolve(null);
      }, timeout);
      this.#waiters.push({
        resolve: (frame) => { clearTimeout(timer); resolve(frame); }
      });
    });
  }

  waitForClose(timeout = 2000){
    if(this.closed) return Promise.resolve(true);
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(false), timeout);
      this.#socket.on('close', () => { clearTimeout(timer); resolve(true); });
    });
  }

  destroy(){
    this.#socket.destroy();
  }
}

/*
  Performs the opening handshake by hand. A header passed as null is omitted, which is how the tests
  produce a malformed handshake.
*/
export const rawHandshake = ({ port, path = '/', headers = {} }) => new Promise((resolve, reject) => {
  const key = crypto.randomBytes(16).toString('base64');
  const merged = {
    Host: `localhost:${port}`,
    Upgrade: 'websocket',
    Connection: 'Upgrade',
    'Sec-WebSocket-Key': key,
    'Sec-WebSocket-Version': '13',
    ...headers
  };

  const socket = net.connect(port, '127.0.0.1', () => {
    const lines = [`GET ${path} HTTP/1.1`];
    for(const [name, value] of Object.entries(merged)){
      if(value === null) continue;
      lines.push(`${name}: ${value}`);
    }
    socket.write(`${lines.join('\r\n')}\r\n\r\n`);
  });

  let buffer = Buffer.alloc(0);
  const onData = (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    const end = buffer.indexOf('\r\n\r\n');
    if(end === -1) return;

    socket.off('data', onData);
    const head = buffer.subarray(0, end).toString('latin1');
    const rest = buffer.subarray(end + 4);
    const status = parseInt(head.split('\r\n')[0].split(' ')[1], 10);

    resolve({
      socket,
      status,
      head,
      rest,
      sentKey: key,
      header: (name) => {
        const match = head.split('\r\n').find(line => line.toLowerCase().startsWith(`${name.toLowerCase()}:`));
        return match ? match.slice(match.indexOf(':') + 1).trim() : undefined;
      },
      client: () => new RawWsClient(socket, rest)
    });
  };

  socket.on('data', onData);
  socket.on('error', reject);
  setTimeout(() => reject(new Error('handshake timeout')), 4000);
});
