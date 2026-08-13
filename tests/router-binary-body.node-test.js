import http from 'http';
import {Readable} from 'stream';
import {withTempDir} from './utils/temp-dir.js';
import {write} from './utils/file-writer.js';
import {randomPort} from './utils/port.js';
import router from '../src/router.js';
import {readRawBody, parseBody} from '../src/requestWrapper.js';

/*
  Request bodies used to be accumulated with `body += chunk.toString()`, which decodes as UTF-8.
  That corrupted binary uploads two separate ways, both silent and both irreversible:

    - Bytes that are not valid UTF-8 were replaced with U+FFFD. A JPEG went in and something that
      merely resembled a JPEG came out.
    - A multi-byte character split across two stream chunks was decoded independently on each side
      of the split, so both halves became replacement characters.

  These assert the bytes survive, and that the text content types built on top of them still parse
  the way they always did.
*/

// httpRequest() in tests/utils hardcodes application/json, so uploads need their own client
const post = (port, path, body, headers = {}) => new Promise((resolve, reject) => {
  const payload = Buffer.isBuffer(body) ? body : Buffer.from(body);
  const req = http.request({
    hostname: '127.0.0.1',
    port,
    path,
    method: 'POST',
    headers: {'Content-Length': payload.length, ...headers}
  }, res => {
    const chunks = [];
    res.on('data', c => chunks.push(c));
    res.on('end', () => resolve({res, body: Buffer.concat(chunks)}));
  });
  req.on('error', reject);
  req.write(payload);
  req.end();
});

/*
  Echoes back what the handler actually received. The buffer is hex-encoded because the assertion
  is about exact bytes, and a JSON response cannot carry them intact any other way.
*/
const ECHO_ROUTE = `export default async (request, response) => {
  const buf = await request.buffer();
  response.status(200).json({
    hex: buf.toString('hex'),
    text: await request.text(),
    bodyType: request.body === null ? 'null' : typeof request.body,
    body: typeof request.body === 'object' ? request.body : String(request.body)
  });
};`;

const withServer = async (fn, config = {}) => withTempDir(async (dir) => {
  await write(dir, 'api/echo/POST.js', ECHO_ROUTE);
  await write(dir, 'site/index.html', '<html></html>');
  await write(dir, 'site/.config.json', JSON.stringify({
    customRoutes: {'/api/**': '../api/**'},
    ...config
  }));

  const prev = process.cwd();
  process.chdir(dir);
  const handler = await router({root: 'site', logging: 0}, () => {});
  const server = http.createServer(handler);
  const port = randomPort();
  await new Promise(r => server.listen(port, r));
  await new Promise(r => setTimeout(r, 50));
  try {
    return await fn(port);
  } finally {
    server.close();
    process.chdir(prev);
  }
});

// A stream that emits exactly the chunks given, so a split can be placed on a chosen byte
const streamOf = chunks => {
  const s = new Readable({read(){}});
  setImmediate(() => {
    for(const c of chunks) s.emit('data', c);
    s.emit('end');
  });
  return s;
};

export default {
  'a binary body survives the round trip byte for byte': async ({pass, fail, log}) => {
    try {
      /*
        A real PNG header followed by a JPEG marker and a lone 0xFF. None of it is valid UTF-8, so
        every one of these bytes was previously replaced with U+FFFD.
      */
      const original = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
        0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46,
        0xff, 0xfe, 0xfd, 0x80, 0x00, 0xc0, 0xc1, 0xf5
      ]);

      await withServer(async (port) => {
        const {res, body} = await post(port, '/api/echo', original, {'Content-Type': 'application/octet-stream'});
        if(res.statusCode !== 200) throw new Error(`expected 200, got ${res.statusCode}`);

        const received = Buffer.from(JSON.parse(body.toString()).hex, 'hex');
        log(`sent ${original.length} bytes, received ${received.length}`);
        if(!received.equals(original)){
          throw new Error(`bytes changed in transit\n      sent:     ${original.toString('hex')}\n      received: ${received.toString('hex')}`);
        }
      });
      pass('binary body preserved exactly');
    } catch(e) {
      fail(e.message);
    }
  },

  'a multi-byte character split across chunks is not mangled': async ({pass, fail}) => {
    try {
      // é is two bytes; the split falls between them, so each chunk alone is invalid UTF-8
      const full = Buffer.from('café');
      const head = full.subarray(0, 4);
      const tail = full.subarray(4);
      if(head.length + tail.length !== full.length) throw new Error('fixture is wrong');

      const raw = await readRawBody(streamOf([head, tail]));
      if(!Buffer.isBuffer(raw)) throw new Error(`readRawBody returned ${typeof raw}, expected a Buffer`);
      if(!raw.equals(full)) throw new Error(`got ${JSON.stringify(raw.toString())}, expected ${JSON.stringify(full.toString())}`);
      if(raw.toString('utf8') !== 'café') throw new Error(`decoded to ${JSON.stringify(raw.toString('utf8'))}`);

      pass('split character reassembled');
    } catch(e) {
      fail(e.message);
    }
  },

  'json and form bodies still parse': async ({pass, fail}) => {
    try {
      await withServer(async (port) => {
        const json = await post(port, '/api/echo', '{"a":1,"b":"x"}', {'Content-Type': 'application/json'});
        const jsonEcho = JSON.parse(json.body.toString());
        if(jsonEcho.bodyType !== 'object') throw new Error(`json body arrived as ${jsonEcho.bodyType}`);
        if(jsonEcho.body?.a !== 1 || jsonEcho.body?.b !== 'x') throw new Error(`json body wrong: ${JSON.stringify(jsonEcho.body)}`);

        /*
          Guards a trap found while making this change: a Buffer handed to URLSearchParams is not
          stringified, it is iterated as bytes and throws ERR_INVALID_TUPLE. Every HTML form post
          goes through this branch.
        */
        const form = await post(port, '/api/echo', 'a=1&b=two+words', {'Content-Type': 'application/x-www-form-urlencoded'});
        if(form.res.statusCode !== 200) throw new Error(`form post got ${form.res.statusCode}, not 200`);
        const formEcho = JSON.parse(form.body.toString());
        if(formEcho.body?.a !== '1' || formEcho.body?.b !== 'two words'){
          throw new Error(`urlencoded body wrong: ${JSON.stringify(formEcho.body)}`);
        }
      });
      pass('json and urlencoded unchanged');
    } catch(e) {
      fail(e.message);
    }
  },

  'an empty body is still null rather than an empty buffer': async ({pass, fail}) => {
    try {
      /*
        An empty Buffer is truthy where an empty string was not, so the "no body" check needs a
        length test. Without it every bodyless request would arrive with a body of `""`.
      */
      if(parseBody(Buffer.alloc(0), 'application/json') !== null) return fail('empty Buffer should parse to null');
      if(parseBody('', 'application/json') !== null) return fail('empty string should still parse to null');
      if(parseBody(null, 'application/json') !== null) return fail('null should still parse to null');

      await withServer(async (port) => {
        const {body} = await post(port, '/api/echo', Buffer.alloc(0), {'Content-Type': 'application/json'});
        const echo = JSON.parse(body.toString());
        if(echo.bodyType !== 'null') throw new Error(`empty body arrived as ${echo.bodyType}`);
        if(echo.hex !== '') throw new Error(`expected no bytes, got ${echo.hex}`);
      });
      pass('empty body is null');
    } catch(e) {
      fail(e.message);
    }
  },

  'readRawBody enforces a size limit': async ({pass, fail}) => {
    try {
      // Previously unbounded — a caller that missed the router's own check read without any ceiling
      const oversized = Buffer.alloc(2048, 0x41);
      try {
        await readRawBody(streamOf([oversized]), 1024);
        return fail('expected a Payload Too Large rejection');
      } catch(e) {
        if(!/Payload Too Large/.test(e.message)) throw new Error(`rejected with the wrong error: ${e.message}`);
      }

      const withinLimit = await readRawBody(streamOf([Buffer.alloc(512, 0x41)]), 1024);
      if(withinLimit.length !== 512) throw new Error(`expected 512 bytes through, got ${withinLimit.length}`);

      pass('limit enforced');
    } catch(e) {
      fail(e.message);
    }
  },

  'a body over maxBodySize is rejected with 413': async ({pass, fail}) => {
    try {
      await withServer(async (port) => {
        const {res} = await post(port, '/api/echo', Buffer.alloc(4096, 0x41), {'Content-Type': 'application/octet-stream'});
        if(res.statusCode !== 413) throw new Error(`expected 413, got ${res.statusCode}`);
      }, {maxBodySize: 1024});
      pass('413 on oversized body');
    } catch(e) {
      fail(e.message);
    }
  }
};
