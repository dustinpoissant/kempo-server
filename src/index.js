#!/usr/bin/env node
import http from 'http';
import router from './router.js';
import { closeAllSockets } from './websocket/index.js';
import getFlags from './getFlags.js';

const flags = getFlags(process.argv.slice(2), {
  port: 3000,
  logging: 2,
  root: './',
  config: '.config.js'
}, {
  p: 'port',
  l: 'logging',
  r: 'root',
  c: 'config'
});

if(typeof(flags.logging) === 'string'){
  switch(flags.logging.toLowerCase()) {
    case 'silent':
      flags.logging = 0;
      break;
    case 'minimal':
      flags.logging = 1;
      break;
    case 'verbose':
      flags.logging = 3;
      break;
    case 'debug':
      flags.logging = 4;
      break;
    default:
      flags.logging = 2;
      break;
  }
}

const log = (message, level = 2) => {
  if(level <= flags.logging){
    console.log(message);
  }
}

const handler = await router(flags, log);
const server = http.createServer(handler);

/*
  Upgrades arrive on their own event, never as a `request`, so without this listener a handshake is
  served as an ordinary GET and the browser gets whatever page sits at that path instead of a socket.
*/
server.on('upgrade', handler.upgrade);

/*
  Open sockets are told the server is going away rather than left to time out, so a browser can
  reconnect immediately instead of waiting on a connection that is already dead.
*/
const shutdown = () => {
  const closed = closeAllSockets();
  if(closed) log(`Closed ${closed} WebSocket connection(s)`, 2);
  server.close(() => process.exit(0));
  // A keep-alive connection can outlive server.close(), so the exit is bounded rather than trusted
  setTimeout(() => process.exit(0), 2000).unref();
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

server.listen(flags.port);
log(`Server started at: http://localhost:${flags.port}`);

