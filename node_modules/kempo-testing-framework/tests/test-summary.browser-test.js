// Browser tests for TestSummary component

const nextTick = () => new Promise(r => setTimeout(r));

export const beforeEach = async () => {
  document.body.innerHTML = '';
  try { localStorage.removeItem('ktf_settings'); } catch {}
};

export default {
  'TestSummary initializes counts from child suites and tests': async ({ pass, fail }) => {
    try {
      await import('/gui/components/settingsStore.js');
      await import('/gui/components/Collapsible.js');
      await import('/gui/components/Logs.js');
      await import('/gui/components/Icon.js');
      await import('/gui/components/Test.js');
      await import('/gui/components/TestSuite.js');
      await import('/gui/components/TestSummary.js');
      await import('/gui/components/TestFramework.js');

      const fw = document.createElement('ktf-test-framework');
      const summary = document.createElement('ktf-test-summary');
      const suite = document.createElement('ktf-test-suite');
      suite.file = 'tests/example.node-test.js';
      suite.testNames = ['A','B'];
      fw.appendChild(summary);
      fw.appendChild(suite);
      document.body.appendChild(fw);
      await nextTick(); await nextTick();

      const text = summary.shadowRoot.textContent.replace(/\s+/g,' ');
      const filesTotal = /Files[\s\S]*Total:\s*1/.test(text);
      const testsTotal = /Tests[\s\S]*Total:\s*2/.test(text);
      if (filesTotal && testsTotal) pass('TestSummary counted files and tests on init'); else fail(`Counts missing:\n${text}`);
    } catch (e) { fail(e.stack || String(e)); }
  },

  'TestSummary updates status, counts, and queue length': async ({ pass, fail }) => {
    try {
      await import('/gui/components/settingsStore.js');
      await import('/gui/components/Collapsible.js');
      await import('/gui/components/Logs.js');
      await import('/gui/components/Icon.js');
      await import('/gui/components/Test.js');
      await import('/gui/components/TestSuite.js');
      await import('/gui/components/TestSummary.js');
      await import('/gui/components/TestFramework.js');

      const fw = document.createElement('ktf-test-framework');
      const summary = document.createElement('ktf-test-summary');
      const suite = document.createElement('ktf-test-suite');
      suite.file = 'tests/example.node-test.js';
      suite.testNames = ['A','B'];
      fw.appendChild(summary);
      fw.appendChild(suite);
      document.body.appendChild(fw);
      await nextTick(); await nextTick();

      // Simulate queue updates
      fw.dispatchEvent(new CustomEvent('ktf:queue-updated', { detail: { length: 2 } }));
      await nextTick();
      const queueShown = summary.shadowRoot.textContent.includes('Queue: 2');

      // Simulate status changes on tests to drive summary
      const [t1, t2] = suite.querySelectorAll('ktf-test');
      t1.status = 'running';
      await nextTick();
      const running = summary.getAttribute('status') === 'running' || summary.status === 'running';
      t1.status = 'pass'; t2.status = 'pass';
      await nextTick(); await nextTick();
      const passOk = summary.getAttribute('status') === 'pass' || summary.status === 'pass';

      if (queueShown && running && passOk) pass('TestSummary reflected queue and status transitions');
      else fail('TestSummary did not update as expected');
    } catch (e) { fail(e.stack || String(e)); }
  }
};
