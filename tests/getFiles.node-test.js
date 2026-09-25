import getFiles from '../src/getFiles.js';
import defaultConfig from '../src/defaultConfig.js';
import path from 'path';
import {withTestDir} from './utils/test-dir.js';
import {write} from './utils/file-writer.js';
import {log} from './utils/logging.js';

export default {
  'scans directories recursively and filters by mime and disallowed': async ({pass, fail}) => {
    await withTestDir(async (dir) => {
      const cfg = JSON.parse(JSON.stringify(defaultConfig));
      // Create test-specific files for this test
      await write(dir, '.env', 'SECRET=1');
      await write(dir, 'notes.xyz', 'unknown');
      await write(dir, 'sub/app.js', 'console.log(1)');
      const files = await getFiles(dir, cfg, log);
      const rel = files.map(f => path.relative(dir, f).replace(/\\/g, '/'));
      
      if(!rel.includes('index.html')) throw new Error('includes html');
      if(!rel.includes('sub/app.js')) throw new Error('includes js');
      if(rel.includes('.env')) throw new Error('excludes disallowed');
      if(rel.includes('notes.xyz')) throw new Error('excludes unknown ext');
    });
    
    pass('scan and filter');
  }
};
