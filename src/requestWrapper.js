import { URL } from 'url';

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
    
    // Body parsing methods
    async body() {
      return new Promise((resolve, reject) => {
        let body = '';
        
        request.on('data', chunk => {
          body += chunk.toString();
        });
        
        request.on('end', () => {
          resolve(body);
        });
        
        request.on('error', reject);
      });
    },
    
    async json() {
      try {
        const body = await this.body();
        return JSON.parse(body);
      } catch (error) {
        throw new Error('Invalid JSON in request body');
      }
    },
    
    async text() {
      return this.body();
    },
    
    async buffer() {
      return new Promise((resolve, reject) => {
        const chunks = [];
        
        request.on('data', chunk => {
          chunks.push(chunk);
        });
        
        request.on('end', () => {
          resolve(Buffer.concat(chunks));
        });
        
        request.on('error', reject);
      });
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
