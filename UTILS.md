# Utility Modules

Kempo Server includes some utility modules that can be used in your own Node.js projects. These utilities are built and exported alongside the main server package.

> **Note:** These utilities are included here for convenience but may be moved to their own dedicated package in the future as more Node.js utilities are added.

## CLI Utilities

The CLI utilities provide simple command-line argument parsing functionality.

### Usage

```javascript
import { getArgs } from 'kempo-server/utils/cli';

// Basic usage - get all arguments as key-value pairs
const args = getArgs();
console.log(args); // { port: '3000', host: 'localhost', verbose: true }

// With mapping - map short flags to full names
const args = getArgs({
  'p': 'port',
  'h': 'host',
  'v': 'verbose'
});
console.log(args); // Maps -p to port, -h to host, -v to verbose
```

### Example

```bash
node myapp.js --port 8080 -h 127.0.0.1 --verbose
```

```javascript
import { getArgs } from 'kempo-server/utils/cli';

const args = getArgs({
  'h': 'host',
  'p': 'port',
  'v': 'verbose'
});

// Results in:
// {
//   host: '127.0.0.1',
//   port: '8080', 
//   verbose: true
// }
```

## File System Utilities

The file system utilities provide common file and directory operations with Promise-based APIs.

### Usage

```javascript
import { ensureDir, copyDir } from 'kempo-server/utils/fs-utils';

// Ensure a directory exists (creates all parent directories if needed)
await ensureDir('./my/nested/directory');

// Copy an entire directory structure recursively
await copyDir('./source', './destination');
```

### Functions

#### `ensureDir(dirPath)`

Ensures that a directory exists, creating it and any necessary parent directories if they don't exist. Similar to `mkdir -p`.

- **Parameters:**
  - `dirPath` (string) - The directory path to ensure exists
- **Returns:** Promise that resolves when the directory is confirmed to exist

#### `copyDir(srcPath, destPath)`

Recursively copies an entire directory structure from source to destination.

- **Parameters:**
  - `srcPath` (string) - The source directory to copy from
  - `destPath` (string) - The destination directory to copy to
- **Returns:** Promise that resolves when the copy operation is complete

### Example Use Cases

```javascript
import { ensureDir, copyDir } from 'kempo-server/utils/fs-utils';

// Build script example
async function buildProject() {
  // Ensure build directories exist
  await ensureDir('./dist/assets');
  await ensureDir('./dist/components');
  
  // Copy static assets
  await copyDir('./src/assets', './dist/assets');
  await copyDir('./src/public', './dist');
}

// Backup script example
async function backupProject() {
  const timestamp = new Date().toISOString().slice(0, 10);
  const backupPath = `./backups/${timestamp}`;
  
  await ensureDir(backupPath);
  await copyDir('./src', `${backupPath}/src`);
  await copyDir('./config', `${backupPath}/config`);
}
```

## Rescan

The rescan utility lets you programmatically trigger a file rescan on the running server without restarting. This is useful when files are created or removed at runtime, such as a CMS generating static HTML pages.

### Usage

```javascript
import rescan from 'kempo-server/rescan';

const fileCount = await rescan();
console.log(`Server now serving ${fileCount} files`);
```

The function returns a promise that resolves with the total number of files found in the new scan. It works from anywhere in the same Node process as the server — route handlers, middleware, scheduled tasks, file watchers, or any other code.

### Example: CMS Page Generation

```javascript
import { writeFile } from 'fs/promises';
import rescan from 'kempo-server/rescan';

async function publishPage(theme, template, content, slug) {
  const html = buildPage(theme, template, content);
  await writeFile(`./public/${slug}.html`, html);
  await rescan();
  // Page is immediately available at /{slug}
}
```

### Example: File Watcher

```javascript
import { watch } from 'fs';
import rescan from 'kempo-server/rescan';

watch('./content', { recursive: true }, () => rescan());
```

## Installation and Build

These utilities are automatically built when you install kempo-server. They're available through the package's exports:

```json
{
  "exports": {
    "./rescan": "./dist/rescan.js",
    "./utils/cli": "./dist/utils/cli.js",
    "./utils/fs-utils": "./dist/utils/fs-utils.js"
  }
}
```

The utilities are ES modules and require Node.js environments that support ES module imports.
