import {
  OPCODES,
  CLOSE_CODES,
  FrameParser,
  WsError,
  encodeFrame,
  encodeClose,
  decodeClose,
  decodeUtf8
} from './frames.js';
import { register, unregister } from './registry.js';

/*
  The object a WS.js route is handed. It owns one TCP socket for the life of one connection: frame
  assembly, the close handshake, the heartbeat, and the guarantee that nothing a route does can take
  down the process or another connection.

  A route is invoked while the socket is still `connecting`, before the 101 goes out, which is what
  lets it authenticate and call `reject(401)` so no socket is ever established. Sends made during that
  window are queued and flushed once the handshake completes.
*/
export default class KempoSocket {
  #socket;
  #parser;
  #log;
  #maxMessageSize;
  #heartbeatInterval;
  #heartbeatTimeout;
  #heartbeatTimer = null;
  #pongTimer = null;
  #closeTimer = null;
  #awaitingPong = false;
  #lastActivity = Date.now();
  #listeners = new Map();
  #sendQueue = [];
  #fragments = [];
  #fragmentOpcode = null;
  #fragmentSize = 0;
  #closeFrameSent = false;
  #rejection = null;

  readyState = 'connecting';
  /*
    Scratch space for the route: anything stashed here (a user id, a room name) is what
    `sockets({ filter })` selects on from outside. Deliberately a plain object with no schema.
  */
  data = {};

  constructor({ socket, path, params = {}, query = {}, headers = {}, cookies = {}, config = {}, log = () => {} }){
    this.#socket = socket;
    this.path = path;
    this.params = params;
    this.query = query;
    this.headers = headers;
    this.cookies = cookies;
    this.#log = log;
    this.#maxMessageSize = config.maxMessageSize ?? 1048576;
    this.#heartbeatInterval = config.heartbeatInterval ?? 30000;
    this.#heartbeatTimeout = config.heartbeatTimeout ?? 10000;
    this.#parser = new FrameParser(this.#maxMessageSize);
  }

  /*
    Events
  */
  on(event, handler){
    if(!this.#listeners.has(event)) this.#listeners.set(event, []);
    this.#listeners.get(event).push(handler);
    return this;
  }

  off(event, handler){
    const handlers = this.#listeners.get(event);
    if(handlers) this.#listeners.set(event, handlers.filter(h => h !== handler));
    return this;
  }

  /*
    Route callbacks are untrusted: a throw must not escape into the upgrade handler or the process.
    Async listeners are covered too, since a rejected promise from an `async` callback is invisible to
    a try/catch around the call. Either way the connection dies with 1011 and the rest survive.
  */
  #emit(event, ...args){
    for(const handler of this.#listeners.get(event) || []){
      try {
        const result = handler(...args);
        if(result && typeof result.then === 'function'){
          result.catch(error => this.#handlerFailed(event, error));
        }
      } catch(error) {
        this.#handlerFailed(event, error);
      }
    }
  }

  #handlerFailed(event, error){
    this.#log(`WebSocket '${event}' handler threw for ${this.path}: ${error.message}`, 0);
    // An error listener that itself throws must not recurse into another close
    if(event === 'error'){
      this.#destroy(CLOSE_CODES.INTERNAL_ERROR, 'Error handler failed');
      return;
    }
    this.#emit('error', error);
    this.close(CLOSE_CODES.INTERNAL_ERROR, 'Internal error');
  }

  /*
    Lifecycle
  */

  // Refuses the upgrade with an HTTP status. Only meaningful before the handshake completes.
  reject(status = 403, message){
    if(this.readyState !== 'connecting'){
      this.#log(`WebSocket reject() ignored for ${this.path}: connection is already open`, 1);
      return false;
    }
    this.#rejection = { status, message };
    return true;
  }

  get rejection(){
    return this.#rejection;
  }

  /*
    Called by the upgrade handler once the 101 has been written. `head` is whatever arrived in the same
    TCP segment as the handshake and must be parsed before any later chunk.
  */
  accept(head){
    this.readyState = 'open';
    register(this);

    this.#socket.setNoDelay(true);
    this.#socket.setTimeout(0);
    this.#socket.on('data', this.#onData);
    this.#socket.on('close', this.#onSocketClose);
    this.#socket.on('error', this.#onSocketError);

    for(const frame of this.#sendQueue) this.#write(frame);
    this.#sendQueue = [];

    if(this.#heartbeatInterval > 0) this.#startHeartbeat();
    this.#emit('open');
    if(head && head.length) this.#onData(head);
  }

  /*
    Messaging
  */

  // Returns false when the socket cannot accept data, rather than throwing into route code.
  send(data){
    if(this.readyState === 'closed' || this.readyState === 'closing') return false;

    const isBinary = Buffer.isBuffer(data) || data instanceof Uint8Array || data instanceof ArrayBuffer;
    const payload = isBinary
      ? Buffer.from(data instanceof ArrayBuffer ? new Uint8Array(data) : data)
      : Buffer.from(typeof data === 'string' ? data : JSON.stringify(data), 'utf8');

    const frame = encodeFrame({
      opcode: isBinary ? OPCODES.BINARY : OPCODES.TEXT,
      payload
    });

    if(this.readyState === 'connecting'){
      this.#sendQueue.push(frame);
      return true;
    }
    return this.#write(frame);
  }

  ping(payload = Buffer.alloc(0)){
    if(this.readyState !== 'open') return false;
    return this.#write(encodeFrame({ opcode: OPCODES.PING, payload: Buffer.from(payload) }));
  }

  pong(payload = Buffer.alloc(0)){
    if(this.readyState !== 'open') return false;
    return this.#write(encodeFrame({ opcode: OPCODES.PONG, payload: Buffer.from(payload) }));
  }

  // Starts the closing handshake and waits for the peer to answer before tearing down.
  close(code = CLOSE_CODES.NORMAL, reason = ''){
    if(this.readyState === 'closed' || this.readyState === 'closing') return;

    if(this.readyState === 'connecting'){
      this.#teardown();
      return;
    }

    this.readyState = 'closing';
    if(!this.#closeFrameSent){
      this.#closeFrameSent = true;
      this.#write(encodeClose(code, reason));
    }

    /*
      A peer that never answers must not hold the socket open forever, so the close is bounded and then
      forced. Unref'd so a pending close cannot keep the process alive.
    */
    const timer = setTimeout(() => this.#destroy(code, reason), this.#heartbeatTimeout);
    timer.unref?.();
    this.#closeTimer = timer;
  }

  // Drops the connection immediately, without a closing handshake.
  terminate(){
    this.#destroy(CLOSE_CODES.GOING_AWAY, 'Terminated');
  }

  /*
    Internals
  */

  #write(frame){
    if(this.#socket.destroyed || this.#socket.writableEnded) return false;
    try {
      this.#socket.write(frame);
      return true;
    } catch(error) {
      // A peer that vanished mid-write is ordinary, not a route error
      this.#log(`WebSocket write failed for ${this.path}: ${error.message}`, 3);
      return false;
    }
  }

  #onData = (chunk) => {
    this.#lastActivity = Date.now();

    let frames;
    try {
      frames = this.#parser.push(chunk);
    } catch(error) {
      if(error instanceof WsError) return this.#failProtocol(error);
      throw error;
    }

    for(const frame of frames){
      try {
        this.#handleFrame(frame);
      } catch(error) {
        if(error instanceof WsError) return this.#failProtocol(error);
        throw error;
      }
    }
  };

  #failProtocol(error){
    this.#log(`WebSocket protocol error on ${this.path}: ${error.message}`, 2);
    if(this.readyState === 'open' && !this.#closeFrameSent){
      this.#closeFrameSent = true;
      this.#write(encodeClose(error.code, error.message));
    }
    this.#destroy(error.code, error.message);
  }

  #handleFrame({ fin, opcode, payload }){
    if(opcode === OPCODES.CLOSE){
      const { code, reason } = decodeClose(payload);
      if(!this.#closeFrameSent){
        this.#closeFrameSent = true;
        // Echo the peer's code back, per RFC 6455 section 5.5.1
        this.#write(encodeClose(code ?? CLOSE_CODES.NORMAL, ''));
      }
      this.#destroy(code ?? CLOSE_CODES.NORMAL, reason);
      return;
    }

    if(opcode === OPCODES.PING){
      this.pong(payload);
      this.#emit('ping', payload);
      return;
    }

    if(opcode === OPCODES.PONG){
      this.#awaitingPong = false;
      if(this.#pongTimer) clearTimeout(this.#pongTimer);
      this.#emit('pong', payload);
      return;
    }

    if(opcode === OPCODES.CONTINUATION){
      if(this.#fragmentOpcode === null){
        throw new WsError(CLOSE_CODES.PROTOCOL_ERROR, 'Continuation frame with no message in progress');
      }
      this.#appendFragment(payload);
      if(fin) this.#completeMessage();
      return;
    }

    // A new data frame while a fragmented message is still open is a protocol error
    if(this.#fragmentOpcode !== null){
      throw new WsError(CLOSE_CODES.PROTOCOL_ERROR, 'Expected a continuation frame');
    }

    if(fin){
      this.#deliver(opcode, payload);
      return;
    }

    this.#fragmentOpcode = opcode;
    this.#fragments = [];
    this.#fragmentSize = 0;
    this.#appendFragment(payload);
  }

  /*
    The parser enforces the limit per frame; this is the limit on the reassembled total, which a peer
    could otherwise walk past with many small fragments.
  */
  #appendFragment(payload){
    this.#fragmentSize += payload.length;
    if(this.#fragmentSize > this.#maxMessageSize){
      throw new WsError(CLOSE_CODES.TOO_LARGE, 'Message exceeds the configured maximum size');
    }
    this.#fragments.push(payload);
  }

  #completeMessage(){
    const opcode = this.#fragmentOpcode;
    const payload = Buffer.concat(this.#fragments);
    this.#fragments = [];
    this.#fragmentOpcode = null;
    this.#fragmentSize = 0;
    this.#deliver(opcode, payload);
  }

  #deliver(opcode, payload){
    if(opcode === OPCODES.TEXT){
      this.#emit('message', decodeUtf8(payload), false);
      return;
    }
    this.#emit('message', payload, true);
  }

  /*
    Heartbeat
  */
  #startHeartbeat(){
    const timer = setInterval(() => {
      if(this.readyState !== 'open') return;
      // Only idle connections are probed; traffic is its own proof of life
      if(Date.now() - this.#lastActivity < this.#heartbeatInterval) return;

      this.#awaitingPong = true;
      this.ping();

      const pongTimer = setTimeout(() => {
        if(!this.#awaitingPong) return;
        this.#log(`WebSocket heartbeat timed out for ${this.path}`, 2);
        this.#destroy(CLOSE_CODES.GOING_AWAY, 'Heartbeat timeout');
      }, this.#heartbeatTimeout);
      pongTimer.unref?.();
      this.#pongTimer = pongTimer;
    }, this.#heartbeatInterval);

    timer.unref?.();
    this.#heartbeatTimer = timer;
  }

  #onSocketClose = () => {
    this.#destroy(CLOSE_CODES.GOING_AWAY, 'Socket closed');
  };

  #onSocketError = (error) => {
    this.#log(`WebSocket transport error on ${this.path}: ${error.message}`, 3);
    this.#destroy(CLOSE_CODES.INTERNAL_ERROR, error.message);
  };

  #teardown(){
    if(this.#heartbeatTimer) clearInterval(this.#heartbeatTimer);
    if(this.#pongTimer) clearTimeout(this.#pongTimer);
    if(this.#closeTimer) clearTimeout(this.#closeTimer);
    this.#heartbeatTimer = null;
    this.#pongTimer = null;
    this.#closeTimer = null;
    this.readyState = 'closed';
    unregister(this);
  }

  #destroy(code, reason){
    if(this.readyState === 'closed') return;
    this.#teardown();

    if(!this.#socket.destroyed) this.#socket.destroy();
    this.#emit('close', code, reason);
  }
}
