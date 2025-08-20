// Browser tests for SettingCheckbox component

const nextTick = () => new Promise(r => setTimeout(r));

export const beforeEach = async () => {
  document.body.innerHTML = '';
  try { localStorage.removeItem('ktf_settings'); } catch {}
};

export default {
  'SettingCheckbox reflects and updates settings': async ({ pass, fail, log }) => {
    try {
      await import('/gui/components/settingsStore.js');
      await import('/gui/components/SettingCheckbox.js');
      window.KTF_SETTINGS.set({ showBrowser: false });
      const el = document.createElement('ktf-setting-checkbox');
      el.name = 'showBrowser';
      el.label = 'Show Browser';
      document.body.appendChild(el);
      await nextTick();
      const input = el.querySelector('input[type="checkbox"]');
    const before = input.checked === false;
      input.checked = true; input.dispatchEvent(new Event('change'));
      await nextTick();
      const after = window.KTF_SETTINGS.get().showBrowser === true;
    log(`Checkbox before:${before} after:${after}`);
    if (before && after) pass('SettingCheckbox updated setting from false to true'); else fail('SettingCheckbox did not update setting');
    } catch (e) { fail(e.stack || String(e)); }
  },

  'SettingCheckbox unchecks updates back to false': async ({ pass, fail, log }) => {
    try {
      await import('/gui/components/settingsStore.js');
      await import('/gui/components/SettingCheckbox.js');
      window.KTF_SETTINGS.set({ showBrowser: true });
      const el = document.createElement('ktf-setting-checkbox');
      el.name = 'showBrowser';
      document.body.appendChild(el);
      await nextTick();
      const input = el.querySelector('input[type="checkbox"]');
      input.checked = false; input.dispatchEvent(new Event('change'));
      await nextTick();
      const after = window.KTF_SETTINGS.get().showBrowser === false;
    log(`Setting after uncheck:${after}`);
    if (after) pass('SettingCheckbox updated setting back to false'); else fail('Uncheck did not update setting');
    } catch (e) { fail(e.stack || String(e)); }
  }
};
