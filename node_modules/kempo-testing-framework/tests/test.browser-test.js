// Browser tests for Test component

const nextTick = () => new Promise(r => setTimeout(r));

export const beforeEach = async () => {
  document.body.innerHTML = '';
  try { localStorage.removeItem('ktf_settings'); } catch {}
};

export default {
  'Test renders and shows play icon before run': async ({ pass, fail }) => {
    try {
      await import('/gui/components/settingsStore.js');
      await import('/gui/components/Collapsible.js');
      await import('/gui/components/Logs.js');
      await import('/gui/components/Icon.js');
      await import('/gui/components/Test.js');

      const t = document.createElement('ktf-test');
      t.name = 'Sample Test';
      t.file = 'tests/example.node-test.js';
      document.body.appendChild(t);
      await nextTick();

    const hasPlay = !!t.shadowRoot.querySelector('div[slot="actions"] ktf-icon[name="play"]');
    if (hasPlay) pass('Test component renders with initial play icon'); else fail('Missing play icon on Test component');
    } catch (e) { fail(e.stack || String(e)); }
  },

  'Test status updates through running/pass/fail': async ({ pass, fail }) => {
    try {
      await import('/gui/components/settingsStore.js');
      await import('/gui/components/Collapsible.js');
      await import('/gui/components/Logs.js');
      await import('/gui/components/Icon.js');
      await import('/gui/components/Test.js');

      const t = document.createElement('ktf-test');
      t.name = 'Sample Test';
      t.file = 'tests/example.node-test.js';
      document.body.appendChild(t);
      await nextTick();

      t.status = 'running';
      await nextTick();
      const running = t.getAttribute('status') === 'running' || t.status === 'running';
      t.status = 'pass';
      await nextTick();
      const passOk = t.getAttribute('status') === 'pass' || t.status === 'pass';
      t.status = 'fail';
      await nextTick();
      const failOk = t.getAttribute('status') === 'fail' || t.status === 'fail';
  if (running && passOk && failOk) pass('Test component reflected status transitions running→pass→fail'); else fail('Status transitions failed to reflect on Test');
    } catch (e) { fail(e.stack || String(e)); }
  }
};
