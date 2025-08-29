import router from '../src/router.js';
import http from 'http';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { randomPort, httpGet, withTempDir, write } from './test-utils.js';

/*
  This test verifies that a customRoute pointing outside the rootPath is served
  instead of a static file inside the rootPath, if both exist.
*/

export default {
  'customRoute outside rootPath takes precedence over static file': async ({pass, fail, log}) => {
    try {
  await withTempDir(async (dir) => {
        // Print initial working directory
        log('Initial process.cwd(): ' + process.cwd());

        // Setup: create static file in rootPath
        const rootDir = path.join(dir, 'public');
        await mkdir(path.join(rootDir, 'src'), { recursive: true });
        await writeFile(path.join(rootDir, 'src', 'file.txt'), 'static');
  // Create custom file outside rootPath, matching resolved customRoute
  const customFilePath = path.resolve(dir, '..', 'src', 'file.txt');
  await mkdir(path.dirname(customFilePath), { recursive: true });
  await writeFile(customFilePath, 'custom');
  log('Custom file path: ' + customFilePath);

        // Check file existence
        try {
          const { stat } = await import('fs/promises');
          await stat(customFilePath);
          log('Custom file exists at setup');
        } catch (e) {
          log('Custom file does NOT exist at setup');
        }

        // Write config with customRoute pointing outside rootPath
        const config = {
          customRoutes: {
            '/src/file.txt': '../src/file.txt'
          }
        };
        await writeFile(path.join(rootDir, '.config.json'), JSON.stringify(config));
        log('Config written: ' + JSON.stringify(config));

  // Set working directory to temp dir so relative paths resolve correctly
  const prevCwd = process.cwd();
  process.chdir(dir);
  const flags = { root: rootDir, logging: 4 };
  const logFn = (...args) => log(args.map(String).join(' '));
  log('Starting server with flags: ' + JSON.stringify(flags));
  log('process.cwd() before router: ' + process.cwd());
  const handler = await router(flags, logFn);
  const server = http.createServer(handler);
  const port = randomPort();
  await new Promise(r => server.listen(port, r));
  await new Promise(r => setTimeout(r, 50));

        try {
          // Print process.cwd() before request
          log('process.cwd() before request: ' + process.cwd());
          // Request the file
          const requestUrl = `http://localhost:${port}/src/file.txt`;
          log('Requesting URL: ' + requestUrl);
          const response = await httpGet(requestUrl);
          log('status: ' + response.res.statusCode);
          log('response body: ' + response.body.toString());
          if(response.res.statusCode !== 200) throw new Error('status not 200');
          if(response.body.toString() !== 'custom') throw new Error('did not serve customRoute file');
        } finally {
          server.close();
          process.chdir(prevCwd);
        }
      });
      pass('customRoute outside rootPath is served');
    } catch(e){
      fail(e.message);
    }
  }
};
