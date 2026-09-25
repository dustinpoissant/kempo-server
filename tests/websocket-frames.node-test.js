import crypto from 'crypto';
import {
  OPCODES,
  CLOSE_CODES,
  FrameParser,
  WsError,
  encodeFrame,
  encodeClose,
  decodeClose,
  decodeUtf8,
  isValidCloseCode
} from '../src/websocket/frames.js';
import { computeAccept, isOriginAllowed, validateHandshake } from '../src/websocket/handshake.js';

// Frames the parser accepts are masked, so tests build them the way a client would
const mask = (opcode, payload, { fin = true, rsv = 0, masked = true } = {}) => {
  const body = Buffer.isBuffer(payload) ? payload : Buffer.from(payload ?? '', 'utf8');
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
  if(!masked) return Buffer.concat([header, body]);

  header[1] |= 0x80;
  const key = crypto.randomBytes(4);
  const out = Buffer.allocUnsafe(length);
  for(let i = 0; i < length; i++) out[i] = body[i] ^ key[i & 3];
  return Buffer.concat([header, key, out]);
};

const expectWsError = (fn, code) => {
  try {
    fn();
  } catch(error) {
    if(!(error instanceof WsError)) return `threw ${error.name}, not WsError`;
    if(error.code !== code) return `closed with ${error.code}, expected ${code}`;
    return null;
  }
  return `expected a WsError ${code}, nothing thrown`;
};

export default {
  'accept key matches the RFC 6455 example': async ({pass, fail}) => {
    const accept = computeAccept('dGhlIHNhbXBsZSBub25jZQ==');
    if(accept !== 's3pPLMBiTxaQ9kYGzzhZRbK+xOo=') return fail(`got ${accept}`);
    pass('accept key');
  },

  'a short payload round-trips through the parser': async ({pass, fail}) => {
    const parser = new FrameParser(1024);
    const frames = parser.push(mask(OPCODES.TEXT, 'hello'));
    if(frames.length !== 1) return fail(`got ${frames.length} frames`);
    if(frames[0].payload.toString() !== 'hello') return fail('payload mismatch');
    if(frames[0].opcode !== OPCODES.TEXT) return fail('opcode mismatch');
    pass('7-bit length');
  },

  'all three payload length forms parse': async ({pass, fail}) => {
    for(const size of [125, 126, 65535, 65536, 70000]){
      const parser = new FrameParser(1000000);
      const payload = crypto.randomBytes(size);
      const frames = parser.push(mask(OPCODES.BINARY, payload));
      if(frames.length !== 1) return fail(`size ${size}: got ${frames.length} frames`);
      if(!frames[0].payload.equals(payload)) return fail(`size ${size}: payload mismatch`);
    }
    pass('7-bit, 16-bit and 64-bit lengths');
  },

  'encoded frames use the smallest length form': async ({pass, fail}) => {
    if(encodeFrame({opcode: OPCODES.TEXT, payload: Buffer.alloc(125)}).length !== 127) return fail('7-bit header');
    if(encodeFrame({opcode: OPCODES.TEXT, payload: Buffer.alloc(126)}).length !== 130) return fail('16-bit header');
    if(encodeFrame({opcode: OPCODES.TEXT, payload: Buffer.alloc(65536)}).length !== 65546) return fail('64-bit header');
    // The mask bit must be clear on every server-to-client frame
    if((encodeFrame({opcode: OPCODES.TEXT, payload: Buffer.from('x')})[1] & 0x80) !== 0) return fail('server frame must not be masked');
    pass('length forms and mask bit');
  },

  'a frame split across chunks is reassembled': async ({pass, fail}) => {
    const parser = new FrameParser(1024);
    const frame = mask(OPCODES.TEXT, 'split across reads');

    for(const cut of [1, 2, 5, frame.length - 1]){
      const fresh = new FrameParser(1024);
      if(fresh.push(frame.subarray(0, cut)).length !== 0) return fail(`cut at ${cut} produced a frame early`);
      const frames = fresh.push(frame.subarray(cut));
      if(frames.length !== 1) return fail(`cut at ${cut}: got ${frames.length}`);
      if(frames[0].payload.toString() !== 'split across reads') return fail(`cut at ${cut}: payload`);
    }

    // Several frames arriving in one read all come back
    const many = parser.push(Buffer.concat([mask(OPCODES.TEXT, 'a'), mask(OPCODES.TEXT, 'b'), mask(OPCODES.TEXT, 'c')]));
    if(many.length !== 3) return fail(`expected 3 frames in one read, got ${many.length}`);
    pass('TCP boundaries are not frame boundaries');
  },

  'an unmasked client frame is a protocol error': async ({pass, fail}) => {
    const problem = expectWsError(
      () => new FrameParser(1024).push(mask(OPCODES.TEXT, 'nope', {masked: false})),
      CLOSE_CODES.PROTOCOL_ERROR
    );
    if(problem) return fail(problem);
    pass('unmasked frame closes with 1002');
  },

  'reserved bits and unknown opcodes are protocol errors': async ({pass, fail}) => {
    const rsv = expectWsError(() => new FrameParser(1024).push(mask(OPCODES.TEXT, 'x', {rsv: 1})), CLOSE_CODES.PROTOCOL_ERROR);
    if(rsv) return fail(`reserved bits: ${rsv}`);

    const unknown = expectWsError(() => new FrameParser(1024).push(mask(0x3, 'x')), CLOSE_CODES.PROTOCOL_ERROR);
    if(unknown) return fail(`unknown opcode: ${unknown}`);
    pass('1002 for reserved bits and unknown opcodes');
  },

  'control frames must be short and unfragmented': async ({pass, fail}) => {
    const tooBig = expectWsError(
      () => new FrameParser(65536).push(mask(OPCODES.PING, crypto.randomBytes(126))),
      CLOSE_CODES.PROTOCOL_ERROR
    );
    if(tooBig) return fail(`oversized control frame: ${tooBig}`);

    const fragmented = expectWsError(
      () => new FrameParser(1024).push(mask(OPCODES.PING, 'x', {fin: false})),
      CLOSE_CODES.PROTOCOL_ERROR
    );
    if(fragmented) return fail(`fragmented control frame: ${fragmented}`);
    pass('1002 for bad control frames');
  },

  'a frame larger than the limit is refused from its header': async ({pass, fail}) => {
    const problem = expectWsError(
      () => new FrameParser(10).push(mask(OPCODES.TEXT, 'this is longer than ten bytes')),
      CLOSE_CODES.TOO_LARGE
    );
    if(problem) return fail(problem);
    pass('1009 on an oversized frame');
  },

  'invalid UTF-8 is a payload error': async ({pass, fail}) => {
    const problem = expectWsError(() => decodeUtf8(Buffer.from([0xff, 0xfe])), CLOSE_CODES.INVALID_PAYLOAD);
    if(problem) return fail(problem);
    if(decodeUtf8(Buffer.from('héllo', 'utf8')) !== 'héllo') return fail('valid UTF-8 should decode');
    pass('1007 on invalid UTF-8');
  },

  'close payloads encode and decode': async ({pass, fail}) => {
    const decoded = decodeClose(encodeClose(1000, 'bye').subarray(2));
    if(decoded.code !== 1000 || decoded.reason !== 'bye') return fail(`got ${JSON.stringify(decoded)}`);

    const empty = decodeClose(Buffer.alloc(0));
    if(empty.code !== undefined) return fail('empty payload should have no code');

    const oneByte = expectWsError(() => decodeClose(Buffer.from([0x03])), CLOSE_CODES.PROTOCOL_ERROR);
    if(oneByte) return fail(`single byte: ${oneByte}`);

    // 1005 is reserved and must never appear on the wire
    const reserved = expectWsError(() => decodeClose(Buffer.from([0x03, 0xed])), CLOSE_CODES.PROTOCOL_ERROR);
    if(reserved) return fail(`reserved code: ${reserved}`);

    if(isValidCloseCode(1005) || isValidCloseCode(1006) || isValidCloseCode(999)) return fail('reserved codes accepted');
    if(!isValidCloseCode(1000) || !isValidCloseCode(3000) || !isValidCloseCode(4999)) return fail('valid codes rejected');
    pass('close code handling');
  },

  'origin defaults to same-origin and can be overridden': async ({pass, fail}) => {
    if(!isOriginAllowed('http://site.test', 'site.test', {})) return fail('same origin should pass');
    if(isOriginAllowed('http://evil.test', 'site.test', {})) return fail('cross origin should fail');
    if(!isOriginAllowed('http://evil.test', 'site.test', {allowedOrigins: '*'})) return fail('wildcard should pass');
    if(!isOriginAllowed('http://a.test', 'site.test', {allowedOrigins: ['http://a.test']})) return fail('allow-list should pass');
    if(isOriginAllowed('http://b.test', 'site.test', {allowedOrigins: ['http://a.test']})) return fail('off allow-list should fail');
    if(isOriginAllowed('not a url', 'site.test', {})) return fail('unparseable origin should fail');

    // A missing Origin means a non-browser client, allowed unless explicitly required
    if(!isOriginAllowed(undefined, 'site.test', {})) return fail('absent origin should pass by default');
    if(isOriginAllowed(undefined, 'site.test', {requireOrigin: true})) return fail('absent origin should fail when required');
    pass('origin policy');
  },

  'two copies of the module share one registry': async ({pass, fail}) => {
    /*
      kempo-server can appear twice in a resolved tree — it is symlinked in local development, and a
      consumer may hoist one copy while a nested dependency keeps another. Two import URLs produce two
      distinct module instances, which is exactly that situation: if the registry lived in module scope,
      a socket registered through one copy would be invisible to the other and pushing from outside the
      route would silently reach nobody.
    */
    const base = new URL('../src/websocket/registry.js', import.meta.url).href;
    const copyA = await import(`${base}?copy=a`);
    const copyB = await import(`${base}?copy=b`);

    if(copyA === copyB) return fail('the two imports were deduplicated, so this proves nothing');

    const fakeSocket = {path: '/shared', data: {}, send: () => true};
    copyA.register(fakeSocket);

    try {
      const seenByB = copyB.sockets({path: '/shared'});
      if(seenByB.length !== 1) return fail(`copy B saw ${seenByB.length} sockets, expected 1`);
      if(copyB.broadcast('x', {path: '/shared'}) !== 1) return fail('copy B could not broadcast to it');
    } finally {
      copyB.unregister(fakeSocket);
    }

    if(copyA.sockets({path: '/shared'}).length !== 0) return fail('unregister through copy B did not reach copy A');
    pass('registry is shared across module copies');
  },

  'handshake validation covers each required header': async ({pass, fail}) => {
    const base = {
      method: 'GET',
      headers: {
        host: 'site.test',
        upgrade: 'websocket',
        connection: 'Upgrade',
        'sec-websocket-key': crypto.randomBytes(16).toString('base64'),
        'sec-websocket-version': '13'
      }
    };

    if(!validateHandshake(base, {}).ok) return fail('a valid handshake should pass');

    const cases = [
      [{...base, method: 'POST'}, 400, 'non-GET'],
      [{...base, headers: {...base.headers, upgrade: 'h2c'}}, 400, 'wrong Upgrade'],
      [{...base, headers: {...base.headers, connection: 'keep-alive'}}, 400, 'wrong Connection'],
      [{...base, headers: {...base.headers, 'sec-websocket-version': '8'}}, 426, 'old version'],
      [{...base, headers: {...base.headers, 'sec-websocket-key': 'tooshort'}}, 400, 'bad key'],
      [{...base, headers: {...base.headers, origin: 'http://evil.test'}}, 403, 'bad origin']
    ];

    for(const [request, status, label] of cases){
      const result = validateHandshake(request, {});
      if(result.ok) return fail(`${label} should have been rejected`);
      if(result.status !== status) return fail(`${label}: got ${result.status}, expected ${status}`);
    }

    // A 426 has to tell the client which version to speak
    const versionFail = validateHandshake({...base, headers: {...base.headers, 'sec-websocket-version': '8'}}, {});
    if(versionFail.headers?.['Sec-WebSocket-Version'] !== '13') return fail('426 must advertise version 13');

    // Connection often carries more than one token
    if(!validateHandshake({...base, headers: {...base.headers, connection: 'keep-alive, Upgrade'}}, {}).ok){
      return fail('a multi-token Connection header should pass');
    }
    pass('handshake validation');
  }
};
