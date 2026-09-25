import http from 'http';
import KempoSocket from './socket.js';
import { validateHandshake } from './handshake.js';
import { CLOSE_CODES } from './frames.js';
import { sockets, closeAll } from './registry.js';
import createRequestWrapper from '../requestWrapper.js';
import createResponseWrapper from '../responseWrapper.js';

export { sockets, broadcast, closeAll } from './registry.js';
export { default as KempoSocket } from './socket.js';
export { CLOSE_CODES, OPCODES } from './frames.js';

export const defaultWebsocketConfig = {
  enabled: true,
  maxMessageSize: 1048576,
  allowedOrigins: null,
  requireOrigin: false,
  heartbeatInterval: 30000,
  heartbeatTimeout: 10000
};

/*
  Headers a middleware set for an ordinary response but which are meaningless or actively wrong on a
  101, whose body is not a body at all but the start of the frame stream.
*/
const SKIPPED_UPGRADE_HEADERS = new Set([
  'content-type',
  'content-length',
  'content-encoding',
  'transfer-encoding',
  'connection',
  'upgrade'
]);

const writeHttpResponse = (socket, status, message, extraHeaders = {}) => {
  if(socket.destroyed) return;

  const body = message || http.STATUS_CODES[status] || '';
  const headers = {
    'Content-Type': 'text/plain',
    'Content-Length': Buffer.byteLength(body),
    Connection: 'close',
    ...extraHeaders
  };

  const head = Object.entries(headers)
    .map(([name, value]) => `${name}: ${value}`)
    .join('\r\n');

  socket.end(`HTTP/1.1 ${status} ${http.STATUS_CODES[status] || 'Error'}\r\n${head}\r\n\r\n${body}`);
};

const writeUpgradeResponse = (socket, accept, extraHeaders) => {
  const lines = [
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${accept}`
  ];

  for(const [name, value] of Object.entries(extraHeaders)){
    if(SKIPPED_UPGRADE_HEADERS.has(name.toLowerCase())) continue;
    lines.push(`${name}: ${Array.isArray(value) ? value.join(', ') : value}`);
  }

  socket.write(`${lines.join('\r\n')}\r\n\r\n`);
};

/*
  Builds the listener for the server's `upgrade` event.

  Registering an `upgrade` listener diverts every upgrade request away from Node's `request` event, and
  therefore away from the router entirely — so route resolution, the request wrapper and the middleware
  chain all have to be driven explicitly here rather than inherited. In exchange, an upgrade never
  touches the HTTP path: there is no body to buffer and no response to serve.

  `resolveRoute` is supplied by the router, which owns the file list and its rescan behaviour.
*/
export const createUpgradeHandler = ({ resolveRoute, loadModule, runMiddleware, config, log }) => {
  const websocketConfig = { ...defaultWebsocketConfig, ...(config.websocket || {}) };
  const hookedServers = new WeakSet();

  return async (request, socket, head) => {
    /*
      Hooked from the first upgrade rather than at construction, because the router builds this handler
      before any http.Server exists. `close` is wrapped rather than listened for: the server only emits its
      'close' event once every connection has ended, and an open socket is such a connection, so waiting
      on the event would wait on the very thing it is meant to trigger. Only this server's sockets are
      closed, so two servers in one process do not close each other's connections.
    */
    const server = socket.server;
    if(server && !hookedServers.has(server)){
      hookedServers.add(server);
      const close = server.close.bind(server);
      server.close = (...args) => {
        for(const open of sockets({ filter: (candidate) => candidate.server === server })){
          open.close(CLOSE_CODES.GOING_AWAY, 'Server shutting down');
        }
        return close(...args);
      };
    }

    /*
      Attached before anything else can fail. A bare TCP socket with no error listener turns a routine
      client disconnect into an uncaught 'error' event, which takes down the process.
    */
    socket.on('error', (error) => {
      log(`WebSocket socket error before upgrade: ${error.message}`, 3);
    });

    if(!websocketConfig.enabled){
      return writeHttpResponse(socket, 404, 'Not Found');
    }

    const handshake = validateHandshake(request, websocketConfig);
    if(!handshake.ok){
      log(`WebSocket handshake rejected (${handshake.status}): ${handshake.message}`, 2);
      return writeHttpResponse(socket, handshake.status, handshake.message, handshake.headers);
    }

    const requestPath = (request.url || '/').split('?')[0];

    let route;
    try {
      route = await resolveRoute(requestPath);
    } catch(error) {
      log(`WebSocket route resolution failed for ${requestPath}: ${error.message}`, 0);
      return writeHttpResponse(socket, 500, 'Internal Server Error');
    }

    if(!route){
      log(`WebSocket 404 - no WS.js for: ${requestPath}`, 1);
      return writeHttpResponse(socket, 404, 'Not Found');
    }

    /*
      Middleware gets the same enhanced request and response an HTTP request would, built once and up front.
      Custom middleware relies on it: kempo's own reads `request.path` and `request.cookies` and calls
      `response.redirect()`, none of which exist on a raw IncomingMessage / ServerResponse, so handing it
      the raw objects made it throw and killed every handshake. The route then receives this same request
      object rather than a fresh one, because middleware attaching data to the request (a user, a session)
      is the documented convention and would otherwise be silently discarded.

      The response is a real ServerResponse bound to the socket, so a middleware that ends it rejects the
      upgrade with a correct HTTP response. It is detached before the 101 is written, so the handshake
      bytes are ours alone.
    */
    const enhancedRequest = createRequestWrapper(request, route.params);
    const rawResponse = new http.ServerResponse(request);
    rawResponse.assignSocket(socket);
    /*
      A rejected upgrade must not leave the connection open waiting for a next request. `shouldKeepAlive`
      only decides the Connection header; closing the socket is normally done by the HTTP server's own
      response plumbing, which a hand-made ServerResponse does not get, so it is ended here once the
      response has been fully written. A handshake that succeeds never ends this response (the 101 is
      written straight to the socket), so this only ever fires for a rejection.
    */
    rawResponse.shouldKeepAlive = false;
    rawResponse.once('finish', () => socket.end());
    const enhancedResponse = createResponseWrapper(rawResponse);

    let reached = false;
    try {
      await runMiddleware(enhancedRequest, enhancedResponse, async () => { reached = true; });
    } catch(error) {
      log(`WebSocket middleware threw for ${requestPath}: ${error.message}`, 0);
      if(!rawResponse.headersSent){
        rawResponse.statusCode = 500;
        rawResponse.setHeader('Content-Type', 'text/plain');
      }
      if(!rawResponse.writableEnded) rawResponse.end('Internal Server Error');
      return;
    }

    if(!reached){
      log(`WebSocket upgrade rejected by middleware: ${requestPath}`, 2);
      if(!rawResponse.writableEnded) rawResponse.end();
      return;
    }

    const collectedHeaders = rawResponse.getHeaders();
    rawResponse.detachSocket(socket);

    let handler;
    try {
      handler = await loadModule(route.filePath);
    } catch(error) {
      log(`Failed to load WebSocket route ${route.filePath}: ${error.message}`, 0);
      return writeHttpResponse(socket, 500, 'Internal Server Error');
    }

    if(typeof handler !== 'function'){
      log(`WebSocket route does not export a function: ${route.filePath}`, 0);
      return writeHttpResponse(socket, 500, 'Route file does not export a function');
    }

    // `body` stays null: an upgrade has no body
    const kempoSocket = new KempoSocket({
      socket,
      server,
      path: requestPath,
      params: route.params,
      query: enhancedRequest.query,
      headers: request.headers,
      cookies: enhancedRequest.cookies,
      config: websocketConfig,
      log
    });

    /*
      The route runs before the 101 so it can authenticate and refuse. A throw here has no socket to
      close yet, so it becomes a 500 rather than a 1011 — once the connection is open, a throw inside an
      event handler is what closes it with 1011.
    */
    try {
      await handler(enhancedRequest, kempoSocket);
    } catch(error) {
      log(`WebSocket route threw for ${requestPath}: ${error.message}`, 0);
      return writeHttpResponse(socket, 500, 'Internal Server Error');
    }

    const rejection = kempoSocket.rejection;
    if(rejection){
      log(`WebSocket upgrade refused by route (${rejection.status}): ${requestPath}`, 2);
      return writeHttpResponse(socket, rejection.status, rejection.message);
    }

    if(socket.destroyed){
      log(`WebSocket client disconnected before the handshake completed: ${requestPath}`, 3);
      return;
    }

    writeUpgradeResponse(socket, handshake.accept, collectedHeaders);
    kempoSocket.accept(head);
    log(`WebSocket connected: ${requestPath}`, 2);
  };
};

/*
  Sends 1001 to every open socket. Called on server close and on SIGINT so a restart does not leave
  browsers guessing at a connection that is already gone.
*/
export const closeAllSockets = (reason = 'Server shutting down') => {
  const open = sockets();
  closeAll(CLOSE_CODES.GOING_AWAY, reason);
  return open.length;
};

export default createUpgradeHandler;
