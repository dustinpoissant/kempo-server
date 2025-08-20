# Kempo Testing Framework

The Kempo Testing Framework is a simple testing framework built on these principles:

- **Test in the right environment:** Code should be tested in the environment it is written for. Code intended to be ran in the browser is tested in the browser; code intended to be ran in Node is tested in Node. And code intended to be ran in either should be tested in both.
- **No mocks, no shims:** Test the real thing, not a simulation.
- **Simplicity:** No custom syntax to learn. Just JavaScript functions and three helpers: `log`, `pass`, and `fail`.
- **Zero learning curve:** If you know JavaScript, you know how to write tests.

It can be run from a web GUI or from the command line.

This was originally built to test Kempo, but there is nothing Kempo specific about it, it could be used for any JavaScript project.

## Requirements

- Node.js version 14.8.0 or higher is required (for ES modules and top-level await support).
- Modern browsers for running browser tests.

If you are using an older version of Node.js, please upgrade to a supported version to use Kempo Testing Framework.

## Setup

Install `kempo-testing-framework` as a dependency in your project:

```bash
npm install kempo-testing-framework --save-dev
```

## Test Types

Kempo supports two types of tests that can coexist in the same test suite:

### Browser Tests
Tests that run directly in the browser environment. Best for:
- DOM manipulation
- Browser APIs
- UI components
- Client-side functionality

### Node Tests  
Tests that run on the server via API calls. Best for:
- Server-side logic
- File system operations
- Node-specific APIs
- Pure JavaScript functions

Each type of test (browser / node) should have its own test file, but both will run 

## Test File Naming

Kempo supports three types of test files:

- `[name].browser-test.js` — runs only in the browser
- `[name].node-test.js` — runs only in Node
- `[name].test.js` — runs in both environments

If your code is intended to run in both Node and the browser, you should write a single test file named `[name].test.js.`, otherwise use the environment specific file names `[name].browser-test.js` and/or `[name]node-test.js`.

## Writing Tests

### Lifecycle Callbacks
Test files can export the following optional lifecycle functions:

- **`beforeAll`** - Runs once before all tests (setup)
- **`afterAll`** - Runs once after all tests (cleanup)  
- **`beforeEach`** - Runs before each individual test
- **`afterEach`** - Runs after each individual test

**Note:** All test functions and lifecycle callbacks can be `async` functions if you need to await asynchronous operations.

## Example Test File

`[name].test.js`, `[name].browser-test.js`, or `[name].node-test.js`... they all should look exactly the same.

```javascript
// Import the thing to test
import yourModule from '../../src/yourModule.js';

/* Export the optional lifecycle callbacks */
export const beforeAll = async (log) => {
  log('Setting up Node test environment...');
}

export const beforeEach = async (log) => {
  log('Setting up Node test for each test')
}

export const beforeEach = async (log) => {
  log('Cleaning up Node test for each test')
}

export const afterAll = async (log) => {
  log('Cleaning up Node test environment...');
}

/* Export the Tests */
export default {
  'should handle basic functionality': async ({pass, fail, log}) => {
    const expected = 'abc123';
    const result = yourModule.someFunction();
    if (result === expected) {
      log('✓ Basic functionality works');
      pass('Test passed successfully')
    } else {
      fail(`Expected ${expected}, got ${result}`);
    }
  },
  'should validate input parameters': async ({pass, fail, log}) => {
    try {
      yourModule.someFunction(null);
      fail('Should have thrown an error for null input');
    } catch (error) {
      log('✓ Properly validates input');
      pass('Input validation test passed');
    }
  }
};
```


## Running Tests

### CLI (Command-Line Interface)
Run all tests using npx:
```bash
npx kempo-test
```

Run only the browser tests:
```bash
npx kempo-test -b
```

Run only the node tests:
```bash
npx kempo-test -n
```

### GUI (webpage)

Run the GUI interface:
```bash
npx kempo-test --gui
```

### Using npm Scripts (Optional)

You can add npm scripts to your `package.json` for convenience:

```json
{
  "scripts": {
    "tests": "npx kempo-test",
    "tests:gui": "npx kempo-test --gui",
    "tests:browser": "npx kempo-test -b",
    "tests:node": "npx kempo-test -n"
  }
}
```

Then run with:
```bash
npm run tests           # Run all tests
npm run tests:gui       # Start GUI
npm run tests:browser   # Run only browser tests
npm run tests:node      # Run only node tests
```

**Important:** npm scripts with npx don't reliably pass additional arguments. If you need to use flags like `--show-browser`, `--log-level`, or filters, use `npx kempo-test` directly instead of npm scripts.

## CLI Flags Reference

When running tests via the CLI, you can use various flags to control test execution and output. These flags only affect CLI execution and are ignored when using the GUI (`--gui` flag).

Note: For flags that take values, you can use either a space or equals: `--log-level verbose` or `--log-level=verbose`. Short flags also support equals for value flags: `-l verbose` or `-l=verbose`. Examples below use spaces for clarity.

### Environment Flags

**`-b` or `--browser`**
- Runs only browser tests (`.browser-test.js` files and `.test.js` files in browser environment)
- Example: `npx kempo-test -b`
- Example with filter: `npx kempo-test -b auth`

**`-n` or `--node`**  
- Runs only Node tests (`.node-test.js` files and `.test.js` files in Node environment)
- Example: `npx kempo-test -n`
- Example with filter: `npx kempo-test -n user`

### Log Level Flag

Set the verbosity of output:

**`-l` or `--log-level`**
- Accepts numeric 0–4 or names: `silent|minimal|normal|verbose|debug` (also `s|m|n|v|d`)
- Examples:
  - `npx kempo-test -l debug`
  - `npx kempo-test --log-level 3`
  - `npx kempo-test -l n`

### Server Configuration Flags

**`-p` or `--port`**
- Specify the port for the browser test server (default: 3000)
- Port must be between 1 and 65535
- Example: `npx kempo-test -b --port 8080`
- Example: `npx kempo-test -p 3001`

**`--show-browser` or `-w`**
- Show the browser window during browser tests (default: headless mode)
- Useful for debugging browser tests and seeing what's happening
- Example: `npx kempo-test -b --show-browser`
- Example: `npx kempo-test -b -w`

**`--delay` or `-d`**
- Specify a browser pause delay in milliseconds (applies before and after browser tests when the browser window is shown)
- Example: `npx kempo-test -b --show-browser --delay 2000`

### Combining Flags

You can combine multiple flags for precise control:

```bash
# Run only browser tests with verbose-like output using log level
npx kempo-test -b -l verbose auth

# Run only node tests with minimal output
npx kempo-test -n -l minimal user

# Run all tests silently with a specific filter
npx kempo-test -l silent payment

# Run browser tests with visible browser window, custom port and delay
npx kempo-test -b --show-browser --port 8080 --delay 2000
```

## Running Specific or Filtered Tests

Kempo supports two levels of filtering to help you run only the tests you need:

### File-Level Filtering

You can filter which test files to run by providing a partial filename (substring) as an argument. All test files whose names include the substring will be run. This works for both full and partial names, and matches anywhere in the filename (not just the start).

For example, if you have test files named `auth.browser-test.js`, `auth.node-test.js`, `user-auth.test.js`, and `payment.test.js`:

Run all tests with `auth` in the name (in both environments):
```bash
npx kempo-test auth
```

Run only the browser tests with `auth` in the name:
```bash
npx kempo-test -b auth
```

Run only the node tests with `auth` in the name:
```bash
npx kempo-test -n auth
```

### Individual Test Filtering

You can also filter individual tests within files by providing a second argument. This will find files matching the first filter, then within those files, run only tests whose names (object keys) contain the second filter.

Using the same example files, if your `auth.browser-test.js` contains tests like:
```javascript
export default {
  'should handle user login validation': async ({pass, fail, log}) => { /* ... */ },
  'should handle user logout process': async ({pass, fail, log}) => { /* ... */ },
  'should validate password requirements': async ({pass, fail, log}) => { /* ... */ }
};
```

Run only tests containing "login" in files containing "auth":
```bash
npx kempo-test auth login
```

Run only browser tests containing "logout" in files containing "auth":
```bash
npx kempo-test -b auth logout
```

Both file and test filtering are case-insensitive and use substring matching.

If you do not provide any filters, all test files will be auto-discovered and run.

### Help

Get usage instructions and see all available options:
```bash
npx kempo-test --help
```
