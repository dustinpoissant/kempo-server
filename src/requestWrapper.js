import { URL } from 'url';

export const readRawBody = req => {
  if(req._bufferedBody !== undefined) return Promise.resolve(req._bufferedBody);
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => { resolve(body); });
    req.on('error', reject);
  });
};

export const parseBody = (rawBody, contentType) => {
  if(!rawBody) return null;
  const ct = (contentType || '').toLowerCase();
  if(ct.includes('application/json')) {
    try {
      return JSON.parse(rawBody);
    } catch {
      return null;
    }
  }
  if(ct.includes('application/x-www-form-urlencoded')) {
    return Object.fromEntries(new URLSearchParams(rawBody));
  }
  return rawBody;
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
      return JSON.parse(this._rawBody);
    },

    async text() {
      return this._rawBody;
    },

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
