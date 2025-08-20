import {corsMiddleware} from '../builtinMiddleware.js';
import {createMockReq, createMockRes, expect} from './test-utils.js';

export default {
  'cors origin array and non-OPTIONS continues to next': async ({pass, fail}) => {
    try {
      const res = createMockRes();
      const mw = corsMiddleware({origin: ['http://a','http://b'], methods: ['GET'], headers: ['X']});
      const req = createMockReq({method: 'GET', headers: {origin: 'http://b'}});
      let called = false;
      await mw(req, res, async () => { called = true; });
      expect(called, 'next not called');
      expect(res.getHeader('Access-Control-Allow-Origin') === 'http://b', 'allowed origin');
      pass('cors array');
    } catch(e){ fail(e.message); }
  }
};
