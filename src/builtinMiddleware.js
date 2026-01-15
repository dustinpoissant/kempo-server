// Built-in middleware functions for Kempo Server
import zlib from 'zlib';

// CORS Middleware
export const corsMiddleware = (config) => {
  return async (req, res, next) => {
    const origin = req.headers.origin;
    const allowedOrigins = Array.isArray(config.origin) ? config.origin : [config.origin];
    
    if (config.origin === '*' || allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin || '*');
    }
    
    res.setHeader('Access-Control-Allow-Methods', config.methods.join(', '));
    res.setHeader('Access-Control-Allow-Headers', config.headers.join(', '));
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }
    
    await next();
  };
};

// Compression Middleware
export const compressionMiddleware = (config) => {
  return async (req, res, next) => {
    const acceptEncoding = req.headers['accept-encoding'] || '';
    
    if (!acceptEncoding.includes('gzip')) {
      return await next();
    }
    
    // Use original response for internal operations
    const originalRes = res._originalResponse || res;
    
    const originalEnd = originalRes.end;
    const originalWrite = originalRes.write;
    const chunks = [];
    
    originalRes.write = function(chunk) {
      if (chunk) chunks.push(Buffer.from(chunk));
      return true;
    };
    
    originalRes.end = function(chunk) {
      if (chunk) chunks.push(Buffer.from(chunk));
      
      const buffer = Buffer.concat(chunks);
      
      // Only compress if above threshold
      if (buffer.length >= config.threshold) {
        zlib.gzip(buffer, (err, compressed) => {
          if (!err && compressed.length < buffer.length) {
            originalRes.setHeader('Content-Encoding', 'gzip');
            originalRes.setHeader('Content-Length', compressed.length);
            originalEnd.call(originalRes, compressed);
          } else {
            originalEnd.call(originalRes, buffer);
          }
        });
      } else {
        originalEnd.call(originalRes, buffer);
      }
    };
    
    await next();
  };
};

// Rate Limiting Middleware
export const rateLimitMiddleware = (config) => {
  const requestCounts = new Map();
  
  return async (req, res, next) => {
    const originalReq = req._originalRequest || req;
    const clientId = originalReq.socket.remoteAddress;
    const now = Date.now();
    const windowStart = now - config.windowMs;
    
    if (!requestCounts.has(clientId)) {
      requestCounts.set(clientId, []);
    }
    
    const requests = requestCounts.get(clientId);
    const recentRequests = requests.filter(time => time > windowStart);
    
    if (recentRequests.length >= config.maxRequests) {
      res.writeHead(429, { 'Content-Type': 'text/plain' });
      res.end(config.message);
      return;
    }
    
    recentRequests.push(now);
    requestCounts.set(clientId, recentRequests);
    
    await next();
  };
};

// Security Headers Middleware
export const securityMiddleware = (config) => {
  return async (req, res, next) => {
    for (const [header, value] of Object.entries(config.headers)) {
      res.setHeader(header, value);
    }
    await next();
  };
};

// Logging Middleware
export const loggingMiddleware = (config, log) => {
  return async (req, res, next) => {
    const startTime = Date.now();
    const userAgent = config.includeUserAgent ? req.headers['user-agent'] : '';
    
    // Use original response for wrapping
    const originalRes = res._originalResponse || res;
    
    // Store original end to capture response
    const originalEnd = originalRes.end;
    originalRes.end = function(...args) {
      const responseTime = Date.now() - startTime;
      let logMessage = `${req.method} ${req.url}`;
      
      if (config.includeResponseTime) {
        logMessage += ` - ${responseTime}ms`;
      }
      
      if (config.includeUserAgent && userAgent) {
        logMessage += ` - ${userAgent}`;
      }
      
      log(logMessage, 1);
      originalEnd.apply(originalRes, args);
    };
    
    await next();
  };
};
