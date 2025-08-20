import getFiles from '../getFiles.js';
import defaultConfig from '../defaultConfig.js';
import path from 'path';
import {withTempDir, write, expect, log} from './test-utils.js';

export default {
  'scans directories recursively and filters by mime and disallowed': async ({pass, fail}) => {
    try {
      await withTempDir(async (dir) => {
        const cfg = JSON.parse(JSON.stringify(defaultConfig));
        await write(dir, 'index.html', '<!doctype html>');
        await write(dir, '.env', 'SECRET=1');
        await write(dir, 'notes.xyz', 'unknown');
        await write(dir, 'sub/app.js', 'console.log(1)');
  const files = await getFiles(dir, cfg, log);
  const rel = files.map(f => path.relative(dir, f).replace(/\\/g, '/'));
        expect(rel.includes('index.html'), 'includes html');
        expect(rel.includes('sub/app.js'), 'includes js');
  expect(!rel.includes('.env'), 'excludes disallowed');
        expect(!rel.includes('notes.xyz'), 'excludes unknown ext');
      });
      pass('scan and filter');
    } catch(e){ fail(e.message); }
  }
};
