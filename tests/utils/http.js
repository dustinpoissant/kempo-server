export const httpGet = (url) => new Promise((resolve, reject) => {
  import('http').then(({get}) => {
    get(url, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({res, body: Buffer.concat(chunks)}));
    }).on('error', reject);
  }).catch(reject);
});

export const httpRequest = (url, method, body) => new Promise((resolve, reject) => {
  import('http').then(({request}) => {
    const parsed = new URL(url);
    const opts = {
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method
    };
    if(body) opts.headers = { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) };
    const req = request(opts, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({res, body: Buffer.concat(chunks)}));
    });
    req.on('error', reject);
    if(body) req.write(body);
    req.end();
  }).catch(reject);
});