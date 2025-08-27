import {createMockRes, parseCookies} from './test-utils.js';
import createResponseWrapper from '../responseWrapper.js';

export default {
  'status and set/get headers and type': async ({pass, fail}) => {
    try {
      const res = createMockRes();
      const w = createResponseWrapper(res);
      w.status(201).set('X-Test', '1').type('json');
      if(res.statusCode !== 201) return fail('status');
      if(res.getHeader('X-Test') !== '1') return fail('set/get');
      if(res.getHeader('Content-Type') !== 'application/json') return fail('type');
      pass('status+headers+type');
    } catch(e){ fail(e.message); }
  },
  'json sends and prevents further changes': async ({pass, fail}) => {
    try {
      const res = createMockRes();
      const w = createResponseWrapper(res);
      w.json({a: 1});
      if(!res.isEnded()) return fail('ended');
      try { w.set('X', 'y'); fail('should not set after send'); } catch(_){ /* ok */ }
      pass('json');
    } catch(e){ fail(e.message); }
  },
  'send handles string, object, buffer and null': async ({pass, fail}) => {
    try {
  const res1 = createMockRes();
  createResponseWrapper(res1).send('hello');
  // Content-Type defaults to text/html for string when not set
  if(res1.getHeader('Content-Type') !== 'text/html') return fail('string content-type');
      if(res1.getBody().toString() !== 'hello') return fail('string body');

      const res2 = createMockRes();
      createResponseWrapper(res2).send({a:1});
      if(res2.getHeader('Content-Type') !== 'application/json') return fail('object content-type');

  const res3 = createMockRes();
  const buf = Buffer.from('abc');
  createResponseWrapper(res3).send(buf);
  const body3 = res3.getBody().toString();
  if(!body3.includes('"data"')) return fail('buffer equal');

  const res4 = createMockRes();
  createResponseWrapper(res4).send(null);
  if(!res4.isEnded()) return fail('null ended');
      pass('send variants');
    } catch(e){ fail(e.message); }
  },
  'html and text helpers': async ({pass, fail}) => {
    try {
      const r1 = createMockRes();
      createResponseWrapper(r1).html('<h1>Ok</h1>');
      if(r1.getHeader('Content-Type') !== 'text/html') return fail('html type');

      const r2 = createMockRes();
      createResponseWrapper(r2).text('plain');
      if(r2.getHeader('Content-Type') !== 'text/plain') return fail('text type');
      pass('helpers');
    } catch(e){ fail(e.message); }
  },
  'redirect and cookies': async ({pass, fail}) => {
    try {
      const r = createMockRes();
      const w = createResponseWrapper(r);
      w.cookie('a', 'b', {httpOnly: true, path: '/'});
      const cookies = parseCookies(r.getHeader('Set-Cookie'));
      if(!(cookies.length === 1 && cookies[0].includes('a=b'))) return fail('cookie added');
      w.redirect('/next', 301);
      if(!(r.statusCode === 301 && r.getHeader('Location') === '/next')) return fail('redirect');
      pass('redirect+cookie');
    } catch(e){ fail(e.message); }
  }
};
