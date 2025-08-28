import {createMockReq} from './test-utils.js';
import createRequestWrapper from '../src/requestWrapper.js';

export default {
  'parses query and path and provides params': async ({pass, fail}) => {
    try {
      const req = createMockReq({url: '/user/123?x=1&y=2', headers: {host: 'localhost'}});
      const wrapped = createRequestWrapper(req, {id: '123'});
      if(wrapped.path !== '/user/123') return fail('path');
      if(!(wrapped.query.x === '1' && wrapped.query.y === '2')) return fail('query');
      if(wrapped.params.id !== '123') return fail('params');
      pass('parsed url');
    } catch(e){ fail(e.message); }
  },
  'body/json/text/buffer helpers work': async ({pass, fail}) => {
    try {
      const payload = {a: 1};
      // Each body reader must have its own stream instance
      const reqText = createMockReq({method: 'POST', url: '/', headers: {host: 'x', 'content-type': 'application/json'}, body: JSON.stringify(payload)});
      const text = await createRequestWrapper(reqText).text();
      if(text !== JSON.stringify(payload)) return fail('text');

      const reqJson = createMockReq({method: 'POST', url: '/', headers: {host: 'x', 'content-type': 'application/json'}, body: JSON.stringify(payload)});
      const obj = await createRequestWrapper(reqJson).json();
      if(obj.a !== 1) return fail('json');

      const reqBuf = createMockReq({url: '/', headers: {host: 'x'}, body: 'abc'});
      const buf = await createRequestWrapper(reqBuf).buffer();
      if(!(Buffer.isBuffer(buf) && buf.toString() === 'abc')) return fail('buffer');
      pass('helpers');
    } catch(e){ fail(e.message); }
  },
  'invalid json throws': async ({pass, fail}) => {
    const req = createMockReq({url: '/', headers: {host: 'x'}, body: 'not json'});
    try {
      await createRequestWrapper(req).json();
      fail('should throw');
    } catch(e){
      pass('threw');
    }
  },
  'get and is helpers': async ({pass, fail}) => {
    try {
      const req = createMockReq({url: '/', headers: {'content-type': 'text/plain', host: 'x'}});
      const w = createRequestWrapper(req);
      if(w.get('content-type') !== 'text/plain') return fail('get');
      if(w.is('text/plain') !== true) return fail('is');
      pass('header helpers');
    } catch(e){ fail(e.message); }
  }
};
