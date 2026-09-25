import {createMockRes} from './utils/mock-res.js';
import {parseCookies} from './utils/cookie.js';
import createResponseWrapper from '../src/responseWrapper.js';

export default {
  'status and set/get headers and type': async ({pass, fail}) => {
    const res = createMockRes();
    const w = createResponseWrapper(res);
    w.status(201).set('X-Test', '1').type('json');
    
    if(res.statusCode !== 201) throw new Error('status');
    if(res.getHeader('X-Test') !== '1') throw new Error('set/get');
    if(res.getHeader('Content-Type') !== 'application/json') throw new Error('type');
    
    pass('status+headers+type');
  },
  'json sends and prevents further changes': async ({pass, fail}) => {
    const res = createMockRes();
    const w = createResponseWrapper(res);
    w.json({a: 1});
    
    if(!res.isEnded()) throw new Error('ended');
    
    try { w.set('X', 'y'); fail('should not set after send'); } catch(_){ /* ok */ }
    
    pass('json');
  },
  'send handles string, object, buffer and null': async ({pass, fail}) => {
    const res1 = createMockRes();
    createResponseWrapper(res1).send('hello');
    // Content-Type defaults to text/html for string when not set
    if(res1.getHeader('Content-Type') !== 'text/html; charset=utf-8') throw new Error('string content-type');
    if(res1.getBody().toString() !== 'hello') throw new Error('string body');

    const res2 = createMockRes();
    createResponseWrapper(res2).send({a:1});
    if(res2.getHeader('Content-Type') !== 'application/json') throw new Error('object content-type');

    const res3 = createMockRes();
    const buf = Buffer.from('abc');
    createResponseWrapper(res3).send(buf);
    const body3 = res3.getBody().toString();
    if(!body3.includes('"data"')) throw new Error('buffer equal');

    const res4 = createMockRes();
    createResponseWrapper(res4).send(null);
    if(!res4.isEnded()) throw new Error('null ended');
    
    pass('send variants');
  },
  'html and text helpers': async ({pass, fail}) => {
    const r1 = createMockRes();
    createResponseWrapper(r1).html('<h1>Ok</h1>');
    if(r1.getHeader('Content-Type') !== 'text/html; charset=utf-8') throw new Error('html type');

    const r2 = createMockRes();
    createResponseWrapper(r2).text('plain');
    if(r2.getHeader('Content-Type') !== 'text/plain; charset=utf-8') throw new Error('text type');
    
    pass('helpers');
  },
  'redirect and cookies': async ({pass, fail}) => {
    const r = createMockRes();
    const w = createResponseWrapper(r);
    w.cookie('a', 'b', {httpOnly: true, path: '/'});
    const cookies = parseCookies(r.getHeader('Set-Cookie'));
    
    if(!(cookies.length === 1 && cookies[0].includes('a=b'))) throw new Error('cookie added');
    
    w.redirect('/next', 301);
    if(!(r.statusCode === 301 && r.getHeader('Location') === '/next')) throw new Error('redirect');
    
    pass('redirect+cookie');
  }
};
