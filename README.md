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

- `request.body` - Pre-parsed request body (JSON → object, form-urlencoded → object, other → raw string, no body → `null`)

### Methods
- `await request.json()` - Get cached body parsed as JSON
- `await request.text()` - Get cached body as text
- `await request.buffer()` - Get cached body as Buffer
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
  const { name, email } = request.body;
  
  // request.body is already parsed from JSON
  const updatedUser = await updateUser(id, { name, email });
  
  response.json(updatedUser);
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

Kempo Server can be customized with a simple JSON configuration file to control caching, middleware, security, routing, and more.

For detailed configuration options and examples, see **[CONFIG.md](./CONFIG.md)**.

**Important:** The config file must be placed **inside the server root directory** (the `--root` folder). All paths in the config (like `customRoutes`) are resolved relative to the config file location.

Quick start:
```bash
# Create a config file INSIDE the server root
echo '{"cache": {"enabled": true}}' > public/.config.json

# Use different configs for different environments
kempo-server --root public --config dev.config.json
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
- **Programmatic Rescan** - Trigger a file rescan from anywhere in the Node process without restarting

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
  
  // request.body is pre-parsed based on Content-Type
  const updatedUser = {
    id: id,
    ...request.body,
    updatedAt: new Date().toISOString()
  };
  
  response.json(updatedUser);
}
```

### Form Handling Route

```javascript
// contact/POST.js
// With Content-Type: application/x-www-form-urlencoded,
// request.body is automatically parsed into an object
export default async function(request, response) {
  const { name, email } = request.body;
  
  // Process form data...
  
  response.html('<h1>Thank you for your message!</h1>');
}
```

## Programmatic File Rescan

When files are added or removed at runtime (e.g., by a CMS generating static pages), you can trigger a file rescan without restarting the server:

```javascript
import rescan from 'kempo-server/rescan';

// Returns a promise that resolves with the new file count
const fileCount = await rescan();
```

This works from anywhere in the same Node process — route handlers, middleware, background tasks, file watchers, or any other code running alongside the server.

```javascript
// Example: CMS generates a page and makes it immediately available
import { writeFile } from 'fs/promises';
import rescan from 'kempo-server/rescan';

const html = buildPage(theme, template, content);
await writeFile('./public/new-page.html', html);
await rescan();
// New page is now live
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

**Note:** To enable automatic rescanning for new files during development, set `maxRescanAttempts` in your config file (default is 3). Set to 0 to disable rescanning.

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

## Single-Page Applications

Kempo Server makes it easy to serve SPAs by using `customRoutes` to redirect all HTML requests to your shell page while still serving individual page fragments from a `pages/` directory.

See **[SPA.md](./SPA.md)** for a full walkthrough.

## Documentation

- **[Getting Started](./docs/getting-started.html)** - Installation and basic usage
- **[Routing](./docs/routing.html)** - File-based routing system
- **[Request & Response](./docs/request-response.html)** - Working with HTTP objects
- **[Configuration](./docs/configuration.html)** - Server configuration options
- **[Middleware](./docs/middleware.html)** - Built-in and custom middleware
- **[Caching](./docs/caching.html)** - Cache configuration and management
- **[CLI Utilities](./docs/cli-utils.html)** - Command-line argument parsing
- **[File System Utilities](./docs/fs-utils.html)** - File and directory operations
- **[UTILS.md](./UTILS.md)** - Utility modules including rescan, CLI, and file system helpers
- **[Examples](./docs/examples.html)** - Interactive examples and demos
- **[CONFIG.md](./CONFIG.md)** - Comprehensive server configuration guide
- **[UTILS.md](./UTILS.md)** - Utility modules for Node.js projects

