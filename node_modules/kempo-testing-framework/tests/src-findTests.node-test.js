import findTests from '../src/findTests.js';

export default {
  'finds node and browser test files with no filters': async ({ pass, fail, log }) => {
    try {
      const { nodeTests, browserTests } = await findTests('', '', true, true);
    log(`Found node tests: ${nodeTests.length}, browser tests: ${browserTests.length}`);
      const hasCounter = browserTests.some(f => f.endsWith('tests/counter.browser-test.js'));
      const hasExample = nodeTests.some(f => f.endsWith('tests/example.node-test.js'));
    if (hasCounter && hasExample) pass('Discovered expected canonical files (counter + example)');
    else fail(`Missing expected files. node: ${JSON.stringify(nodeTests)}, browser: ${JSON.stringify(browserTests)}`);
    } catch (e) {
      fail(e.stack || String(e));
    }
  },
  'honors suite filter for file substring': async ({ pass, fail, log }) => {
    try {
      const { nodeTests, browserTests } = await findTests('counter', '', true, true);
    log(`Filtered node tests: ${nodeTests.join(', ')}`);
    log(`Filtered browser tests: ${browserTests.join(', ')}`);
      const okNode = nodeTests.every(f => f.includes('counter') === true) || nodeTests.length === 0;
      const okBrowser = browserTests.every(f => f.includes('counter') === true);
    okNode && okBrowser ? pass('Suite filter correctly applied to file names') : fail(`Unexpected filtering. node: ${nodeTests}, browser: ${browserTests}`);
    } catch (e) {
      fail(e.stack || String(e));
    }
  },
  'respects environment toggles': async ({ pass, fail, log }) => {
    try {
      const a = await findTests('', '', false, true); // node only
      const b = await findTests('', '', true, false); // browser only
    log(`Node-only counts: node=${a.nodeTests.length}, browser=${a.browserTests.length}`);
    log(`Browser-only counts: node=${b.nodeTests.length}, browser=${b.browserTests.length}`);
      const okA = a.browserTests.length === 0 && a.nodeTests.length > 0;
      const okB = b.nodeTests.length === 0 && b.browserTests.length > 0;
    okA && okB ? pass('Environment toggles respected (node-only / browser-only)') : fail(`Env mismatch: a=${JSON.stringify(a)}, b=${JSON.stringify(b)}`);
    } catch (e) {
      fail(e.stack || String(e));
    }
  }
};
