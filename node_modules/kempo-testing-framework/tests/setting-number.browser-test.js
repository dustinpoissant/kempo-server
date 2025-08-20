// Browser tests for SettingNumber component

const nextTick = () => new Promise(r => setTimeout(r));

export const beforeEach = async () => {
  document.body.innerHTML = '';
  try { localStorage.removeItem('ktf_settings'); } catch {}
};

export default {
  'SettingNumber reflects and updates settings with clamping': async ({ pass, fail, log }) => {
    try {
      const store = await import('/gui/components/settingsStore.js');
      await import('/gui/components/SettingNumber.js');
      store.setSettings({ delayMs: 500 });
      const el = document.createElement('ktf-setting-number');
      el.name = 'delayMs';
      el.label = 'Delay';
      el.min = 0; el.max = 1000; el.step = 100; el.suffix = 'ms';
      document.body.appendChild(el);
      await nextTick();
      const input = el.querySelector('input[type="number"]');
      const before = String(input.value) === '500';
      input.value = '1200'; input.dispatchEvent(new Event('change'));
      await nextTick();
      const clamped = store.getSettings().delayMs === 1000;
      input.value = 'abc'; input.dispatchEvent(new Event('change'));
      await nextTick();
      const nanToZero = store.getSettings().delayMs === 0;
      log(`before:${before} clamped:${clamped} nanToZero:${nanToZero}`);
      if (before && clamped && nanToZero) pass('SettingNumber reflected, clamped, and sanitized values');
      else fail('SettingNumber did not reflect/clamp/sanitize as expected');
    } catch (e) { fail(e.stack || String(e)); }
  },

  'SettingNumber input syncs when settings change externally': async ({ pass, fail }) => {
    try {
      const store = await import('/gui/components/settingsStore.js');
      await import('/gui/components/SettingNumber.js');
      store.setSettings({ delayMs: 0 });
      const el = document.createElement('ktf-setting-number');
      el.name = 'delayMs';
      document.body.appendChild(el);
      await nextTick();
      const input = el.querySelector('input[type="number"]');
      const initial = String(input.value) === '0';
      store.setSettings({ delayMs: 250 });
      await nextTick();
      const updated = String(input.value) === '250';
      if (initial && updated) pass('SettingNumber stayed in sync with external setting change');
      else fail('SettingNumber did not sync input after settings change');
    } catch (e) { fail(e.stack || String(e)); }
  }
};
