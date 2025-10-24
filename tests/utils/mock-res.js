export const createMockRes = () => {
  const headers = new Map();
  let ended = false;
  let statusCode = 200;
  const chunks = [];
  return {
    get statusCode(){return statusCode;},
    set statusCode(v){statusCode = v;},
    setHeader: (k, v) => headers.set(k, v),
    getHeader: (k) => headers.get(k),
    writeHead: (code, hdrs = {}) => {
      statusCode = code;
      Object.entries(hdrs).forEach(([k, v]) => headers.set(k, v));
    },
    write: (chunk) => { if(chunk) chunks.push(Buffer.from(chunk)); return true; },
    end: (chunk) => { if(chunk) chunks.push(Buffer.from(chunk)); ended = true; },
    getHeaders: () => Object.fromEntries(headers),
    getBody: () => Buffer.concat(chunks),
    isEnded: () => ended
  };
};