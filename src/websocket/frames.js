/*
  RFC 6455 frame encoding and decoding, on Node built-ins only.

  kempo-server is zero-dependency, so the wire format is implemented here rather than delegated to
  `ws`. Everything in this file is pure: it turns Buffers into frames and frames into Buffers, and
  knows nothing about sockets, routing or config.
*/

export const OPCODES = {
  CONTINUATION: 0x0,
  TEXT: 0x1,
  BINARY: 0x2,
  CLOSE: 0x8,
  PING: 0x9,
  PONG: 0xa
};

const KNOWN_OPCODES = new Set(Object.values(OPCODES));

/*
  The magic string from RFC 6455 section 1.3. Concatenated with the client's Sec-WebSocket-Key and
  hashed to prove the server understood the handshake rather than blindly echoing it.
*/
export const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

export const CLOSE_CODES = {
  NORMAL: 1000,
  GOING_AWAY: 1001,
  PROTOCOL_ERROR: 1002,
  INVALID_PAYLOAD: 1007,
  POLICY_VIOLATION: 1008,
  TOO_LARGE: 1009,
  INTERNAL_ERROR: 1011
};

/*
  A protocol violation that must close the connection with a specific code. Thrown by the parser and
  caught by the socket, which turns it into a close frame.
*/
export class WsError extends Error {
  constructor(code, message){
    super(message);
    this.name = 'WsError';
    this.code = code;
  }
}

/*
  1004, 1005 and 1006 are reserved and must never appear on the wire; 1000-1003 and 1007-1011 are
  the codes a peer may send, 3000-4999 are for libraries and applications.
*/
export const isValidCloseCode = (code) =>
  (code >= 1000 && code <= 1003) ||
  (code >= 1007 && code <= 1011) ||
  (code >= 3000 && code <= 4999);

const utf8 = new TextDecoder('utf-8', { fatal: true });

/*
  Strict UTF-8 decode. Text frames and close reasons carry UTF-8 by spec and invalid bytes are a
  1007, so the lenient default decoder (which silently substitutes U+FFFD) cannot be used.
*/
export const decodeUtf8 = (buffer) => {
  try {
    return utf8.decode(buffer);
  } catch {
    throw new WsError(CLOSE_CODES.INVALID_PAYLOAD, 'Invalid UTF-8 in payload');
  }
};

/*
  Server-to-client frames are never masked (RFC 6455 section 5.1), so the mask bit stays clear and
  no masking key is written.
*/
export const encodeFrame = ({ opcode, payload = Buffer.alloc(0), fin = true }) => {
  const length = payload.length;
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
    // A Buffer cannot exceed 32 bits of length here, so the high word is always zero
    header.writeUInt32BE(0, 2);
    header.writeUInt32BE(length, 6);
  }

  header[0] = (fin ? 0x80 : 0x00) | opcode;
  return Buffer.concat([header, payload]);
};

export const encodeClose = (code, reason = '') => {
  if(code === undefined) return encodeFrame({ opcode: OPCODES.CLOSE });
  const reasonBuffer = Buffer.from(reason, 'utf8');
  const payload = Buffer.allocUnsafe(2 + reasonBuffer.length);
  payload.writeUInt16BE(code, 0);
  reasonBuffer.copy(payload, 2);
  return encodeFrame({ opcode: OPCODES.CLOSE, payload });
};

/*
  A close payload is either empty, or a 2-byte code optionally followed by a UTF-8 reason. A single
  byte is malformed, and an out-of-range code is a protocol error rather than a payload error.
*/
export const decodeClose = (payload) => {
  if(payload.length === 0) return { code: undefined, reason: '' };
  if(payload.length === 1) throw new WsError(CLOSE_CODES.PROTOCOL_ERROR, 'Close payload must be empty or at least 2 bytes');

  const code = payload.readUInt16BE(0);
  if(!isValidCloseCode(code)) throw new WsError(CLOSE_CODES.PROTOCOL_ERROR, `Invalid close code ${code}`);

  return { code, reason: decodeUtf8(payload.subarray(2)) };
};

/*
  Incrementally parses frames out of a TCP byte stream. `push` returns every frame that is complete
  after the new chunk and retains the remainder, because a TCP read boundary has nothing to do with
  a frame boundary — one read can hold several frames, or a fraction of one.
*/
export class FrameParser {
  #buffer = Buffer.alloc(0);
  #maxPayloadSize;

  constructor(maxPayloadSize){
    this.#maxPayloadSize = maxPayloadSize;
  }

  push(chunk){
    this.#buffer = this.#buffer.length ? Buffer.concat([this.#buffer, chunk]) : chunk;

    const frames = [];
    let frame;
    while((frame = this.#shift())){
      frames.push(frame);
    }
    return frames;
  }

  // Returns the next complete frame, or null when more bytes are needed.
  #shift(){
    const buffer = this.#buffer;
    if(buffer.length < 2) return null;

    const fin = (buffer[0] & 0x80) !== 0;
    const reserved = buffer[0] & 0x70;
    const opcode = buffer[0] & 0x0f;
    const masked = (buffer[1] & 0x80) !== 0;
    let length = buffer[1] & 0x7f;
    let offset = 2;

    // No extensions are negotiated, so any reserved bit set means the peer is speaking a dialect we did not agree to
    if(reserved !== 0) throw new WsError(CLOSE_CODES.PROTOCOL_ERROR, 'Reserved bits must be zero');
    if(!KNOWN_OPCODES.has(opcode)) throw new WsError(CLOSE_CODES.PROTOCOL_ERROR, `Unknown opcode 0x${opcode.toString(16)}`);

    if(opcode >= 0x8){
      if(length > 125) throw new WsError(CLOSE_CODES.PROTOCOL_ERROR, 'Control frame payload must be 125 bytes or fewer');
      if(!fin) throw new WsError(CLOSE_CODES.PROTOCOL_ERROR, 'Control frame must not be fragmented');
    }

    if(length === 126){
      if(buffer.length < offset + 2) return null;
      length = buffer.readUInt16BE(offset);
      offset += 2;
    } else if(length === 127){
      if(buffer.length < offset + 8) return null;
      const high = buffer.readUInt32BE(offset);
      const low = buffer.readUInt32BE(offset + 4);
      /*
        The high bit must be clear per spec, and anything above 2^53-1 cannot be represented exactly
        as a JS number. Both are far past any size worth buffering, so they collapse into one check.
      */
      if(high > 0x001fffff) throw new WsError(CLOSE_CODES.TOO_LARGE, 'Payload length exceeds the maximum representable size');
      length = high * 0x100000000 + low;
      offset += 8;
    }

    // Checked against the declared length, before the payload is buffered, so an oversized claim costs nothing
    if(length > this.#maxPayloadSize) throw new WsError(CLOSE_CODES.TOO_LARGE, 'Message exceeds the configured maximum size');
    if(!masked) throw new WsError(CLOSE_CODES.PROTOCOL_ERROR, 'Client frames must be masked');

    if(buffer.length < offset + 4) return null;
    const maskKey = buffer.subarray(offset, offset + 4);
    offset += 4;

    if(buffer.length < offset + length) return null;
    const payload = Buffer.allocUnsafe(length);
    for(let i = 0; i < length; i++){
      payload[i] = buffer[offset + i] ^ maskKey[i & 3];
    }

    this.#buffer = buffer.subarray(offset + length);
    return { fin, opcode, payload };
  }
}
