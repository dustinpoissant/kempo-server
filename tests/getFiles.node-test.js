import getFiles from '../src/getFiles.js';
import defaultConfig from '../src/defaultConfig.js';
import path from 'path';
import {withTempDir, write, log} from './test-utils.js';

export default {
  'scans directories recursively and filters by mime and disallowed': async ({pass, fail}) => {
    await withTempDir(async (dir) => {
      const cfg = JSON.parse(JSON.stringify(defaultConfig));
      await write(dir, 'index.html', '<!doctype html>');
      await write(dir, '.env', 'SECRET=1');
      await write(dir, 'notes.xyz', 'unknown');
      await write(dir, 'sub/app.js', 'console.log(1)');
      const files = await getFiles(dir, cfg, log);
      const rel = files.map(f => path.relative(dir, f).replace(/\\/g, '/'));
      
      if(!rel.includes('index.html')) return fail('includes html');
      if(!rel.includes('sub/app.js')) return fail('includes js');
      if(rel.includes('.env')) return fail('excludes disallowed');
      if(rel.includes('notes.xyz')) return fail('excludes unknown ext');
    });
    
    pass('scan and filter');
  }
};
