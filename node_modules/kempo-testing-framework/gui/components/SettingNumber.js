import { LitElement, html } from '../lit-all.min.js';
import { getSettings, setSettings, subscribe } from './settingsStore.js';

window.customElements.define('ktf-setting-number', class extends LitElement {
  static properties = {
    name: { type: String },
    label: { type: String },
    min: { type: Number },
    max: { type: Number },
    step: { type: Number },
    value: { state: true },
    suffix: { type: String },
  };

  constructor(){
    super();
    this.min = 0;
    this.step = 100;
    this.max = 600000; // 10 minutes
    this.suffix = '';
  }

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
    this.value = (typeof v === 'number' && !Number.isNaN(v)) ? v : 0;
  }

  onChange(e) {
    let v = e.target.value;
    let n = parseInt(v, 10);
    if (Number.isNaN(n)) n = 0;
    if (this.min !== undefined && n < this.min) n = this.min;
    if (this.max !== undefined && n > this.max) n = this.max;
    if (this.name) setSettings({ [this.name]: n });
  }

  updated(changed) {
    if (changed.has('value')) {
      const id = `setting-${this.name || 'number'}`;
      const el = this.querySelector(`#${id}`);
      if (el && String(el.value) !== String(this.value ?? '')) el.value = String(this.value ?? '');
    }
  }

  render() {
    const id = `setting-${this.name || 'number'}`;
    return html`
      ${this.label ? html`<label for="${id}">${this.label}</label>` : ''}
      <div class="mb">
        <input
					id="${id}"
					type="number"
					min="${this.min}"
					max="${this.max}"
					step="${this.step}"
					.value=${String(this.value ?? '')}
					@change=${(e) => this.onChange(e)}
					style="width: 10rem;"
					class="d-ib"
				/>
        ${this.suffix ? html`<span class="ml-xs">${this.suffix}</span>` : ''}
      </div>
    `;
  }
});
