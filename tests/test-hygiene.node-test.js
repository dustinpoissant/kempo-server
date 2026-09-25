import {readdir, readFile} from 'fs/promises';
import path from 'path';
import {fileURLToPath} from 'url';

const testsDir = path.dirname(fileURLToPath(import.meta.url));

/*
  The harness keeps whichever of pass() / fail() was called last. A `return fail(...)` from inside a nested
  callback (withTestDir, a promise executor, a helper) only leaves that callback, so the test carries on to
  its trailing pass() and reports success for a failed check. Throwing instead always stops the test.
  This once hid five genuinely failing tests across the suite for months.
*/
const FORBIDDEN = new RegExp('\\breturn fail' + '\\(');

export default {
  'no test reports a failure with return fail()': async ({pass}) => {
    const files = (await readdir(testsDir)).filter(f => f.endsWith('.node-test.js') && f !== 'test-hygiene.node-test.js');
    const offenders = [];

    for(const file of files){
      const lines = (await readFile(path.join(testsDir, file), 'utf8')).split('\n');
      lines.forEach((line, index) => {
        if(FORBIDDEN.test(line)) offenders.push(`${file}:${index + 1}`);
      });
    }

    if(offenders.length){
      throw new Error(`use "throw new Error(message)" instead of "return fail(message)" (it can be masked by a later pass()): ${offenders.slice(0, 8).join(', ')}${offenders.length > 8 ? ` and ${offenders.length - 8} more` : ''}`);
    }
    pass('failures throw');
  }
};
