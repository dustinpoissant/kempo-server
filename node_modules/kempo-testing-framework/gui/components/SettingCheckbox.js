import { LitElement, html } from '../lit-all.min.js';
import { getSettings, setSettings, subscribe } from './settingsStore.js';

window.customElements.define('ktf-setting-checkbox', class extends LitElement {
  static properties = {
    name: { type: String },
    label: { type: String },
    checked: { state: true },
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
    this.checked = !!v;
  }

  onChange(e) {
    const v = !!e.target.checked;
    if (this.name) setSettings({ [this.name]: v });
  }

  render() {
    const id = `setting-${this.name || 'checkbox'}`;
    return html`
      <div class="d-f mb" style="align-items: center">
        <input id="${id}" type="checkbox" style="font-size: 1.35rem" .checked=${!!this.checked} @change=${(e) => this.onChange(e)} />
        <label for="${id}" style="line-height: 1.35rem" class="pb0">${this.label || ''}</label>
      </div>
    `;
  }
});
