# Single-Page Applications

Kempo Server supports single-page applications (SPAs) with no framework required. The approach uses `customRoutes` to redirect every HTML URL to one shell page, while individual page content lives as HTML fragments in a `pages/` directory. Client-side JavaScript handles navigation using the History API.

## How It Works

1. All top-level HTML requests (e.g. `/about.html`) are redirected to `app.html` via `customRoutes`.
2. `app.html` is the shell — it contains the `<nav>`, a `<main>` content area, and loads `spa.js`.
3. `spa.js` reads the current URL, fetches the matching fragment from `/pages/`, and injects it into `<main>`.
4. Click events on `<a>` tags are intercepted to update the URL with `history.pushState` and load content without a full page reload.
5. The `popstate` event handles browser back/forward navigation.

Requests to `/pages/*.html` are **not** redirected, so the fragments are still served directly by the server.

## File Structure

```
spa/
├─ .config.json       ← server config (routes + caching)
├─ app.html           ← shell page (loaded for every route)
├─ spa.js             ← client-side routing logic
└─ pages/
   ├─ index.html      ← home page fragment
   ├─ page1.html
   ├─ about.html
   ├─ contact.html
   └─ settings.html
```

## Configuration

Create a `.config.json` in your SPA root:

```json
{
  "customRoutes": {
    "/kempo.css": "../node_modules/kempo-css/dist/kempo.min.css",
    "/*.html": "./app.html",
    "/": "./app.html"
  },
  "middleware": {
    "security": {
      "enabled": true,
      "headers": {
        "Cache-Control": "public, max-age=3600"
      }
    }
  }
}
```

- `"/*.html": "./app.html"` — the `*` wildcard matches a single path segment, so it catches `/about.html` but not `/pages/about.html`.
- `"/": "./app.html"` — handles requests to the root.
- The `Cache-Control` header tells browsers to cache responses for 1 hour.

## Shell Page (`app.html`)

The shell page is a minimal HTML document. Navigation links use absolute paths so they work regardless of the current URL. The `<main>` element is where page content gets injected.

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My SPA</title>
  <link rel="stylesheet" href="/kempo.css" />
</head>
<body>
  <nav>
    <a href="/">Home</a>
    <a href="/about.html">About</a>
    <a href="/contact.html">Contact</a>
  </nav>
  <main id="main"></main>
  <script src="/spa.js"></script>
</body>
</html>
```

## Client-Side Router (`spa.js`)

```javascript
const main = document.getElementById("main");

const loadPage = path => {
  const page = (path === "/" || path === "/index.html")
    ? "/pages/index.html"
    : `/pages${path}`;
  fetch(page)
    .then(r => {
      if(!r.ok) throw new Error(r.status);
      return r.text();
    })
    .then(html => {
      main.innerHTML = html;
    })
    .catch(() => {
      main.innerHTML = "<h1>Page Not Found</h1>";
    });
};

document.addEventListener("click", e => {
  const a = e.target.closest("a");
  if(!a || a.origin !== location.origin) return;
  e.preventDefault();
  history.pushState(null, "", a.href);
  loadPage(a.pathname);
});

window.addEventListener("popstate", () => {
  loadPage(location.pathname);
});

loadPage(location.pathname);
```

### How it works

- `loadPage` maps the URL pathname to a fragment file under `/pages/` and fetches it. The root path `/` maps to `/pages/index.html`.
- The `click` listener intercepts same-origin link clicks, prevents the default navigation, pushes the new URL into the browser history, and loads the content.
- The `popstate` listener handles back/forward button presses.
- On initial load, `loadPage(location.pathname)` renders the correct content for any URL — including direct navigation and browser refreshes.

## Page Fragments

Each file inside `pages/` is a plain HTML fragment — just the content, no `<html>` or `<body>` wrapper needed:

```html
<!-- pages/about.html -->
<h1>About</h1>
<p>This is an example single-page application powered by Kempo-Server.</p>
```

## Running the SPA

Add a script to your `package.json`:

```json
{
  "scripts": {
    "spa": "kempo-server --root ./spa"
  }
}
```

Then run:

```bash
npm run spa
```

The server starts on `http://localhost:3000` by default. All `.html` URLs load `app.html` and client-side routing takes over from there.
