import path from 'path';
import url from 'url';
import {createMockReq, createMockRes, setEnv} from './test-utils.js';

// import the middleware module by file path to avoid executing index.js
const examplePath = path.join(process.cwd(), 'example-middleware.js');
const {default: authMiddleware} = await import(url.pathToFileURL(examplePath));

export default {
  'blocks when API key missing and allows when present': async ({pass, fail}) => {
    try {
      await setEnv({API_KEY: 'abc'}, async () => {
        const res1 = createMockRes();
        await authMiddleware(createMockReq({url:'/private'}), res1, async ()=>{});
        if(res1.statusCode !== 401) return fail('should 401 without key');

        const res2 = createMockRes();
        const req2 = createMockReq({headers: {'x-api-key': 'abc'}, url:'/private'});
        let called = false;
        await authMiddleware(req2, res2, async ()=>{ called = true; });
        if(!called) return fail('should call next');
        if(!(req2.user && req2.user.authenticated)) return fail('user attached');

        const res3 = createMockRes();
        await authMiddleware(createMockReq({url:'/public/file'}), res3, async ()=>{});
        if(res3.isEnded() === true) return fail('public should not end');
      });
      pass('auth middleware');
    } catch(e){ fail(e.message); }
  }
};
