import { URL } from 'url';

/*
  Request bodies are accumulated as Buffers, never as strings.

  `chunk.toString()` decodes as UTF-8, which destroys binary payloads two separate ways: bytes that
  are not valid UTF-8 are replaced with U+FFFD, and a multi-byte character split across two chunks
  is decoded independently on each side of the split. Both are lossy — re-encoding the resulting
  string does not recover the original bytes — so uploaded images, video and multipart bodies
  arrived corrupted. Decoding is deferred to the point where text is actually wanted.
*/

/*
  500MB. Also the default for `maxBodySize`, so a direct caller of readRawBody is held to the same
  ceiling the router applies. Bodies are buffered in memory in full before a route runs, so this is
  the per-request memory ceiling — see the caution in CONFIG.md.
*/
export const DEFAULT_MAX_BODY_SIZE = 524288000;

export const readRawBody = (req, maxBodySize = DEFAULT_MAX_BODY_SIZE) => {
  if(req._bufferedBody !== undefined) return Promise.resolve(req._bufferedBody);
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', chunk => {
      /*
        Bounded here as well as in the router. This path only runs for a request the router did not
        already buffer, and previously had no limit at all — an unbounded read in a function two
        other call sites depend on.
      */
      size += chunk.length;
      if(size > maxBodySize){
        req.destroy();
        reject(new Error('Payload Too Large'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => { resolve(Buffer.concat(chunks)); });
    req.on('error', reject);
  });
};

/*
  Accepts a Buffer (every caller inside this package) or a string (direct callers), and always
  decodes explicitly rather than leaning on implicit coercion — `new URLSearchParams(buffer)` does
  not stringify a Buffer, it iterates it as bytes and throws.
*/
export const parseBody = (rawBody, contentType) => {
  // An empty Buffer is truthy, so "no body" needs a length check rather than a falsy check
  if(!rawBody || rawBody.length === 0) return null;
  const ct = (contentType || '').toLowerCase();
  if(ct.includes('application/json')) {
    try {
      return JSON.parse(rawBody.toString('utf8'));
    } catch {
      return null;
    }
  }
  if(ct.includes('application/x-www-form-urlencoded')) {
    return Object.fromEntries(new URLSearchParams(rawBody.toString('utf8')));
  }
  /*
    Every other content type is handed back as text, which is the documented contract. A binary
    body — multipart uploads above all — must be read with request.buffer() instead: decoding it
    to a string here is exactly the corruption described at the top of this file.
  */
  return rawBody.toString('utf8');
};

/**
 * Creates an enhanced request object with Express-like functionality
 * @param {IncomingMessage} request - The original Node.js request object
 * @param {Object} params - Route parameters from dynamic routes
 * @returns {Object} Enhanced request object
 */
export function createRequestWrapper(request, params = {}) {
  // Parse URL to extract query parameters
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  const query = Object.fromEntries(url.searchParams);
  
  const parseCookies = () => {
    const cookieHeader = request.headers.cookie || request.headers.Cookie;
    if(!cookieHeader) return {};
    
    return cookieHeader.split(';').reduce((cookies, cookie) => {
      const [name, ...rest] = cookie.trim().split('=');
      if(name) cookies[name] = rest.join('=');
      return cookies;
    }, {});
  };
  
  // Create the enhanced request object
  const enhancedRequest = {
    // Original request properties and methods
    ...request,
    _originalRequest: request,
    method: request.method,
    url: request.url,
    headers: request.headers,
    
    // Enhanced properties
    params,
    query,
    path: url.pathname,
    cookies: parseCookies(),
    
    // Body — set to null initially; populated by router/serveFile before handler
    body: null,
    _rawBody: '',

    async json() {
      return JSON.parse(this._rawBody.toString('utf8'));
    },

    async text() {
      return this._rawBody.toString('utf8');
    },

    /*
      The only accessor that preserves the bytes exactly as they arrived, and so the one a route
      handling an upload must use — `body` and `text()` decode as UTF-8, which mangles binary.
    */
    async buffer() {
      return Buffer.from(this._rawBody);
    },
    
    // Utility methods
    get(headerName) {
      return request.headers[headerName.toLowerCase()];
    },
    
    is(type) {
      const contentType = this.get('content-type') || '';
      return contentType.includes(type);
    }
  };
  
  return enhancedRequest;
}

export default createRequestWrapper;
