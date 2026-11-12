import http from 'http';
import {withTempDir} from './temp-dir.js';
import {write} from './file-writer.js';
import {randomPort} from './port.js';
import {httpGet} from './http.js';
import router from '../../src/router.js';

/*
  Runs a real server over a temporary site (`files` are written under public/, with `config` as its .config.json),
  requests `requestPath`, and hands the response and its body text to `check`.
*/
export const withSite = async (config, files, requestPath, check) => {
  await withTempDir(async dir => {
    await write(dir, 'public/.config.json', JSON.stringify(config));
    for(const [rel, content] of Object.entries(files)) await write(dir, `public/${rel}`, content);
    const prev = process.cwd();
    process.chdir(dir);
    try {
      const handler = await router({root: 'public', logging: 0}, () => {});
      const server = http.createServer(handler);
      const port = randomPort();
      await new Promise(r => server.listen(port, r));
      await new Promise(r => setTimeout(r, 30));
      try {
        const r = await httpGet(`http://localhost:${port}${requestPath}`);
        await check(r, r.body.toString());
      } finally {
        server.close();
      }
    } finally {
      process.chdir(prev);
    }
  });
};
