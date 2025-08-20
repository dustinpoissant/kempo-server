import { LitElement, html } from '../lit-all.min.js';
import { getSettings, setSettings, subscribe } from './settingsStore.js';

const PRESETS = {
  logLevel: [
    { value: '0', label: 'Silent: Summary only' },
    { value: '1', label: 'Minimal: Summary and test statuses' },
    { value: '2', label: 'Normal: Summary, statuses, and logs for failures' },
    { value: '3', label: 'Verbose: All test logs' },
    { value: '4', label: 'Debug: All test logs and framework internal logs' },
  ],
  theme: [
    { value: 'auto', label: 'Auto (system)' },
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
  ],
};

window.customElements.define('ktf-setting-select', class extends LitElement {
  static properties = {
    name: { type: String },
    label: { type: String },
    value: { state: true },
  };

  createRenderRoot() { return this; }

  connectedCallback() {
    super.connectedCallback();
    this.apply(getSettings());
    this.unsub = subscribe((s) => this.apply(s));
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.unsub) this.unsub();
  }

  apply(s) {
    const v = this.name ? s?.[this.name] : undefined;
    this.value = v !== undefined && v !== null ? String(v) : '';
  }

  onChange(e) {
    let v = e.target.value;
    if (/^-?\d+$/.test(v)) v = parseInt(v, 10);
    if (this.name) setSettings({ [this.name]: v });
  }

  updated(changed) {
    if (changed.has('value')) {
      const id = `setting-${this.name || 'select'}`;
      const el = this.querySelector(`#${id}`);
      if (el && el.value !== String(this.value ?? '')) el.value = String(this.value ?? '');
    }
  }

  render() {
    const options = PRESETS[this.name] || [];
    const id = `setting-${this.name || 'select'}`;
    return html`
      ${this.label ? html`<label for="${id}">${this.label}</label>` : ''}
      <select id="${id}" class="mb" .value=${this.value ?? ''} @change=${(e) => this.onChange(e)}>
        ${options.map(o => html`<option value="${o.value}">${o.label}</option>`)}
      </select>
    `;
  }
});
