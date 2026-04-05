import {createMockReq} from './utils/mock-req.js';
import createRequestWrapper, {readRawBody, parseBody} from '../src/requestWrapper.js';

export default {
  'parses query and path and provides params': async ({pass, fail}) => {
    const req = createMockReq({url: '/user/123?x=1&y=2', headers: {host: 'localhost'}});
    const wrapped = createRequestWrapper(req, {id: '123'});
    
    if(wrapped.path !== '/user/123') return fail('path');
    if(!(wrapped.query.x === '1' && wrapped.query.y === '2')) return fail('query');
    if(wrapped.params.id !== '123') return fail('params');
    
    pass('parsed url');
  },
  'body/json/text/buffer helpers work with _rawBody': async ({pass, fail}) => {
    const payload = {a: 1};
    const raw = JSON.stringify(payload);

    const reqText = createMockReq({method: 'POST', url: '/', headers: {host: 'x', 'content-type': 'application/json'}, body: raw});
    const wText = createRequestWrapper(reqText);
    wText._rawBody = await readRawBody(reqText);
    if((await wText.text()) !== raw) return fail('text');

    const reqJson = createMockReq({method: 'POST', url: '/', headers: {host: 'x', 'content-type': 'application/json'}, body: raw});
    const wJson = createRequestWrapper(reqJson);
    wJson._rawBody = await readRawBody(reqJson);
    const obj = await wJson.json();
    if(obj.a !== 1) return fail('json');

    const reqBuf = createMockReq({url: '/', headers: {host: 'x'}, body: 'abc'});
    const wBuf = createRequestWrapper(reqBuf);
    wBuf._rawBody = await readRawBody(reqBuf);
    const buf = await wBuf.buffer();
    if(!(Buffer.isBuffer(buf) && buf.toString() === 'abc')) return fail('buffer');

    pass('helpers');
  },
  'invalid json throws': async ({pass, fail}) => {
    const req = createMockReq({url: '/', headers: {host: 'x'}, body: 'not json'});
    const w = createRequestWrapper(req);
    w._rawBody = await readRawBody(req);
    try {
      await w.json();
      fail('should throw');
    } catch(e){
      pass('threw');
    }
  },
  'get and is helpers': async ({pass, fail}) => {
    const req = createMockReq({url: '/', headers: {'content-type': 'text/plain', host: 'x'}});
    const w = createRequestWrapper(req);
    
    if(w.get('content-type') !== 'text/plain') return fail('get');
    if(w.is('text/plain') !== true) return fail('is');
    
    pass('header helpers');
  },
  'body property is null by default': async ({pass, fail}) => {
    const req = createMockReq({url: '/', headers: {host: 'x'}});
    const w = createRequestWrapper(req);
    if(w.body !== null) return fail('expected null');
    pass('body null');
  },
  'parseBody returns parsed JSON for application/json': async ({pass, fail}) => {
    const result = parseBody('{"a":1}', 'application/json');
    if(result?.a !== 1) return fail('json parse');
    pass('json');
  },
  'parseBody returns null for invalid JSON': async ({pass, fail}) => {
    const result = parseBody('not json', 'application/json');
    if(result !== null) return fail('expected null');
    pass('invalid json');
  },
  'parseBody returns object for urlencoded': async ({pass, fail}) => {
    const result = parseBody('a=1&b=2', 'application/x-www-form-urlencoded');
    if(result?.a !== '1' || result?.b !== '2') return fail('urlencoded');
    pass('urlencoded');
  },
  'parseBody returns raw string for unknown content-type': async ({pass, fail}) => {
    const result = parseBody('hello', 'text/plain');
    if(result !== 'hello') return fail('expected raw string');
    pass('raw string');
  },
  'parseBody returns null for empty body': async ({pass, fail}) => {
    const result = parseBody('', 'application/json');
    if(result !== null) return fail('expected null');
    pass('empty body');
  },
  'readRawBody uses _bufferedBody when present': async ({pass, fail}) => {
    const req = createMockReq({url: '/', headers: {host: 'x'}, body: 'stream data'});
    req._bufferedBody = 'cached data';
    const result = await readRawBody(req);
    if(result !== 'cached data') return fail('expected cached data');
    pass('buffered');
  }
};
