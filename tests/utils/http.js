export const httpGet = (url) => new Promise((resolve, reject) => {
  import('http').then(({get}) => {
    get(url, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({res, body: Buffer.concat(chunks)}));
    }).on('error', reject);
  }).catch(reject);
});