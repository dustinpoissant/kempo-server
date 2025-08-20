import runBrowserTests from '../src/runBrowserTests.js';

export default {
  'runs a specific browser test headless and returns results': async ({ pass, fail, log }) => {
    try {
      const res = await runBrowserTests({
        testFile: 'tests/counter.browser-test.js',
        filter: '',
        showBrowser: false,
        port: 3111,
        logLevel: 2,
        delayMs: 0
      });
      const names = Object.keys(res.tests || {});
    log(`Ran browser tests: ${names.join(', ')}`);
    if (names.length >= 3 && res.beforeAllLogs?.length >= 1 && res.afterAllLogs?.length >= 1) pass('Headless run produced tests and lifecycle logs');
    else fail(`Unexpected browser test results: ${JSON.stringify(res)}`);
    } catch (e) {
      fail(e.stack || String(e));
    }
  },
  'applies pre/post delay only when showBrowser is true': async ({ pass, fail, log }) => {
    try {
      // Use a single test to avoid between-test delays dominating timings
      const filter = 'Counter component should be defined';
      const delay = 500; // Reduced from 1000ms to avoid timeouts
      const start1 = Date.now();
      await runBrowserTests({ testFile: 'tests/counter.browser-test.js', filter, showBrowser: false, port: 3112, logLevel: 2, delayMs: delay });
      const t1 = Date.now() - start1;
      const start2 = Date.now();
      await runBrowserTests({ testFile: 'tests/counter.browser-test.js', filter, showBrowser: true, port: 3113, logLevel: 2, delayMs: delay });
      const t2 = Date.now() - start2;
      // Headful should incur roughly +1000ms (pre+post). Allow slack for env variance.
      log(`Timing — headless=${t1}ms, headful=${t2}ms, delta=${t2 - t1}ms`);
      if (t2 - t1 >= 800) pass('Headful mode applied pre/post delay as expected');
      else fail(`Timing not increased as expected: headless=${t1}ms headful=${t2}ms`);
    } catch (e) {
      fail(e.stack || String(e));
    }
  }
};
