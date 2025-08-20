// Browser tests for TestSuite component

const nextTick = () => new Promise(r => setTimeout(r));

export const beforeEach = async () => {
  document.body.innerHTML = '';
  try { localStorage.removeItem('ktf_settings'); } catch {}
};

export default {
  'TestSuite renders children and initial play icon': async ({ pass, fail }) => {
    try {
      await import('/gui/components/settingsStore.js');
      await import('/gui/components/Collapsible.js');
      await import('/gui/components/Logs.js');
      await import('/gui/components/Icon.js');
      await import('/gui/components/Test.js');
  await import('/gui/components/TestSuite.js');

  const tf = document.createElement('ktf-test-suite');
      tf.file = 'tests/example.node-test.js';
      tf.testNames = ['A', 'B'];
      document.body.appendChild(tf);
      await nextTick(); await nextTick();

    const hasPlay = !!tf.shadowRoot.querySelector('div[slot="actions"] ktf-icon[name="play"]');
    if (hasPlay) pass('TestSuite renders children and shows initial play icon'); else fail('Missing play icon on TestSuite');
    } catch (e) { fail(e.stack || String(e)); }
  },

  'TestSuite aggregates status from children': async ({ pass, fail }) => {
    try {
      await import('/gui/components/settingsStore.js');
      await import('/gui/components/Collapsible.js');
      await import('/gui/components/Logs.js');
      await import('/gui/components/Icon.js');
      await import('/gui/components/Test.js');
  await import('/gui/components/TestSuite.js');

  const tf = document.createElement('ktf-test-suite');
      tf.file = 'tests/example.node-test.js';
      tf.testNames = ['A', 'B'];
      document.body.appendChild(tf);
      await nextTick(); await nextTick();

  const children = tf.querySelectorAll('ktf-test');
      children[0].status = 'running';
      await nextTick();
      const statusRunning = tf.getAttribute('status') === 'running' || tf.status === 'running';
      children[0].status = 'pass';
      children[1].status = 'fail';
      await nextTick();
      const statusFail = tf.getAttribute('status') === 'fail' || tf.status === 'fail';
      children[1].status = 'pass';
      await nextTick();
      const statusPass = tf.getAttribute('status') === 'pass' || tf.status === 'pass';
  if (statusRunning && statusFail && statusPass) pass('TestSuite aggregated status from children correctly'); else fail('Status propagation failed on TestSuite');
    } catch (e) { fail(e.stack || String(e)); }
  }
};
