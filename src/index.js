#!/usr/bin/env node
import http from 'http';
import router from './router.js';
import getFlags from './getFlags.js';

const flags = getFlags(process.argv.slice(2), {
  port: 3000,
  logging: 2,
  root: './',
  config: '.config.json'
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

const server = http.createServer(await router(flags, log));
server.listen(flags.port);
log(`Server started at: http://localhost:${flags.port}`);

