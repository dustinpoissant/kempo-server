// Browser tests for SettingSelect component

const nextTick = () => new Promise(r => setTimeout(r));

export const beforeEach = async () => {
  document.body.innerHTML = '';
  try { localStorage.removeItem('ktf_settings'); } catch {}
};

export default {
  'SettingSelect reflects and updates settings': async ({ pass, fail, log }) => {
    try {
      await import('/gui/components/settingsStore.js');
      await import('/gui/components/SettingSelect.js');
      window.KTF_SETTINGS.set({ logLevel: 2 });
      const el = document.createElement('ktf-setting-select');
      el.name = 'logLevel';
      el.label = 'Log Level';
      document.body.appendChild(el);
      await nextTick();
      const select = el.querySelector('select');
      const before = String(select.value) === '2';
      select.value = '1'; select.dispatchEvent(new Event('change'));
      await nextTick();
      const after = window.KTF_SETTINGS.get().logLevel === 1;
    log(`Select value before:${before} after:${after}`);
    if (before && after) pass('SettingSelect updated setting from 2 to 1'); else fail('SettingSelect did not update setting');
    } catch (e) { fail(e.stack || String(e)); }
  },

  'SettingSelect stays in sync when settings change externally': async ({ pass, fail }) => {
    try {
      await import('/gui/components/settingsStore.js');
      await import('/gui/components/SettingSelect.js');
      window.KTF_SETTINGS.set({ logLevel: 1 });
      const el = document.createElement('ktf-setting-select');
      el.name = 'logLevel';
      document.body.appendChild(el);
      await nextTick();
      const select = el.querySelector('select');
      window.KTF_SETTINGS.set({ logLevel: 4 });
      await nextTick();
      const synced = String(select.value) === '4';
    if (synced) pass('SettingSelect synced after external settings change'); else fail('Select did not sync after external change');
    } catch (e) { fail(e.stack || String(e)); }
  }
};
