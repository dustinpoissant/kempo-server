# Configuration

To configure the server, create a configuration file (by default `.config.json`) within the root directory of your server (`public` in the start example). You can specify a different configuration file using the `--config` flag.

**Important:** 
- When using a relative path for the `--config` flag, the config file must be located within the server root directory
- When using an absolute path for the `--config` flag, the config file can be located anywhere on the filesystem
- The server will throw an error if you attempt to use a relative config file path that points outside the root directory

## Command Line Configuration

You can specify different configuration files for different environments using the `--config` flag:

```bash
# Development
kempo-server --root public --config dev.config.json

# Staging
kempo-server --root public --config staging.config.json

# Production with absolute path
kempo-server --root public --config /etc/kempo/production.config.json

# Mix with other options
kempo-server --root dist --port 8080 --config production.config.json
```

## Configuration File Structure

This json file can have any of the following properties, any property not defined will use the "Default Config".

- [allowedMimes](#allowedmimes)
- [disallowedRegex](#disallowedregex)
- [customRoutes](#customroutes)
- [routeFiles](#routefiles)
- [noRescanPaths](#norescanpaths)
- [maxRescanAttempts](#maxrescanattempts)
- [cache](#cache)
- [middleware](#middleware)

## Cache

Kempo Server includes an intelligent module caching system that dramatically improves performance by caching JavaScript route modules in memory. The cache combines multiple strategies:

- **LRU (Least Recently Used)** - Evicts oldest modules when cache fills
- **Time-based expiration** - Modules expire after configurable TTL
- **Memory monitoring** - Automatically clears cache if memory usage gets too high
- **File watching** - Instantly invalidates cache when files change (development)

### Basic Cache Configuration

Enable caching in your `.config.json`:

```json
{
  "cache": {
    "enabled": true,
    "maxSize": 100,
    "maxMemoryMB": 50,
    "ttlMs": 300000,
    "watchFiles": true
  }
}
```

### Cache Options

- `enabled` (boolean) - Enable/disable caching (default: `true`)
- `maxSize` (number) - Maximum cached modules (default: `100`) 
- `maxMemoryMB` (number) - Memory limit in MB (default: `50`)
- `ttlMs` (number) - Cache lifetime in milliseconds (default: `300000` - 5 minutes)
- `maxHeapUsagePercent` (number) - Clear cache when heap exceeds % (default: `70`)
- `memoryCheckInterval` (number) - Memory check frequency in ms (default: `30000`)
- `watchFiles` (boolean) - Auto-invalidate on file changes (default: `true`)
- `enableMemoryMonitoring` (boolean) - Enable memory monitoring (default: `true`)

Run with specific config: `kempo-server --config prod.config.json`

### Cache Monitoring

Monitor cache performance at runtime:

- **View stats:** `GET /_admin/cache` - Returns detailed cache statistics
- **Clear cache:** `DELETE /_admin/cache` - Clears entire cache

Example response:
```json
{
  "cache": {
    "size": 45,
    "maxSize": 100,
    "memoryUsageMB": 12.5,
    "hitRate": 87
  }
}
```

## Middleware

Kempo Server includes a powerful middleware system that allows you to add functionality like authentication, logging, CORS, compression, and more. Middleware runs before your route handlers and can modify requests, responses, or handle requests entirely.

### Built-in Middleware

#### CORS
Enable Cross-Origin Resource Sharing for your API:

```json
{
  "middleware": {
    "cors": {
      "enabled": true,
      "origin": "*",
      "methods": ["GET", "POST", "PUT", "DELETE"],
      "headers": ["Content-Type", "Authorization"]
    }
  }
}
```

#### Compression
Automatically compress responses with gzip:

```json
{
  "middleware": {
    "compression": {
      "enabled": true,
      "threshold": 1024
    }
  }
}
```

#### Rate Limiting
Limit requests per client to prevent abuse:

```json
{
  "middleware": {
    "rateLimit": {
      "enabled": true,
      "maxRequests": 100,
      "windowMs": 60000,
      "message": "Too many requests"
    }
  }
}
```

#### Security Headers
Add security headers to all responses:

```json
{
  "middleware": {
    "security": {
      "enabled": true,
      "headers": {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "X-XSS-Protection": "1; mode=block"
      }
    }
  }
}
```

#### Request Logging
Log requests with configurable detail:

```json
{
  "middleware": {
    "logging": {
      "enabled": true,
      "includeUserAgent": true,
      "includeResponseTime": true
    }
  }
}
```

### Custom Middleware

Create your own middleware by writing JavaScript files and referencing them in your config:

```json
{
  "middleware": {
    "custom": ["./middleware/auth.js", "./middleware/analytics.js"]
  }
}
```

#### Custom Middleware Example

```javascript
// middleware/auth.js
export default (config) => {
  return async (req, res, next) => {
    const token = req.headers.authorization;
    
    if (!token) {
      req.user = null;
      return await next();
    }
    
    try {
      // Verify JWT token (example)
      const user = verifyToken(token);
      req.user = user;
      req.permissions = await getUserPermissions(user.id);
      
      // Add helper methods
      req.hasPermission = (permission) => req.permissions.includes(permission);
      
    } catch (error) {
      req.user = null;
    }
    
    await next();
  };
};
```

#### Using Enhanced Requests in Routes

Your route files can now access the enhanced request object:

```javascript
// api/user/profile/GET.js
export default async (req, res, params) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  if (!req.hasPermission('user:read')) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  
  const profile = await getUserProfile(req.user.id);
  res.json(profile);
};
```

### Middleware Order

Middleware executes in this order:
1. Built-in middleware (cors, compression, rateLimit, security, logging)
2. Custom middleware (in the order listed in config)
3. Your route handlers

### Route Interception

Middleware can intercept and handle routes completely, useful for authentication endpoints:

```javascript
// middleware/auth-routes.js
export default (config) => {
  return async (req, res, next) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    
    // Handle login endpoint
    if (req.method === 'POST' && url.pathname === '/auth/login') {
      const credentials = await req.json();
      const token = await authenticateUser(credentials);
      
      if (token) {
        return res.json({ token, success: true });
      } else {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
    }
    
    await next();
  };
};
```

## Configuration Options

### allowedMimes

An object mapping file extensions to their MIME types. Files with extensions not in this list will not be served.

```json
{
  "allowedMimes": {
    "html": "text/html",
    "css": "text/css",
    "js": "application/javascript",
    "json": "application/json",
    "png": "image/png",
    "jpg": "image/jpeg"
  }
}
```

### disallowedRegex

An array of regular expressions that match paths that should never be served. This provides security by preventing access to sensitive files.

```json
{
  "disallowedRegex": [
    "^/\\..*",
    "\\.env$",
    "\\.config$",
    "password"
  ]
}
```

### routeFiles

An array of filenames that should be treated as route handlers and executed as JavaScript modules.

```json
{
  "routeFiles": [
    "GET.js",
    "POST.js",
    "PUT.js",
    "DELETE.js",
    "index.js"
  ]
}
```

### noRescanPaths

An array of regex patterns for paths that should not trigger a file system rescan. This improves performance for common static assets.

```json
{
  "noRescanPaths": [
    "/favicon\\.ico$",
    "/robots\\.txt$",
    "\\.map$"
  ]
}
```

### customRoutes

An object mapping custom route paths to file paths. Useful for aliasing or serving files from outside the document root.

**Note:** All file paths in customRoutes are resolved relative to the server root directory (the `--root` path). This allows you to reference files both inside and outside the document root.

**Basic Routes:**
```json
{
  "customRoutes": {
    "/vendor/bootstrap.css": "../node_modules/bootstrap/dist/css/bootstrap.min.css",
    "/api/status": "./status.js"
  }
}
```

**Wildcard Routes:**
Wildcard routes allow you to map entire directory structures using the `*` and `**` wildcards:

```json
{
  "customRoutes": {
    "kempo/*": "../node_modules/kempo/dist/*",
    "assets/*": "../static-files/*",
    "docs/*": "../documentation/*",
    "src/**": "../src/**"
  }
}
```

With wildcard routes:
- `kempo/styles.css` would serve `../node_modules/kempo/dist/styles.css`
- `assets/logo.png` would serve `../static-files/logo.png`  
- `docs/readme.md` would serve `../documentation/readme.md`
- `src/components/Button.js` would serve `../src/components/Button.js`

The `*` wildcard matches any single path segment (anything between `/` characters).
The `**` wildcard matches any number of path segments, allowing you to map entire directory trees.
Multiple wildcards can be used in a single route pattern.

### maxRescanAttempts

The maximum number of times to attempt rescanning the file system when a file is not found. Defaults to 3.

```json
{
  "maxRescanAttempts": 3
}
```

## Configuration Examples

### Development Environment

**Focus: Fast iteration and debugging**
```json
{
  "cache": {
    "enabled": true,
    "maxSize": 50,
    "ttlMs": 300000,
    "watchFiles": true
  },
  "middleware": {
    "cors": {
      "enabled": true,
      "origin": "*"
    },
    "logging": {
      "enabled": true,
      "includeUserAgent": true,
      "includeResponseTime": true
    }
  }
}
```

### Production Environment

**Focus: Performance, security, and stability**
```json
{
  "cache": {
    "enabled": true,
    "maxSize": 1000,
    "maxMemoryMB": 200,
    "ttlMs": 3600000,
    "maxHeapUsagePercent": 85,
    "memoryCheckInterval": 60000,
    "watchFiles": false
  },
  "middleware": {
    "cors": {
      "enabled": true,
      "origin": ["https://myapp.com", "https://www.myapp.com"],
      "credentials": true
    },
    "compression": {
      "enabled": true,
      "threshold": 1024
    },
    "security": {
      "enabled": true,
      "headers": {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "X-XSS-Protection": "1; mode=block",
        "Strict-Transport-Security": "max-age=31536000; includeSubDomains"
      }
    },
    "logging": {
      "enabled": true,
      "includeUserAgent": false,
      "includeResponseTime": true
    }
  }
}
```

### Low-Memory Environment

**Focus: Minimal resource usage**
```json
{
  "cache": {
    "enabled": true,
    "maxSize": 20,
    "maxMemoryMB": 5,
    "ttlMs": 120000,
    "maxHeapUsagePercent": 60,
    "memoryCheckInterval": 10000
  }
}
```

### Debugging Environment

**Focus: Cache disabled for troubleshooting**
```json
{
  "cache": {
    "enabled": false
  },
  "middleware": {
    "logging": {
      "enabled": true,
      "includeUserAgent": true,
      "includeResponseTime": true
    }
  }
}
```

## Additional Resources

- **HTML Documentation**: See `docs/configuration.html` for detailed web-based documentation
- **Caching Guide**: See `docs/caching.html` for comprehensive caching documentation
- **Middleware Guide**: See `docs/middleware.html` for detailed middleware documentation
