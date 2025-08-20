// Browser tests for Theme component

const nextTick = () => new Promise(r => setTimeout(r));

export const beforeEach = async () => {
  document.body.innerHTML = '';
  try { localStorage.removeItem('ktf_settings'); } catch {}
};

export default {
  'Theme applies document theme on settings change': async ({ pass, fail }) => {
    try {
      await import('/gui/components/settingsStore.js');
      await import('/gui/components/Theme.js');
      const el = document.createElement('ktf-theme');
      document.body.appendChild(el);
      await nextTick();
      window.KTF_SETTINGS.set({ theme: 'dark' });
      await nextTick();
      const themeAttr = document.documentElement.getAttribute('theme');
    if (themeAttr === 'dark') pass('Theme component applied document theme to dark'); else fail(`Theme not applied: ${themeAttr}`);
    } catch (e) { fail(e.stack || String(e)); }
  },

  'Theme switches back to light': async ({ pass, fail }) => {
    try {
      await import('/gui/components/settingsStore.js');
      await import('/gui/components/Theme.js');
      const el = document.createElement('ktf-theme');
      document.body.appendChild(el);
      await nextTick();
      window.KTF_SETTINGS.set({ theme: 'light' });
      await nextTick();
      const themeAttr = document.documentElement.getAttribute('theme');
    if (themeAttr === 'light') pass('Theme component applied document theme back to light'); else fail(`Theme not applied: ${themeAttr}`);
    } catch (e) { fail(e.stack || String(e)); }
  }
};
