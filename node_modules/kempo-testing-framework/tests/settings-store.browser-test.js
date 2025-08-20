// Browser tests for settingsStore helpers

const nextTick = () => new Promise(r => setTimeout(r));

export const beforeEach = async () => {
  document.body.innerHTML = '';
  try { localStorage.removeItem('ktf_settings'); } catch {}
};

export default {
  'settingsStore get/set persists to localStorage and dispatches event': async ({ pass, fail }) => {
    try {
      const store = await import('/gui/components/settingsStore.js');
      const before = store.getSettings();
      const p = new Promise(resolve => {
        const unsub = store.subscribe((s) => { unsub(); resolve(s); });
      });
      store.setSettings({ theme: 'dark', logLevel: 4 });
      const evtState = await p;
      const raw = localStorage.getItem('ktf_settings');
      const parsed = JSON.parse(raw || '{}');
      const ok = evtState.theme === 'dark' && evtState.logLevel === 4 && parsed.theme === 'dark' && parsed.logLevel === 4;
      ok ? pass('settingsStore persisted and dispatched change event') : fail(`state:${JSON.stringify(evtState)} raw:${raw}`);
    } catch (e) { fail(e.stack || String(e)); }
  }
};
