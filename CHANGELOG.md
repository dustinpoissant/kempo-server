# Changelog

All notable changes to `kempo-server` are documented in this file.

## [Unreleased]

### Added
- **Templates can extend one another: `<template extends="name">`.** A template was either a complete standalone document or nothing, so anything wanting a site's chrome plus its own wrapper had to *copy* that chrome. A copy is a snapshot — it stops matching the original the moment the original is edited, silently, with nothing to signal the drift, and no amount of regenerating-on-change closes it because a developer editing the file in an editor triggers nothing at all.

  A template may now wrap itself in `<template extends="name">` and fill the parent's `<location>` tags with its own `<content>` blocks — the same relationship a page already has with a template, one level up. What makes it useful is that a `<location>` inside the child's own content survives composition, so a child can *wrap* the page rather than replace it:

  ```
  parent    <body><nav /><location /></body>
  child     <content><article><location /></article></content>
  composed  <body><nav /><article><location /></article></body>
  rendered  <body><nav /><article>…page body…</article></body>
  ```

  A child may fill any number of the parent's named locations; slots it does not fill stay open for the page and for global content. Chains nest to `maxFragmentDepth`, and a cycle (including a template extending itself) throws rather than hanging. A template with no `<template>` wrapper is a complete document and renders exactly as before, which is every template written until now.

- **Selector-based patching of a parent template.** `<content location="…">` only reaches places the parent chose to mark. A child can now also target *any* element by CSS selector — the `<title>` a site never wrapped, a class on `<body>`, an insertion after some `<h1>` — via `<replace>`, `<inner>`, `<before>`, `<after>`, `<prepend>`, `<append>`, `<remove>` and `<attr>` (whose `add-class` / `remove-class` adjust the class list without restating what is already there).

  Selectors cover `tag`, `#id`, `.class`, `[attr]`, `[attr="value"]` (plus `~= ^= $= *= |=`), `*`, and the descendant and child combinators. Anything outside that subset throws when parsed, and **a selector that matches nothing is an error** — patches are coupled to markup the parent never promised to keep, so failing loudly is the point.

  Implemented without adding a dependency, and deliberately not with an HTML parser: parsers perform tree construction — relocating elements, inserting implied tags, closing what they think is unclosed — and a template is not HTML but a partial document full of `<location />`, `<if>`, `<foreach>` and `{{vars}}` that such a parser is entitled to rearrange. Elements are instead *located*, and every edit is a splice of the original text, so anything not explicitly targeted survives byte for byte.
- **`extraFragmentDirs` on `renderExternalPage(pageFilePath, rootDir, resolveDir, globals, state, maxDepth, extraGlobalDirs, extraFragmentDirs)`.** `extraGlobalDirs` (3.3.0) let a package outside `rootDir` *push* content into a host's render; there was no pull-side equivalent, so a package could never *supply* a fragment the host asks for by name, nor override one the host already has. Fragments were resolved by a single walk up from `resolveDir` to `rootDir` and nothing else. Directories listed here are now searched recursively for `*.fragment.html` in addition to that walk-up.

  Because a `<fragment>` tag inserts exactly one thing, same-named files from different sources compete rather than merge, and a fragment file's own `<fragment>` wrapper may carry a **`priority`** (higher wins, default `0`) to say how hard it competes. Resolution: the walk-up runs unchanged and yields at most one candidate — the nearest match — then each extra directory contributes at most one more; the highest priority wins; a tie keeps the site's own file, and a tie between two extra directories keeps whichever was listed first. Extra directories compete on priority alone, never on proximity, since they sit outside the directory chain. If no source has the fragment, the calling tag's inline fallback renders as before. Directories that do not exist are skipped, since a package shipping no fragments is the common case.

  **Nothing changes for existing callers.** `extraFragmentDirs` defaults to `[]`, and with no extra directories a fragment resolves through exactly the path it always did — including the "a more specific copy shadows a more general one" behaviour that walk-up exists for. The `priority` attribute is optional and absent means `0`, so every fragment file written before this release keeps its current behaviour.

### Fixed
- **`<fragment>` tags inside a page's `<content>` block are now resolved.** Fragments were only ever resolved in templates: `resolveFragmentTags` ran against the template, and page content was injected afterwards by `replaceLocations`, so a `<fragment name="…">` written in a page was never looked up. It did not error — the raw tag and its fallback content were emitted into the HTML, where the browser silently dropped the unknown element and rendered the fallback, which reads as "the fragment could not be found" rather than "pages cannot do this".

  This was an asymmetry rather than a deliberate limit: `<location>` tags inside page content were already being filled, on the line directly above. Page content blocks now get both passes, in the same order a template does — fragments resolved, then locations filled. A page can therefore ask for a fragment by name, which is the whole point of the pull model and something only templates could do before.

  Pages that already contained a `<fragment>` tag were emitting broken markup, so anything that changes here was not working to begin with. `maxFragmentDepth` applies to page content exactly as it does to templates.
- **`extraGlobalDirs` is now documented on `renderExternalPage`'s parameter table in the templating docs.** It shipped in 3.3.0 and was described in the README, but the docs site's parameter table stopped at `maxDepth`, so the argument looked like it did not exist.

## [3.3.0] - 2026-08-25

> **Why 3.3.0 and not another patch.** Everything below shipped across the 3.2.x line, but adding a
> public export (`kempo-server/serve-static-file`) is a minor change, not a patch — so the version
> number never reflected what was actually new. Consumers that legitimately need that export
> (`kempo` for `route:unmatched` file streaming, and the `kempo-files` / `kempo-thumbs` extensions
> built on it) had all declared `>=3.3.0` against a version that did not exist, leaving the peer
> unsatisfiable. This release carries the same code under the number those consumers were already
> asking for.

### Changed
- **`maxBodySize` now defaults to 500 MB** (was 1 MB), so file uploads work without per-site configuration. Note that request bodies are buffered in memory in full before routing, which makes this the per-request memory ceiling for *every* URL — including ones that match no route and require no authentication — so worst-case memory use is roughly `maxBodySize` × requests in flight. Sites that do not accept large uploads should lower it, and a reverse proxy (nginx's `client_max_body_size`) is a good place to cap it before a body ever reaches Node. See CONFIG.md.

### Added
- **`serveStaticFile` is now a public export (`kempo-server/serve-static-file`), and takes optional response overrides.** It was already the single implementation of `Range`/`206` handling shared by `serveFile.js` and `router.js`, but nothing outside the package could reach it, so anything serving a file from outside the static file scan — an extension streaming a download it gates behind permissions, for instance — had to reimplement range parsing and get it right independently. A sixth `overrides` argument lets such a caller keep this exact behavior while deciding its own headers: `contentType` replaces the MIME derived from the file extension, and `headers` are merged into the `200`, `206` and `416` responses. Range metadata (`Content-Range`, `Accept-Ranges`, `Content-Length`) is applied after the merge and so cannot be clobbered by a caller. `log` is now optional, and `allowedMimes` is only consulted when `contentType` is not overridden, so a caller supplying its own content type needs neither. Existing calls are unaffected.
- **`allowedMimes` entries for 3D models and archives** — `.glb`, `.gltf`, `.obj`, `.fbx` and `.zip`. These previously fell through to `application/octet-stream`, and adding them means such files are served with a correct `Content-Type` and, being binary, pick up the `Range` support described below.
- **`extraGlobalDirs` on `renderExternalPage(pageFilePath, rootDir, resolveDir, globals, state, maxDepth, extraGlobalDirs)`.** Global content was only ever collected by walking `rootDir`, so a host rendering pages rooted at its own directory had no way to let a package elsewhere contribute a `*.global.html`. The only workaround was for that package to write files into the host's directory at install time, which breaks the moment that directory is build output. Directories listed here are scanned in addition to `rootDir`; entries from all of them are merged and each entry's `priority` still orders it within its `location`. Directories that do not exist are skipped, since a package shipping no globals is the common case.

### Fixed
- **Binary request bodies are no longer corrupted.** Incoming bodies were accumulated with `body += chunk.toString()`, which decodes each chunk as UTF-8. That destroyed binary uploads two separate ways, both silent: any byte that is not valid UTF-8 was replaced with U+FFFD, and a multi-byte character split across two stream chunks was decoded independently on each side of the split. Neither is reversible — re-encoding the resulting string does not recover the original bytes — so an uploaded image or `multipart/form-data` body arrived mangled and, because replacement characters are three bytes each, often larger than it was sent. Bodies are now accumulated as `Buffer`s and only decoded where text is actually wanted. `request.body` and `request.text()` are unchanged for text content types; **`await request.buffer()` is now the correct way to read a binary body**, and returns the bytes exactly as they arrived.
- **`parseBody` decodes explicitly instead of relying on coercion.** `new URLSearchParams(buffer)` does not stringify a `Buffer` — it iterates it as bytes and throws `ERR_INVALID_TUPLE` — so the form-urlencoded branch would have broken every HTML form post once bodies became Buffers. Both the JSON and urlencoded branches now decode to UTF-8 first, and the empty-body check tests `length` rather than truthiness, since an empty `Buffer` is truthy where an empty string was not.
- **`readRawBody()` enforces a size limit.** It read an incoming stream with no ceiling at all, while the router's own read was bounded by `maxBodySize`. It now takes an optional limit (defaulting to 1 MB), and the router and `serveFile` pass the configured `maxBodySize` so a raised limit applies consistently.
- **`CATCH.page.html` now resolves `{{pathToRoot}}` from the requested URL** rather than from the directory the CATCH file happens to live in, so relative links in a nested 404 point at the right place.
- **Config paths are documented correctly.** The README stated that relative paths inside the config resolve against the config file's location; they actually resolve against the server root (`--root`). The two coincide whenever the config lives inside the root, which is why this went unnoticed.
- **HTTP Range (`206 Partial Content`) support for binary static files.** Previously every static file was read into memory in full and sent back with a flat `200`, even when the client sent a `Range` header. This made it impossible for browsers to seek inside large media files (e.g. `<video>`/`<audio>` scrubbing), since seeking depends on the server honoring byte-range requests. Binary files (anything whose MIME config isn't `utf8`-encoded — images, video, audio, fonts, etc.) now advertise `Accept-Ranges: bytes` and respond to `Range: bytes=...` requests (including open-ended `start-` and suffix `-N` forms) with `206 Partial Content` and the requested slice, streamed via `fs.createReadStream` instead of buffered into memory. Unsatisfiable ranges return `416 Range Not Satisfiable`. Text files are unaffected and continue to be served in full.
- **Custom and wildcard routes (`customRoutes` in config) now get the same Range support.** `router.js` had its own separate static-file-serving implementation for files resolved through `customRoutes`/wildcard routes, which duplicated (and had silently diverged from) the logic in `serveFile.js`. Both now share a single `serveStaticFile` helper, so a video served via a custom route (e.g. `{ "media/**": "../media/**" }`) seeks correctly too.

## [3.1.0] - 2026-04-19

### Added
- **`rootPath` injected into custom middleware config.** When the server loads custom middleware, it now merges `rootPath` (the absolute path to the server root directory) into the config object passed to each middleware factory. Previously middleware received only the raw `middleware` config section; now it receives `{ ...middlewareConfig, rootPath }`. This allows middleware to resolve files relative to the project root without hardcoding paths.

## [3.0.12] - 2026-04-17

### Added
- **`renderExternalPage(pageFilePath, rootDir, resolveDir, globals, state, maxDepth)`** exported from `kempo-server/templating`. Identical pipeline to `renderPage` but decouples the page file's physical location from where templates and fragments are resolved. `resolveDir` (a path within `rootDir`) drives template/fragment walk-up and `pathToRoot` calculation, allowing page files that live outside `rootDir` (e.g. in extension packages) to use the host project's templates. Internally `renderPage` now delegates to a shared `renderPageCore` with no change to its public signature or behavior.

## [3.0.11] - 2026-04-16

### Added

- **`renderPageToString(pagePath, vars, rootDir)`** exported from `kempo-server/templating`. Runs the full templating pipeline (template resolution, fragment injection, global content, `<if>`, `<foreach>`, `{{vars}}`) against a `.page.html` file and returns the final HTML string. Intended for programmatic use such as rendering emails.
---

## [3.0.0] - 2026-04-09

### Breaking Changes

- **Config file format changed from `.config.json` to `.config.js`.** The server now looks for `.config.js` (ES module with a default export) by default, with `.config.json` as a fallback.
- **Templating file extensions are now disallowed from being served.** Files ending in `.template.html`, `.fragment.html`, and `.page.html` are blocked by default via `disallowedRegex`.
- **`.config` disallowed pattern replaced** with more specific `.config.js` and `.config.json` patterns.

**Migration:**
```javascript
// Before (.config.json)
{ "port": 3000 }

// After (.config.js)
export default { port: 3000 };
```

### Added

- **Templating system** with support for templates (`.template.html`), pages (`.page.html`), and fragments (`.fragment.html`). Includes slot-based composition, nested fragment inclusion, and variable interpolation.
- `templating` config section with `preRender`, `ssr`, `ssrPriority`, `globals`, `state`, and `maxFragmentDepth` options.
- `kempo-server-render` CLI command for pre-rendering templated pages.
- `kempo-server/templating` module export.
- Wildcard route patterns now normalize leading slashes for consistent matching.

---

## [2.2.0] - 2026-04-08

### Added

- `rescan` utility module (`kempo-server/rescan`) that exposes a programmatic API to trigger file rescans. Provides `onRescan` for listening and a default export function that returns a promise resolving with the new file count.

---

## [2.1.1] - 2026-04-05

### Fixed

- Dynamic custom routes with `[param]` directory segments now resolve correctly. A new `walkDynamic` traversal walks the directory tree matching literal and `[param]` directories, passing extracted params through to route handlers.

---

## [2.1.0] - 2026-04-05

### Added

- Custom routes (`customRoutes`) now support file-based routing when the resolved path is a directory. The server looks for route files (`GET.js`, `POST.js`, etc.) and index files (`index.html`) inside directories, matching the same behavior as normal file-based routing.
- `httpRequest` test utility for making HTTP requests with arbitrary methods.

### Fixed

- Wildcard routes resolving to a directory no longer return `500 EISDIR`. The server now correctly resolves route files or index files within the directory.
- Exact custom routes pointing to a directory now resolve `index.html` correctly (e.g. `/admin` mapping to a directory containing `index.html`).

---

## [2.0.0] - 2026-04-04

### Breaking Changes

- **`request.body` is now a pre-parsed value instead of a function.** Previously, `request.body()` was an async function that returned the raw body string. Now `request.body` is a property that contains the parsed body (JSON object, form data object, or raw string depending on `Content-Type`).

**Migration:**
```javascript
// Before (1.x)
const raw = await request.body();
const data = JSON.parse(raw);

// After (2.0)
const data = request.body; // already parsed based on Content-Type
```

If you need the raw body string, use `await request.text()` or access `request._rawBody`.

### Added

- `maxBodySize` config option (default: 1MB). Requests exceeding this limit receive a `413 Payload Too Large` response.
- Request body is now buffered once at the start of the request lifecycle, making it available to both middleware and route handlers without double-consumption issues.

### Fixed

- Rescan double-wrap bug where the rescan path was incorrectly wrapping requests.

---

## [1.10.7] - 2026-03-21

### Added

- `llm.txt` file for LLM-friendly project documentation.

---

## [1.10.6] - 2026-03-12

### Added

- SPA (Single Page Application) example and documentation.

### Changed

- Updated CI workflows.
- Renamed `AGENTS.md` and updated testing framework.

---

## [1.10.3] - 2026-01-15

### Fixed

- Missing `cookies` property in the request wrapper. Cookie parsing now works correctly on all requests.

---

## [1.10.2] - 2026-01-14

### Fixed

- Middleware path resolution now correctly resolves relative middleware paths.
- Request and response wrappers are now properly passed through the middleware pipeline and into route handlers.

---

## [1.10.0] - 2026-01-08

### Breaking Changes

- **The `--rescan` CLI flag has been removed.** Rescanning is now controlled entirely by the `maxRescanAttempts` config option.

**Migration:**
```bash
# Before (1.9.x)
kempo-server --rescan

# After (1.10.0)
# Set in your config file:
# { "maxRescanAttempts": 3 }
# No CLI flag needed — rescanning is automatic based on config.
```

### Fixed

- `noRescanPaths` now correctly excludes well-known paths.
- `maxRescanAttempts` config now applies correctly.
- Various workflow and build fixes.

---

## [1.9.4] - 2026-01-07

### Security

- Default config now blocks `package.json` from being served, preventing exposure of dependency and project metadata.

**Action:** If you need to serve `package.json`, explicitly add it to your allowed paths.

---

## [1.9.2] - 2025-12-06

### Changed

- Removed the word "password" from the default banned regex pattern. This was causing false positives on legitimate routes/files containing the word "password" (e.g., password reset pages).

**Action:** If you relied on the default regex to block paths containing "password", add a custom rule to your config.

---

## [1.9.0] - 2025-10-25

### Added

- CLI utilities now support equals-separated values (e.g., `--port=3000`) and automatic boolean conversion.
- HTML documentation for CLI and file system utilities.

### Fixed

- Documentation markup fixes.

---

## [1.8.3] - 2025-10-24

### Added

- `encoding` response header is now automatically set on served files.

---

## [1.8.1] - 2025-10-24

### Added

- Config fallback system: user configs now merge with defaults so missing properties don't cause errors.

---

## [1.8.0] - 2025-10-24

### Added

- `encoding` config option to control the character encoding of served files (default: `utf-8`).

**Action:** If you were manually setting encoding headers in middleware, you can now use the config option instead.

---

## [1.7.13] - 2025-10-14

### Fixed

- Paths ending in `/` now correctly resolve to `index.html` (or the configured directory index).

---

## [1.7.8] - 2025-09-19

### Fixed

- Malformed URL parameters no longer crash the server. Invalid query strings are now handled gracefully.

---

## [1.7.5] - 2025-09-02

### Changed

- Internal: refactored unit tests to use a static `test-server-root` directory instead of temporary files.
- Cleaned up documentation and examples.

---

## [1.7.3] - 2025-08-28

### Fixed

- Wildcard bug in `customRoutes` matching where `**` patterns were not resolving correctly.

---

## [1.7.2] - 2025-08-28

### Added

- Config file path validation: relative paths in the config are now validated to stay within the server root directory. Absolute paths are still allowed.

### Fixed

- Custom route path resolution improved to handle edge cases.

---

## [1.7.1] - 2025-08-28

### Fixed

- Static files no longer take precedence over `customRoutes` config entries. Custom routes now correctly override static file matches.

**Action:** If you relied on static files shadowing custom routes, be aware that custom routes now take priority.

---

## [1.7.0] - 2025-08-28

### Added

- **Module caching** for the file router. Dynamically imported route modules are now cached, significantly improving performance for repeated requests.
- Cache can be configured via the `cache` config section (`enabled`, `maxSize`).

---

## [1.6.0] - 2025-08-28

### Added

- **`**` (double asterisk) wildcard support** in custom routes. Matches any number of path segments.

```json
{
  "customRoutes": {
    "/docs/**": "./docs-handler.js"
  }
}
```

**Action:** If you have custom routes with literal `**` in the path, they will now be interpreted as wildcards.

---

## [1.5.1] - 2025-08-28

### Changed

- Restructured repository to use `src/` and `dist/` directories.
- Docs now use `kempo.min.css` instead of `essential.css`.

### Added

- Node.js utility modules (`cli.js`, `fs-utils.js`).

**Action:** If you were importing internal modules directly, paths have changed from root to `dist/`.

---

## [1.4.7] - 2025-08-26

### Added

- **`--config` CLI flag** to specify a custom config file path.

```bash
kempo-server --config ./my-config.json
```

---

## [1.4.6] - 2025-08-22

### Added

- GitHub Actions workflow for automated publishing to NPM.

---

## [1.4.5] - 2025-08-19

### Added

- Comprehensive unit test suite.

---

## [1.0.0] - 2025-07-09

### Initial Release

- File-based routing server with zero dependencies.
- Dynamic route parameters via `[param]` directory/file naming.
- HTTP method-based route handlers (`GET.js`, `POST.js`, etc.).
- Request wrapper with Express-like API (`request.query`, `request.params`, `request.body()`, `request.json()`).
- Response wrapper with convenience methods (`response.json()`, `response.send()`, `response.status()`).
- Wildcard (`*`) support in custom routes.
- MIME type detection and configurable overrides.
- Security defaults: blocked dotfiles, `node_modules`, and sensitive path patterns.
- Static file serving.
- Configurable via `.config.json`.
- Middleware support.
- CLI interface with `--root`, `--port`, `--verbose` flags.
