# Configuration

To configure the server, create a configuration file (by default `.config.js`) within the root directory of your server (`public` in the start example). The server also supports `.config.json` as a fallback. You can specify a different configuration file using the `--config` flag.

**Important:** 
- When using a relative path for the `--config` flag, the config file must be located within the server root directory
- When using an absolute path for the `--config` flag, the config file can be located anywhere on the filesystem
- The server will throw an error if you attempt to use a relative config file path that points outside the root directory

## Command Line Configuration

You can specify different configuration files for different environments using the `--config` flag:

```bash
# Development
kempo-server --root public --config dev.config.js

# Staging
kempo-server --root public --config staging.config.js

# Production with absolute path
kempo-server --root public --config /etc/kempo/production.config.js

# Mix with other options
kempo-server --root dist --port 8080 --config production.config.js

# JSON config files are also supported
kempo-server --root public --config legacy.config.json
```

## Configuration File Structure

The config file exports a default object with any of the following properties. Any property not defined will use the "Default Config".

```javascript
// .config.js
export default {
  // your config here
};
```

- [allowedMimes](#allowedmimes)
- [disallowedRegex](#disallowedregex)
- [customRoutes](#customroutes)
- [routeFiles](#routefiles)
- [noRescanPaths](#norescanpaths)
- [maxRescanAttempts](#maxrescanattempts)
- [maxBodySize](#maxbodysize)
- [cache](#cache)
- [middleware](#middleware)
- [templating](#templating)

## Cache

Kempo Server includes an intelligent module caching system that dramatically improves performance by caching JavaScript route modules in memory. The cache combines multiple strategies:

- **LRU (Least Recently Used)** - Evicts oldest modules when cache fills
- **Time-based expiration** - Modules expire after configurable TTL
- **Memory monitoring** - Automatically clears cache if memory usage gets too high
- **File watching** - Instantly invalidates cache when files change (development)

### Basic Cache Configuration

Enable caching in your `.config.js`:

```javascript
export default {
  cache: {
    enabled: true,
    maxSize: 100,
    maxMemoryMB: 50,
    ttlMs: 300000,
    watchFiles: true
  }
};
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

Run with specific config: `kempo-server --config prod.config.js`

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

```javascript
export default {
  middleware: {
    cors: {
      enabled: true,
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      headers: ['Content-Type', 'Authorization']
    }
  }
};
```

#### Compression
Automatically compress responses with gzip:

```javascript
export default {
  middleware: {
    compression: {
      enabled: true,
      threshold: 1024
    }
  }
};
```

#### Rate Limiting
Limit requests per client to prevent abuse:

```javascript
export default {
  middleware: {
    rateLimit: {
      enabled: true,
      maxRequests: 100,
      windowMs: 60000,
      message: 'Too many requests'
    }
  }
};
```

#### Security Headers
Add security headers to all responses:

```javascript
export default {
  middleware: {
    security: {
      enabled: true,
      headers: {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block'
      }
    }
  }
};
```

#### Request Logging
Log requests with configurable detail:

```javascript
export default {
  middleware: {
    logging: {
      enabled: true,
      includeUserAgent: true,
      includeResponseTime: true
    }
  }
};
```

### Custom Middleware

Create your own middleware by writing JavaScript files and referencing them in your config:

```javascript
export default {
  middleware: {
    custom: ['./middleware/auth.js', './middleware/analytics.js']
  }
};
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

```javascript
export default {
  allowedMimes: {
    html: 'text/html',
    css: 'text/css',
    js: 'application/javascript',
    json: 'application/json',
    png: 'image/png',
    jpg: 'image/jpeg'
  }
};
```

### disallowedRegex

An array of regular expressions that match paths that should never be served. This provides security by preventing access to sensitive files.

```javascript
export default {
  disallowedRegex: [
    '^/\\..*',
    '\\.env$',
    '\\.config$',
    'password'
  ]
};
```

### routeFiles

An array of filenames that should be treated as route handlers and executed as JavaScript modules.

```javascript
export default {
  routeFiles: [
    'GET.js',
    'POST.js',
    'PUT.js',
    'DELETE.js',
    'index.js'
  ]
};
```

### noRescanPaths

An array of regex patterns for paths that should not trigger a file system rescan. This improves performance for common static assets.

```javascript
export default {
  noRescanPaths: [
    '/favicon\\.ico$',
    '/robots\\.txt$',
    '\\.map$'
  ]
};
```

### customRoutes

An object mapping custom route paths to file paths. Useful for aliasing or serving files from outside the document root.

**Note:** All file paths in customRoutes are resolved relative to the server root directory (the `--root` path). This allows you to reference files both inside and outside the document root.

**Basic Routes:**
```javascript
export default {
  customRoutes: {
    '/vendor/bootstrap.css': '../node_modules/bootstrap/dist/css/bootstrap.min.css',
    '/api/status': './status.js'
  }
};
```

**Wildcard Routes:**
Wildcard routes allow you to map entire directory structures using the `*` and `**` wildcards:

```javascript
export default {
  customRoutes: {
    'kempo/*': '../node_modules/kempo/dist/*',
    'assets/*': '../static-files/*',
    'docs/*': '../documentation/*',
    'src/**': '../src/**'
  }
};
```

With wildcard routes:
- `kempo/styles.css` would serve `../node_modules/kempo/dist/styles.css`
- `assets/logo.png` would serve `../static-files/logo.png`  
- `docs/readme.md` would serve `../documentation/readme.md`
- `src/components/Button.js` would serve `../src/components/Button.js`

The `*` wildcard matches any single path segment (anything between `/` characters).
The `**` wildcard matches any number of path segments, allowing you to map entire directory trees.
Multiple wildcards can be used in a single route pattern.

**Directory Resolution:**
When a custom route (basic or wildcard) resolves to a directory, the server looks for files inside it using the same priority as normal file-based routing:

1. `METHOD.js` (e.g. `GET.js`, `POST.js`) — executed as a route module
2. `METHOD.html` (e.g. `GET.html`) — served as a static file
3. `index.js` — executed as a route module
4. `index.html` / `index.htm` — served as a static file

This means wildcard routes like `"/api/**": "../api/**"` fully support API directories containing route files (`GET.js`, `POST.js`, etc.), not just static files.

If the resolved path is a file whose name matches `routeFiles` (e.g. `GET.js`), it will be executed as a route module rather than served as static content.

### maxRescanAttempts

The maximum number of times to attempt rescanning the file system when a file is not found. Defaults to 3.

```javascript
export default {
  maxRescanAttempts: 3
};
```

### maxBodySize

Maximum allowed request body size in bytes. If a request body exceeds this limit, the server responds with `413 Payload Too Large` before the route handler runs. Defaults to `1048576` (1 MB).

```javascript
export default {
  maxBodySize: 1048576
};
```

### templating

The templating system lets you build HTML pages from reusable templates, fragments, and content blocks using valid XML syntax. Files use the conventions `*.template.html`, `*.page.html`, and `*.fragment.html`.

```javascript
export default {
  templating: {
    preRender: false,
    ssr: false,
    globals: {},
    state: {},
    maxFragmentDepth: 10
  }
};
```

- `preRender` (boolean) - Render all `.page.html` files to `.html` on server start (default: `false`)
- `ssr` (boolean) - Render `.page.html` files on-the-fly when the corresponding `.html` file is not found (default: `false`)
- `globals` (object) - Variables available in all templates. Values can be functions (called with no args at render time).
- `state` (object) - Additional variables, typically CMS data. Merged after globals so state overrides globals.
- `maxFragmentDepth` (number) - Maximum nesting depth for fragment includes (default: `10`)

#### Pre-Render Mode

With `preRender: true`, the server renders all page files when it starts or rescans. This is ideal for static sites.

```javascript
export default {
  templating: {
    preRender: true,
    globals: {
      siteName: 'My Site',
      year: () => String(new Date().getFullYear())
    }
  }
};
```

#### SSR Mode

With `ssr: true`, when a request comes in for `/about` and `about.html` does not exist but `about.page.html` does, the server renders it on-the-fly.

```javascript
export default {
  templating: {
    ssr: true,
    globals: {
      siteName: 'My Site'
    },
    state: {
      currentUser: 'Guest'
    }
  }
};
```

#### CLI Rendering

You can also render pages without starting the server using the CLI script:

```bash
kempo-render <inputDir> [outputDir] [stateFile]
```

The script loads `.config.js` (or `.config.json`) from the input directory for `templating.globals`, `templating.state`, and `templating.maxFragmentDepth`. An optional state file (`.js` or `.json`) merges additional state variables.

#### Templating File Conventions

- **Templates** (`*.template.html`): Layout files with `<location>` placeholders
- **Pages** (`*.page.html`): Content files wrapped in `<page template="...">` with `<content location="...">` blocks
- **Fragments** (`*.fragment.html`): Reusable HTML snippets included via `<fragment name="..." />`

#### Built-in Variables

These variables are available in all templates:
- `{{pathToRoot}}` - Relative path to the root directory (e.g. `../../`)
- `{{year}}` - Current four-digit year
- `{{date}}` - Current date in ISO format (YYYY-MM-DD)
- `{{datetime}}` - Full ISO datetime string
- `{{timestamp}}` - Unix timestamp
- `{{version}}` - Version from `package.json`
- `{{env}}` - Value of `NODE_ENV`

#### Conditionals and Loops

```html
<if condition="env === 'development'">
  <p>Debug mode</p>
</if>

<foreach in="items" as="item">
  <li>{{item.name}}</li>
</foreach>
```

Conditions support `===`, `!==`, `>`, `<`, `>=`, `<=`, `&&`, `||`, `!`, parentheses, string/number/boolean literals, and dot-path variable references.

## Configuration Examples

### Development Environment

**Focus: Fast iteration and debugging**
```javascript
export default {
  cache: {
    enabled: true,
    maxSize: 50,
    ttlMs: 300000,
    watchFiles: true
  },
  middleware: {
    cors: {
      enabled: true,
      origin: '*'
    },
    logging: {
      enabled: true,
      includeUserAgent: true,
      includeResponseTime: true
    }
  }
};
```

### Production Environment

**Focus: Performance, security, and stability**
```javascript
export default {
  cache: {
    enabled: true,
    maxSize: 1000,
    maxMemoryMB: 200,
    ttlMs: 3600000,
    maxHeapUsagePercent: 85,
    memoryCheckInterval: 60000,
    watchFiles: false
  },
  middleware: {
    cors: {
      enabled: true,
      origin: ['https://myapp.com', 'https://www.myapp.com'],
      credentials: true
    },
    compression: {
      enabled: true,
      threshold: 1024
    },
    security: {
      enabled: true,
      headers: {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
      }
    },
    logging: {
      enabled: true,
      includeUserAgent: false,
      includeResponseTime: true
    }
  }
};
```

### Low-Memory Environment

**Focus: Minimal resource usage**
```javascript
export default {
  cache: {
    enabled: true,
    maxSize: 20,
    maxMemoryMB: 5,
    ttlMs: 120000,
    maxHeapUsagePercent: 60,
    memoryCheckInterval: 10000
  }
};
```

### Debugging Environment

**Focus: Cache disabled for troubleshooting**
```javascript
export default {
  cache: {
    enabled: false
  },
  middleware: {
    logging: {
      enabled: true,
      includeUserAgent: true,
      includeResponseTime: true
    }
  }
};
```

## Additional Resources

- **HTML Documentation**: See `docs/configuration.html` for detailed web-based documentation
- **Caching Guide**: See `docs/caching.html` for comprehensive caching documentation
- **Middleware Guide**: See `docs/middleware.html` for detailed middleware documentation
