# Changelog

All notable changes to `kempo-server` are documented in this file.

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
