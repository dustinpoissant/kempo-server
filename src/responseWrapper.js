/**
 * Creates an enhanced response object with Express-like functionality
 * @param {ServerResponse} response - The original Node.js response object
 * @returns {Object} Enhanced response object
 */
export function createResponseWrapper(response) {
  // Track if response has been sent
  let sent = false;
  
  // Create the enhanced response object
  const enhancedResponse = {
    // Original response properties and methods
    ...response,
    _originalResponse: response,
    
    // Explicitly expose core response methods for middleware compatibility
    setHeader: response.setHeader.bind(response),
    getHeader: response.getHeader.bind(response),
    writeHead: response.writeHead.bind(response),
    write: response.write.bind(response),
    end: response.end.bind(response),
    
    // Status code management
    status(code) {
      if (sent) {
        throw new Error('Cannot set status after response has been sent');
      }
      response.statusCode = code;
      return enhancedResponse; // Allow chaining
    },
    
    // Header management
    set(field, value) {
      if (sent) {
        throw new Error('Cannot set headers after response has been sent');
      }
      if (typeof field === 'object') {
        // Set multiple headers: res.set({ 'Content-Type': 'text/html', 'X-Custom': 'value' })
        Object.entries(field).forEach(([key, val]) => {
          response.setHeader(key, val);
        });
      } else {
        // Set single header: res.set('Content-Type', 'text/html')
        response.setHeader(field, value);
      }
      return enhancedResponse; // Allow chaining
    },
    
    get(field) {
      return response.getHeader(field);
    },
    
    // Content type helpers
    type(contentType) {
      if (sent) {
        throw new Error('Cannot set content type after response has been sent');
      }
      
      // Handle common shortcuts
      const typeMap = {
        'html': 'text/html',
        'json': 'application/json',
        'xml': 'application/xml',
        'text': 'text/plain',
        'css': 'text/css',
        'js': 'application/javascript'
      };
      
      const mimeType = typeMap[contentType] || contentType;
      response.setHeader('Content-Type', mimeType);
      return enhancedResponse; // Allow chaining
    },
    
    // JSON response
    json(obj) {
      if (sent) {
        throw new Error('Cannot send response after it has already been sent');
      }
      
      sent = true;
      response.setHeader('Content-Type', 'application/json');
      
      try {
        const jsonString = JSON.stringify(obj);
        response.end(jsonString);
      } catch (error) {
        throw new Error('Failed to stringify object to JSON');
      }
      
      return enhancedResponse;
    },
    
    // Text response
    send(data) {
      if (sent) {
        throw new Error('Cannot send response after it has already been sent');
      }
      
      sent = true;
      
      if (data === null || data === undefined) {
        response.end();
        return enhancedResponse;
      }
      
      // Handle different data types
      if (typeof data === 'object') {
        // If it's an object, send as JSON
        response.setHeader('Content-Type', 'application/json');
        response.end(JSON.stringify(data));
      } else if (typeof data === 'string') {
        // If Content-Type not set, default to text/html for strings
        if (!response.getHeader('Content-Type')) {
          response.setHeader('Content-Type', 'text/html; charset=utf-8');
        } else {
          // If Content-Type is set and is a text type, add charset if not present
          const contentType = response.getHeader('Content-Type');
          if (contentType && contentType.startsWith('text/') && !contentType.includes('charset=')) {
            response.setHeader('Content-Type', `${contentType}; charset=utf-8`);
          }
        }
        response.end(data);
      } else if (Buffer.isBuffer(data)) {
        // Handle buffers
        response.end(data);
      } else {
        // Convert to string
        if (!response.getHeader('Content-Type')) {
          response.setHeader('Content-Type', 'text/plain; charset=utf-8');
        } else {
          // If Content-Type is set and is a text type, add charset if not present
          const contentType = response.getHeader('Content-Type');
          if (contentType && contentType.startsWith('text/') && !contentType.includes('charset=')) {
            response.setHeader('Content-Type', `${contentType}; charset=utf-8`);
          }
        }
        response.end(String(data));
      }
      
      return enhancedResponse;
    },
    
    // HTML response helper
    html(htmlString) {
      if (sent) {
        throw new Error('Cannot send response after it has already been sent');
      }
      
      sent = true;
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.end(htmlString);
      return enhancedResponse;
    },
    
    // Text response helper
    text(textString) {
      if (sent) {
        throw new Error('Cannot send response after it has already been sent');
      }
      
      sent = true;
      response.setHeader('Content-Type', 'text/plain; charset=utf-8');
      response.end(String(textString));
      return enhancedResponse;
    },
    
    // Redirect helper
    redirect(url, statusCode = 302) {
      if (sent) {
        throw new Error('Cannot redirect after response has been sent');
      }
      
      sent = true;
      response.statusCode = statusCode;
      response.setHeader('Location', url);
      response.end();
      return enhancedResponse;
    },
    
    // Cookie management (basic)
    cookie(name, value, options = {}) {
      if (sent) {
        throw new Error('Cannot set cookies after response has been sent');
      }
      
      let cookieString = `${name}=${encodeURIComponent(value)}`;
      
      if (options.maxAge) {
        cookieString += `; Max-Age=${options.maxAge}`;
      }
      if (options.domain) {
        cookieString += `; Domain=${options.domain}`;
      }
      if (options.path) {
        cookieString += `; Path=${options.path}`;
      }
      if (options.secure) {
        cookieString += '; Secure';
      }
      if (options.httpOnly) {
        cookieString += '; HttpOnly';
      }
      if (options.sameSite) {
        cookieString += `; SameSite=${options.sameSite}`;
      }
      
      const existingCookies = response.getHeader('Set-Cookie') || [];
      const cookies = Array.isArray(existingCookies) ? existingCookies : [existingCookies];
      cookies.push(cookieString);
      
      response.setHeader('Set-Cookie', cookies);
      return enhancedResponse;
    },
    
    // Clear cookie helper
    clearCookie(name, options = {}) {
      return this.cookie(name, '', { ...options, maxAge: 0 });
    }
  };
  
  return enhancedResponse;
}

export default createResponseWrapper;
