import runTestFiles from '../src/runTestFiles.js';

export default {
  'discovers and runs node tests only when requested': async ({ pass, fail, log }) => {
    try {
      const { nodeResults, browserResults } = await runTestFiles({
        suiteFilter: 'example',
        testFilter: '',
        shouldRunBrowser: false,
        shouldRunNode: true,
        showBrowser: false,
        port: 3000,
        logLevel: 2
      });
    log(`Node files run: ${Object.keys(nodeResults).length}, browser files run: ${Object.keys(browserResults).length}`);
      const onlyNode = Object.keys(browserResults).length === 0 && Object.keys(nodeResults).length >= 1;
    onlyNode ? pass('Ran node tests only when requested (browser skipped)') : fail(`Unexpected results: node=${Object.keys(nodeResults)}, browser=${Object.keys(browserResults)}`);
    } catch (e) {
      fail(e.stack || String(e));
    }
  },
  'passes filter into node runs': async ({ pass, fail, log }) => {
    try {
      const { nodeResults } = await runTestFiles({
        suiteFilter: 'example',
        testFilter: 'async',
        shouldRunBrowser: false,
        shouldRunNode: true,
        showBrowser: false,
        port: 3000,
        logLevel: 2
      });
      const [file, res] = Object.entries(nodeResults)[0];
    if (!res) return fail('No node results returned');
      const names = Object.keys(res.tests || {});
    log(`Filtered test names: ${names.join(', ')}`);
    names.length === 1 && names[0].toLowerCase().includes('async') ? pass('Per-file test filter applied to node run') : fail(`Unexpected filtered tests: ${names}`);
    } catch (e) {
      fail(e.stack || String(e));
    }
  }
};
