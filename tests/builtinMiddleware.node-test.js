import http from 'http';
import {createMockReq, createMockRes, bigString, gzipSize, setEnv} from './test-utils.js';
import {corsMiddleware, compressionMiddleware, rateLimitMiddleware, securityMiddleware, loggingMiddleware} from '../src/builtinMiddleware.js';

export default {
  'cors middleware sets headers and handles OPTIONS': async ({pass, fail}) => {
    const res = createMockRes();
    const mw = corsMiddleware({origin: '*', methods: ['GET'], headers: ['X']});
    const req = createMockReq({method: 'OPTIONS', headers: {origin: 'http://x'}});
    await mw(req, res, async () => {});
    
    if(!res.isEnded()) return fail('preflight should end');
    if(!(res.getHeader('Access-Control-Allow-Origin') === 'http://x' || res.getHeader('Access-Control-Allow-Origin') === '*')) return fail('origin header');
    
    pass('cors');
  },
  'compression middleware gzips when threshold met and client accepts': async ({pass, fail}) => {
    const res = createMockRes();
    const mw = compressionMiddleware({threshold: 1024});
    const req = createMockReq({headers: {'accept-encoding': 'gzip'}});
    // simulate next writing large body
    await mw(req, res, async () => {
      res.write(bigString(5000));
      res.end();
    });
    await new Promise(r => setTimeout(r, 10));
    const body = res.getBody();
    const original = Buffer.from(bigString(5000));
    const gzLen = await gzipSize(original);
    // If gzipped is smaller, we expect gzip header. Otherwise, implementation may send uncompressed.
    if(gzLen < original.length){
      if(res.getHeader('Content-Encoding') !== 'gzip') return fail('should gzip when beneficial');
    }
    if(body.length <= 0) return fail('has body');
    
    pass('compression');
  },
  'rate limit returns 429 after maxRequests': async ({pass, fail}) => {
    const cfg = {maxRequests: 2, windowMs: 1000, message: 'Too many'};
    const mw = rateLimitMiddleware(cfg);
    const req = createMockReq();
    const res1 = createMockRes();
    await mw(req, res1, async () => {});
    const res2 = createMockRes();
    await mw(req, res2, async () => {});
    const res3 = createMockRes();
    await mw(req, res3, async () => {});
    
    if(res3.statusCode !== 429) return fail('should rate limit');
    
    pass('rateLimit');
  },
  'security middleware sets headers': async ({pass, fail}) => {
    const res = createMockRes();
    const mw = securityMiddleware({headers: {'X-Test': '1'}});
    await mw(createMockReq(), res, async () => {});
    
    if(res.getHeader('X-Test') !== '1') return fail('header set');
    
    pass('security');
  },
  'logging middleware logs after response end': async ({pass, fail}) => {
    const logs = [];
    const logger = (m) => logs.push(String(m));
    const mw = loggingMiddleware({includeUserAgent: true, includeResponseTime: true}, logger);
    const res = createMockRes();
    await mw(createMockReq({headers: {'user-agent': 'UA'}}), res, async () => { res.end('x'); });
    
    if(!(logs.length === 1 && logs[0].includes('GET /') && logs[0].includes('UA'))) return fail('logged');
    
    pass('logging');
  }
};
