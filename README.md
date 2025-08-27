# Kempo Server

A lightweight, zero-dependency, file based routing server.

## Getting Started

1. Install the npm package.

```bash
npm install kempo-server
```

2. Add it to your `package.json` scripts, use the `--root` flag to tell it where the root of your site is.

```
{
  ...
  "scripts": {
    "start": "kempo-server --root public"
  }
  ...
}
```

3. Run it in your terminal.

```bash
npm run start
```

## Routes

A route is a request to a directory that will be handled by a file. To define routes, create the directory structure to the route and create a file with the name of the method that this file will handle. For example `GET.js` will handle the `GET` requests, `POST.js` will handle the `POST` requests and so on. Use `index.js` to handle all request types.

The Javascript file must have a **default** export that is the function that will handle the request. It will be passed a `request`, `response`, and `params` arguments (See [Dynamic Routes](#dynamic-routes) below).

For example this directory structure:

```
my/
├─ route/
│  ├─ GET.js
│  ├─ POST.js
├─ other/
│  ├─ route/
│  │  ├─ GET.js
```

Would be used to handle `GET my/route/`, `POST my/route/` and `GET my/other/route/`

### HTML Routes

Just like JS files, HTML files can be used to define a route. Use `GET.html`, `POST.html`, etc... to define files that will be served when that route is requested.

```
my/
├─ route/
│  ├─ GET.js
│  ├─ POST.js
├─ other/
│  ├─ route/
│  │  ├─ GET.js
│  ├─ POST.html
│  ├─ GET.html
```

### `index` fallbacks

`index.js` or `index.html` will be used as a fallback for all routes if a *method* file is not defined. In the above examples we do not have any routes defined for `DELETE`, `PUT` `PATCH`, etc... so lets use an `index.js` and `index.html` to be a "catch-all" for all the methods we have not created handlers for.

```
my/
├─ route/
│  ├─ GET.js
│  ├─ POST.js
│  ├─ index.js
├─ other/
│  ├─ route/
│  │  ├─ GET.js
│  │  ├─ index.js
│  ├─ POST.html
│  ├─ GET.html
│  ├─ index.html
├─ index.html
```

## Dynamic Routes

A dynamic route is a route with a "param" in its path. To define the dynamic parts of the route just wrap the directory name in square brackets. For example if you wanted to get a users profile, or perform CRUD operations on a user you might create the following directory structure.

```
api/
├─ user/
│  ├─ [id]/
│  │  ├─ [info]/
│  │  │  ├─ GET.js
│  │  │  ├─ DELETE.js
│  │  │  ├─ PUT.js
│  │  │  ├─ POST.js
│  │  ├─ GET.js
```

When a request is made to `/api/user/123/info`, the route file `api/user/[id]/[info]/GET.js` would be executed and receive a request object with `request.params` containing `{ id: "123", info: "info" }`.

## Request Object

Kempo Server provides a request object that makes working with HTTP requests easier:

### Properties
- `request.params` - Route parameters from dynamic routes (e.g., `{ id: "123", info: "info" }`)
- `request.query` - Query string parameters as an object (e.g., `{ page: "1", limit: "10" }`)
- `request.path` - The pathname of the request URL
- `request.method` - HTTP method (GET, POST, etc.)
- `request.headers` - Request headers object
- `request.url` - Full request URL

### Methods
- `await request.json()` - Parse request body as JSON
- `await request.text()` - Get request body as text
- `await request.body()` - Get raw request body as string
- `await request.buffer()` - Get request body as Buffer
- `request.get(headerName)` - Get specific header value
- `request.is(type)` - Check if content-type contains specified type

### Example Route File

Here's an example of what a route file might look like:

```javascript
// api/user/[id]/GET.js
export default async function(request, response) {
  const { id } = request.params;
  const { includeDetails } = request.query;
  
  // Fetch user data from database
  const userData = await getUserById(id);
  
  if (!userData) {
    return response.status(404).json({ error: 'User not found' });
  }
  
  response.json(userData);
}
```

### POST Request Example

```javascript
// api/user/[id]/POST.js
export default async function(request, response) {
  const { id } = request.params;
  
  try {
    const updateData = await request.json();
    
    // Update user in database
    const updatedUser = await updateUser(id, updateData);
    
    response.json(updatedUser);
  } catch (error) {
    response.status(400).json({ error: 'Invalid JSON' });
  }
}
```

## Response Object

Kempo Server also provides a response object that makes sending responses easier:

### Methods
- `response.json(object)` - Send JSON response with automatic content-type
- `response.send(data)` - Send response (auto-detects content type)
- `response.html(htmlString)` - Send HTML response
- `response.text(textString)` - Send plain text response
- `response.status(code)` - Set status code (chainable)
- `response.set(field, value)` - Set header (chainable)
- `response.type(contentType)` - Set content type (chainable)
- `response.redirect(url, statusCode)` - Redirect to URL
- `response.cookie(name, value, options)` - Set cookie
- `response.clearCookie(name, options)` - Clear cookie

### Response Methods Examples

The response object supports multiple ways to send responses:

```javascript
// Different response types
export default async function(request, response) {
  // JSON response
  response.json({ message: 'Hello World' });
  
  // HTML response
  response.html('<h1>Hello World</h1>');
  
  // Text response
  response.text('Hello World');
  
  // Status code chaining
  response.status(201).json({ created: true });
  
  // Custom headers
  response.set('X-Custom-Header', 'value').json({ data: 'test' });
  
  // Redirect
  response.redirect('/login');
  
  // Set cookies
  response.cookie('session', 'abc123', { httpOnly: true }).json({ success: true });
}
```

## Configuration

To configure the server, create a configuration file (by default `.config.json`) within the root directory of your server (`public` in the start example [above](#getting-started)). You can specify a different configuration file using the `--config` flag.

This json file can have any of the following properties, any property not defined will use the "Default Config".

- [allowedMimes](#allowedmimes)
- [disallowedRegex](#disallowedregex)
- [customRoutes](#customroutes)
- [routeFiles](#routefiles)
- [noRescanPaths](#norescanpaths)
- [maxRescanAttempts](#maxrescanattempts)
- [middleware](#middleware)

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

**Basic Routes:**
```json
{
  "customRoutes": {
    "/vendor/bootstrap.css": "./node_modules/bootstrap/dist/css/bootstrap.min.css",
    "/api/status": "./status.js"
  }
}
```

**Wildcard Routes:**
Wildcard routes allow you to map entire directory structures using the `*` wildcard:

```json
{
  "customRoutes": {
    "kempo/*": "./node_modules/kempo/dust/*",
    "assets/*": "./static-files/*",
    "docs/*": "./documentation/*"
  }
}
```

With wildcard routes:
- `kempo/styles.css` would serve `./node_modules/kempo/dust/styles.css`
- `assets/logo.png` would serve `./static-files/logo.png`  
- `docs/readme.md` would serve `./documentation/readme.md`

The `*` wildcard matches any single path segment (anything between `/` characters). Multiple wildcards can be used in a single route pattern.

### maxRescanAttempts

The maximum number of times to attempt rescanning the file system when a file is not found. Defaults to 3.

```json
{
  "maxRescanAttempts": 3
}
```

## Features

- **Zero Dependencies** - No external dependencies required
- **File-based Routing** - Routes are defined by your directory structure
- **Dynamic Routes** - Support for parameterized routes with square bracket syntax
- **Wildcard Routes** - Map entire directory structures with wildcard patterns
- **Middleware System** - Built-in and custom middleware support for authentication, logging, CORS, and more
- **Request Object** - Request handling with built-in body parsing
- **Response Object** - Response handling with chainable methods
- **Multiple HTTP Methods** - Support for GET, POST, PUT, DELETE, and more
- **Static File Serving** - Automatically serves static files with proper MIME types
- **HTML Routes** - Support for both JavaScript and HTML route handlers
- **Query Parameters** - Easy access to URL query parameters
- **Configurable** - Customize behavior with a simple JSON config file
- **Security** - Built-in protection against serving sensitive files plus security headers middleware
- **Performance** - Smart file system caching, rescan optimization, and optional compression

## Examples

### Simple API Route

```javascript
// api/hello/GET.js
export default async function(request, response) {
  const { name } = request.query; // Access query parameters like ?name=John
  
  const message = name ? `Hello ${name}!` : 'Hello World!';
  
  response.json({ message });
}
```

### Dynamic User Profile Route

```javascript
// api/users/[id]/GET.js
export default async function(request, response) {
  const { id } = request.params; // Access route parameters
  const { includeProfile } = request.query; // Access query parameters
  
  // Simulate database lookup
  const user = {
    id: id,
    name: `User ${id}`,
    email: `user${id}@example.com`
  };
  
  if (includeProfile === 'true') {
    user.profile = {
      bio: `Bio for user ${id}`,
      joinDate: '2024-01-01'
    };
  }
  
  response.json(user);
}
```

### JSON API Route

```javascript
// api/users/[id]/POST.js
export default async function(request, response) {
  const { id } = request.params;
  
  try {
    const userData = await request.json(); // Parse JSON body easily
    
    // Update user in database
    const updatedUser = {
      id: id,
      ...userData,
      updatedAt: new Date().toISOString()
    };
    
    response.json(updatedUser);
  } catch (error) {
    response.status(400).json({ error: 'Invalid JSON' });
  }
}
```

### Form Handling Route

```javascript
// contact/POST.js
export default async function(request, response) {
  try {
    const body = await request.text(); // Get raw text body
    const formData = new URLSearchParams(body);
    const name = formData.get('name');
    const email = formData.get('email');
    
    // Process form data...
    
    response.html('<h1>Thank you for your message!</h1>');
  } catch (error) {
    response.status(400).html('<h1>Error processing form</h1>');
  }
}
```

## Command Line Options

Kempo Server supports several command line options to customize its behavior:

- `--root <path>` - Set the document root directory (required)
- `--port <number>` - Set the port number (default: 3000)
- `--host <address>` - Set the host address (default: localhost)
- `--config <path>` - Set the configuration file path (default: `.config.json`)
- `--verbose` - Enable verbose logging

```bash
kempo-server --root public --port 8080 --host 0.0.0.0 --verbose
```

### Configuration File Examples

You can specify different configuration files for different environments:

```bash
# Development
kempo-server --root public --config dev.config.json

# Staging
kempo-server --root public --config staging.config.json

# Production with absolute path
kempo-server --root public --config /etc/kempo/production.config.json

# Mix with other options
kempo-server --root dist --port 8080 --config production.config.json --scan
```

## Testing

This project uses the Kempo Testing Framework. Tests live in the `tests/` folder and follow these naming conventions:

- `[name].node-test.js` — Node-only tests
- `[name].browser-test.js` — Browser-only tests
- `[name].test.js` — Runs in both environments

### Run tests

Using npm scripts:

```bash
npm run tests         # Run all tests (Node + Browser)
npm run tests:node    # Run Node tests only
npm run tests:browser # Run Browser tests only
npm run tests:gui     # Start the GUI test runner
```

For advanced usage (filters, flags, GUI options), see:
https://github.com/dustinpoissant/kempo-testing-framework

