# Test Server Root

This directory contains the persistent test server structure used by unit tests instead of creating temporary files for each test run. Tests use `withTestDir()` to get a temporary copy of this structure, maintaining isolation while providing consistent base files.

## Directory Structure

```
test-server-root/
├── README.md                              # This file
├── .config.json                           # Basic config with middleware settings
├── index.html                             # Basic home page: "<h1>Home</h1>"
├── late.html                              # For rescan tests: "later"
├── hello.html                             # For CLI tests: "hello world"
├── a.txt                                  # Test file: "A"
├── b/
│   └── 1.txt                              # Test file: "B1"
├── api/
│   ├── GET.js                             # Route handler returning {ok:true, params}
│   └── no-default.js                      # Route file without default export
├── src/
│   ├── file.js                            # Content: "single level"
│   ├── file.txt                           # Content: "custom"
│   ├── nested/
│   │   └── file.js                        # Content: "nested level"
│   ├── components/
│   │   └── Button.js                      # Content: "export default Button"
│   ├── utils/
│   │   └── helpers/
│   │       └── format.js                  # Content: "export const format = () => {}"
│   └── deep/
│       └── nested/
│           └── folder/
│               └── file.js                # Content: "export const deep = true"
├── docs/
│   ├── .config.json                       # Config with custom routes to ../src/**
│   ├── api/
│   │   └── data.json                      # Content: {"source": "static"}
│   └── src/
│       ├── nested/
│       │   └── file.js                    # Content: "fallback file"
│       ├── components/
│       │   └── Button.js                  # Content: "WRONG FILE"
│       └── utils/
│           └── helpers/
│               └── format.js              # Content: "WRONG FILE"
├── custom/
│   └── data.json                          # Content: {"source": "custom"}
└── public/
    └── src/
        └── file.txt                       # Content: "static"
```

## Configuration Files

### Root .config.json
Basic configuration for middleware testing:
```json
{
  "middleware": {
    "cors": {}
  }
}
```

### docs/.config.json
Configuration for wildcard routing tests:
```json
{
  "customRoutes": {
    "/src/*": "../src/$1"
  },
  "routePreference": "customRoute"
}
```

## Usage in Tests

### Simple Tests
Use `withTestDir()` for tests that can leverage the existing structure:

```javascript
await withTestDir(async (dir) => {
  // dir contains a copy of all the above files
  // Use existing files or create additional ones as needed
  const handler = await router({root: dir}, log);
  // ... test the handler
});
```

### Subdirectory Tests
Use the `subdir` option to work within a specific folder:

```javascript
await withTestDir(async (dir) => {
  // dir points to test-server-root/docs/
  process.chdir(dir);
  const handler = await router({root: '.'}, log);
  // ... test from docs folder perspective
}, {subdir: 'docs'});
```

### Complex Tests
For tests requiring very specific or complex structures, continue using `withTempDir()`:

```javascript
await withTempDir(async (dir) => {
  await write(dir, 'very/specific/structure.js', 'content');
  // ... custom test setup
});
```

## Benefits

1. **Consistency** - All tests start with the same base structure
2. **Speed** - No need to recreate common files for each test
3. **Maintainability** - Centralized test file management  
4. **Documentation** - Clear visibility of what test files exist
5. **Isolation** - Each test still gets its own temporary copy
