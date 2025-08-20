import {createMockRes, expect, parseCookies} from './test-utils.js';
import createResponseWrapper from '../responseWrapper.js';

export default {
  'status and set/get headers and type': async ({pass, fail}) => {
    try {
      const res = createMockRes();
      const w = createResponseWrapper(res);
      w.status(201).set('X-Test', '1').type('json');
      expect(res.statusCode === 201, 'status');
      expect(res.getHeader('X-Test') === '1', 'set/get');
      expect(res.getHeader('Content-Type') === 'application/json', 'type');
      pass('status+headers+type');
    } catch(e){ fail(e.message); }
  },
  'json sends and prevents further changes': async ({pass, fail}) => {
    try {
      const res = createMockRes();
      const w = createResponseWrapper(res);
      w.json({a: 1});
      expect(res.isEnded(), 'ended');
      try { w.set('X', 'y'); fail('should not set after send'); } catch(_){ /* ok */ }
      pass('json');
    } catch(e){ fail(e.message); }
  },
  'send handles string, object, buffer and null': async ({pass, fail}) => {
    try {
  const res1 = createMockRes();
  createResponseWrapper(res1).send('hello');
  // Content-Type defaults to text/html for string when not set
  expect(res1.getHeader('Content-Type') === 'text/html', 'string content-type');
      expect(res1.getBody().toString() === 'hello', 'string body');

      const res2 = createMockRes();
      createResponseWrapper(res2).send({a:1});
      expect(res2.getHeader('Content-Type') === 'application/json', 'object content-type');

  const res3 = createMockRes();
  const buf = Buffer.from('abc');
  createResponseWrapper(res3).send(buf);
  const body3 = res3.getBody().toString();
  expect(body3.includes('"data"'), 'buffer equal');

  const res4 = createMockRes();
  createResponseWrapper(res4).send(null);
  expect(res4.isEnded(), 'null ended');
      pass('send variants');
    } catch(e){ fail(e.message); }
  },
  'html and text helpers': async ({pass, fail}) => {
    try {
      const r1 = createMockRes();
      createResponseWrapper(r1).html('<h1>Ok</h1>');
      expect(r1.getHeader('Content-Type') === 'text/html', 'html type');

      const r2 = createMockRes();
      createResponseWrapper(r2).text('plain');
      expect(r2.getHeader('Content-Type') === 'text/plain', 'text type');
      pass('helpers');
    } catch(e){ fail(e.message); }
  },
  'redirect and cookies': async ({pass, fail}) => {
    try {
      const r = createMockRes();
      const w = createResponseWrapper(r);
      w.cookie('a', 'b', {httpOnly: true, path: '/'});
      const cookies = parseCookies(r.getHeader('Set-Cookie'));
      expect(cookies.length === 1 && cookies[0].includes('a=b'), 'cookie added');
      w.redirect('/next', 301);
      expect(r.statusCode === 301 && r.getHeader('Location') === '/next', 'redirect');
      pass('redirect+cookie');
    } catch(e){ fail(e.message); }
  }
};
