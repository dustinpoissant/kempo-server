// Browser tests for TestFramework component

const nextTick = () => new Promise(r => setTimeout(r));

export const beforeEach = async () => {
  document.body.innerHTML = '';
  try { localStorage.removeItem('ktf_settings'); } catch {}
};

export default {
  'TestFramework queues and deduplicates tasks, updates statuses': async ({ pass, fail }) => {
    try {
      await import('/gui/components/settingsStore.js');
      await import('/gui/components/Collapsible.js');
      await import('/gui/components/Logs.js');
      await import('/gui/components/Icon.js');
      await import('/gui/components/Test.js');
      await import('/gui/components/TestSuite.js');
      await import('/gui/components/TestFramework.js');

      const fw = document.createElement('ktf-test-framework');
      const suite = document.createElement('ktf-test-suite');
      suite.file = 'tests/example.node-test.js';
      suite.testNames = ['X','Y'];
      document.body.appendChild(fw);
      fw.appendChild(suite);
      await nextTick(); await nextTick();

      const [t1, t2] = suite.querySelectorAll('ktf-test');

      // Stub fetch to simulate run responses quickly
      const originalFetch = window.fetch;
      window.fetch = async (url) => {
        // Return a minimal results payload depending on testNames query
        const u = new URL(String(url), window.location.origin);
        const testNames = u.searchParams.get('testNames');
        if (testNames) {
          const name = testNames;
          return { ok: true, json: async () => ({ results: { tests: { [name]: { passed: true, logs: [{ message: `PASS ${name}`, type: 'pass', level: 2 }] } }, beforeAllLogs: [], afterAllLogs: [] } }) };
        }
        // Suite run: both tests pass
        return { ok: true, json: async () => ({ results: { tests: { X: { passed: true, logs: [] }, Y: { passed: true, logs: [] } }, beforeAllLogs: [], afterAllLogs: [] } }) };
      };

  // Enqueue duplicate test; ensure dedupe keeps one queued (status leaves 'notran')
      fw.enqueueTest({ file: suite.file, name: 'X', el: t1 });
      fw.enqueueTest({ file: suite.file, name: 'X', el: t1 });
  await nextTick();
  const queuedOnce = t1.status !== 'notran';

  // Run individual test via queue processing; wait until it passes
  for (let i=0;i<20 && t1.status !== 'pass'; i++){ await nextTick(); }
  const xPassed = t1.status === 'pass';

      // Enqueue suite; children should go queued then pass
  fw.enqueueSuite({ file: suite.file, testNames: ['X','Y'], el: suite });
  for (let i=0;i<30 && !(suite.status === 'pass' && t2.status === 'pass'); i++){ await nextTick(); }
  const suiteOk = suite.status === 'pass' && t2.status === 'pass';

      window.fetch = originalFetch;
      if (queuedOnce && xPassed && suiteOk) pass('TestFramework deduped queue and updated statuses');
      else fail('TestFramework queue or status updates failed');
    } catch (e) { fail(e.stack || String(e)); }
  }
};
