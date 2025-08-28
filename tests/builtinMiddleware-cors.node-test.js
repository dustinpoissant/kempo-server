import {corsMiddleware} from '../src/builtinMiddleware.js';
import {createMockReq, createMockRes} from './test-utils.js';

export default {
  'cors origin array and non-OPTIONS continues to next': async ({pass, fail}) => {
    try {
      const res = createMockRes();
      const mw = corsMiddleware({origin: ['http://a','http://b'], methods: ['GET'], headers: ['X']});
      const req = createMockReq({method: 'GET', headers: {origin: 'http://b'}});
      let called = false;
      await mw(req, res, async () => { called = true; });
      if(!called) return fail('next not called');
      if(res.getHeader('Access-Control-Allow-Origin') !== 'http://b') return fail('allowed origin');
      pass('cors array');
    } catch(e){ fail(e.message); }
  }
};
