import {Readable} from 'stream';
import {mkdtemp, rm, writeFile, mkdir} from 'fs/promises';
import os from 'os';
import path from 'path';

export const createMockReq = ({method = 'GET', url = '/', headers = {}, body = null, remoteAddress = '127.0.0.1'} = {}) => {
  const stream = new Readable({read(){}});
  stream.method = method;
  stream.url = url;
  stream.headers = headers;
  stream.socket = {remoteAddress};
  if(body !== null && body !== undefined){
    const data = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
    setImmediate(() => {
      stream.emit('data', Buffer.from(data));
      stream.emit('end');
    });
  } else {
    setImmediate(() => stream.emit('end'));
  }
  return stream;
};

export const createMockRes = () => {
  const headers = new Map();
  let ended = false;
  let statusCode = 200;
  const chunks = [];
  return {
    get statusCode(){return statusCode;},
    set statusCode(v){statusCode = v;},
    setHeader: (k, v) => headers.set(k, v),
    getHeader: (k) => headers.get(k),
    writeHead: (code, hdrs = {}) => {
      statusCode = code;
      Object.entries(hdrs).forEach(([k, v]) => headers.set(k, v));
    },
    write: (chunk) => { if(chunk) chunks.push(Buffer.from(chunk)); return true; },
    end: (chunk) => { if(chunk) chunks.push(Buffer.from(chunk)); ended = true; },
    getHeaders: () => Object.fromEntries(headers),
    getBody: () => Buffer.concat(chunks),
    isEnded: () => ended
  };
};

export const withTempDir = async (fn) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'kempo-tests-'));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, {recursive: true, force: true});
  }
};

export const write = async (root, rel, content = '') => {
  const full = path.join(root, rel);
  await mkdir(path.dirname(full), {recursive: true});
  await writeFile(full, content);
  return full;
};

export const wait = ms => new Promise(r => setTimeout(r, ms));

export const log = (..._args) => {};

export const bigString = (size = 5000) => 'x'.repeat(size);

export const randomPort = () => 1024 + Math.floor(Math.random() * 50000);

export const httpGet = (url) => new Promise((resolve, reject) => {
  import('http').then(({get}) => {
    get(url, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({res, body: Buffer.concat(chunks)}));
    }).on('error', reject);
  }).catch(reject);
});

export const startNode = async (args, options = {}) => {
  const {spawn} = await import('child_process');
  const child = spawn(process.execPath, args, {stdio: ['ignore', 'pipe', 'pipe'], ...options});
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  return child;
};

export const setEnv = (pairs, fn) => {
  const prev = {};
  Object.keys(pairs).forEach(k => { prev[k] = process.env[k]; process.env[k] = pairs[k]; });
  const restore = () => { Object.keys(pairs).forEach(k => { if(prev[k] === undefined){ delete process.env[k]; } else { process.env[k] = prev[k]; } }); };
  return fn().finally(restore);
};

export const toString = (buf) => Buffer.isBuffer(buf) ? buf.toString() : String(buf);

export const gzipSize = async (buf) => {
  const {gzip} = await import('zlib');
  return new Promise((res, rej) => gzip(buf, (e, out) => e ? rej(e) : res(out.length)));
};

export const parseCookies = (setCookie) => Array.isArray(setCookie) ? setCookie : (setCookie ? [setCookie] : []);
