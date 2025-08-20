// Simple global settings store with localStorage persistence and event dispatch
const STORAGE_KEY = 'ktf_settings';
const DEFAULTS = {
  showBrowser: false,
  logLevel: 3,
  theme: 'auto',
  delayMs: 0,
};

let state = (() => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
})();

const save = () => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
};

export const getSettings = () => ({ ...state });

export const setSettings = (partial) => {
  state = { ...state, ...partial };
  save();
  const evt = new CustomEvent('ktf-settings-change', { detail: { ...state } });
  window.dispatchEvent(evt);
};

export const subscribe = (handler) => {
  const wrapped = (e) => handler(e.detail);
  window.addEventListener('ktf-settings-change', wrapped);
  return () => window.removeEventListener('ktf-settings-change', wrapped);
};

// Expose on window for debugging if needed
if (!window.KTF_SETTINGS) {
  window.KTF_SETTINGS = {
    get: getSettings,
    set: setSettings,
  };
}
