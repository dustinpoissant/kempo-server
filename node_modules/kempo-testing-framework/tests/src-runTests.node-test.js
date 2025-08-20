import runTests from '../src/runTests.js';

const mkSuite = () => ({
  beforeAll: async (log) => { log('before all'); },
  beforeEach: async (log) => { log('before each'); },
  afterEach: async (log) => { log('after each'); },
  afterAll: async (log) => { log('after all'); },
  default: {
    'one passes': async ({ pass, log }) => { log('running one'); pass('ok'); },
    'two passes': async ({ pass, log }) => { log('running two'); pass('ok'); },
  }
});

export default {
  'runs all tests and records logs': async ({ pass, fail, log }) => {
    try {
      const res = await runTests(mkSuite(), false, 0);
      const names = Object.keys(res.tests);
    log(`Discovered tests: ${names.join(', ')}`);
    if (names.length !== 2) return fail(`Expected 2 tests, got ${names.length} [${names.join(', ')}]`);
      const hasBeforeAll = res.beforeAllLogs.some(l => l.message.includes('before all'));
      const hasAfterAll = res.afterAllLogs.some(l => l.message.includes('after all'));
      const eachs = Object.values(res.tests).flatMap(r => r.logs.map(l=>l.message));
      const hasBefores = eachs.some(m => m.includes('== Before Each =='));
      const hasAfters = eachs.some(m => m.includes('== After Each =='));
    log(`Lifecycle logs — beforeAll:${hasBeforeAll} afterAll:${hasAfterAll} beforeEach:${hasBefores} afterEach:${hasAfters}`);
    if (hasBeforeAll && hasAfterAll && hasBefores && hasAfters) pass('Recorded lifecycle and per-test logs as expected');
    else fail('Missing expected lifecycle log sections');
    } catch (e) {
      fail(e.stack || String(e));
    }
  },
  'applies per-test delay': async ({ pass, fail, log }) => {
    try {
      const t0 = Date.now();
      await runTests(mkSuite(), false, 200);
      const elapsed = Date.now() - t0;
    log(`Elapsed with delay: ${elapsed}ms`);
    if (elapsed >= 200 && elapsed < 800) pass(`Applied per-test delay successfully (~${elapsed}ms >= 200ms)`);
    else fail(`Unexpected timing with delay=200ms: ${elapsed}ms`);
    } catch (e) {
      fail(e.stack || String(e));
    }
  },
  'filters tests by substring': async ({ pass, fail, log }) => {
    try {
      const res = await runTests(mkSuite(), 'two', 0);
      const names = Object.keys(res.tests);
    log(`Filtered tests: ${names.join(', ')}`);
    if (names.length === 1 && names[0].includes('two')) pass(`Filtered to expected test: ${names[0]}`);
    else fail(`Unexpected filtered set: [${names.join(', ')}]`);
    } catch (e) {
      fail(e.stack || String(e));
    }
  }
};
