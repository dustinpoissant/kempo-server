import MiddlewareRunner from '../middlewareRunner.js';
import {createMockReq, createMockRes} from './test-utils.js';

export default {
  'runs middleware in order and calls finalHandler': async ({pass, fail}) => {
    try {
      const mr = new MiddlewareRunner();
      const calls = [];
      mr.use(async (_req, _res, next) => { calls.push('a'); await next(); calls.push('a:after'); });
      mr.use(async (_req, _res, next) => { calls.push('b'); await next(); calls.push('b:after'); });
      const req = createMockReq();
      const res = createMockRes();
      await mr.run(req, res, async () => { calls.push('final'); });
      if(calls.join(',') !== 'a,b,final,b:after,a:after') return fail('order incorrect');
      pass('middleware order');
    } catch(e){ fail(e.message); }
  }
};
