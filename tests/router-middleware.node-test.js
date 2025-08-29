import http from 'http';
import {withTempDir, write, randomPort} from './test-utils.js';
import router from '../src/router.js';

export default {
  'built-in middleware can be configured on router': async ({pass, fail}) => {
    await withTempDir(async (dir) => {
      await write(dir, '.config.json', JSON.stringify({
        middleware: {
          cors: {enabled: true, origin: '*', methods: ['GET'], headers: ['X']},
          compression: {enabled: true, threshold: 1},
          rateLimit: {enabled: true, maxRequests: 1, windowMs: 1000, message: 'Too many'},
          security: {enabled: true, headers: {'X-Test':'1'}},
          logging: {enabled: true, includeUserAgent: false, includeResponseTime: true}
        }
      }));
      await write(dir, 'index.html', 'hello world');
      const prev = process.cwd();
      process.chdir(dir);
      const flags = {root: '.', logging: 0, scan: false};
      const handler = await router(flags, () => {});
      const server = http.createServer(handler);
      const port = randomPort();
      await new Promise(r => server.listen(port, r));
      await new Promise(r => setTimeout(r, 50));
      
      const {get} = await import('http');
      const one = await new Promise((res)=>{
        get(`http://localhost:${port}/index.html`, {headers: {'accept-encoding': 'gzip'}}, r =>{
          const chunks = []; r.on('data', c => chunks.push(c)); r.on('end', ()=> res({r, body: Buffer.concat(chunks)}));
        });
      });
      
      if(one.r.statusCode !== 200) {
        server.close();
        process.chdir(prev);
        return fail('first ok');
      }
      
      const two = await new Promise((res)=>{
        get(`http://localhost:${port}/index.html`, r =>{
          const chunks = []; r.on('data', c => chunks.push(c)); r.on('end', ()=> res({r, body: Buffer.concat(chunks)}));
        });
      });
      
      if(two.r.statusCode !== 429) {
        server.close();
        process.chdir(prev);
        return fail('rate limited');
      }
      
      server.close();
      process.chdir(prev);
    });
    
    pass('router middleware');
  }
};
