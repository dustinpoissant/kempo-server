import { LitElement, html, css } from '../lit-all.min.js';
import './Icon.js';
import './Collapsible.js';
import { getSettings, subscribe } from './settingsStore.js';

window.customElements.define('ktf-logs', class extends LitElement {
  /*
    Properties
  */
  static properties = {
    level: { type: Number }
  };
  #logs = [];
  #unsubscribe = null;
  constructor(){
    super();
    const initial = Number(getSettings().logLevel ?? 3);
    this.level = Number.isFinite(initial) ? initial : 3;
  }
  connectedCallback(){
    super.connectedCallback();
    this.#unsubscribe = subscribe(s => {
      const parsed = Number(s.logLevel ?? 3);
      this.level = Number.isFinite(parsed) ? parsed : 3;
    });
  }
  disconnectedCallback(){
    super.disconnectedCallback();
    if (this.#unsubscribe) this.#unsubscribe();
  }
  get logs(){
    return this.#logs;
  }

  /*
    Methods
  */
  addLog = (...logs) => {
    this.#logs.push(...logs);
    this.requestUpdate();
  };
  clear = () => {
    this.#logs.length = 0;
    this.requestUpdate();
  };

  /*
    Rendering
  */
  render(){
    const filtered = this.#logs.filter(l => {
      const lvl = Number.isFinite(l?.level) ? l.level : 3;
      return lvl <= this.level;
    });
    if (!filtered.length) return html``;
    return html`
      <link rel="stylesheet" href="/essential.css">
      <ktf-collapsible opened>
        <span slot="title"><ktf-icon name="logs"></ktf-icon> Logs</span>
        <pre class="bg-alt -mx -mt p mb0 rb">${filtered.map(l => html`<div class="${l?.type || 'log'}">${l?.message ?? ''}</div>`)}</pre>
      </ktf-collapsible>
    `;
  }

  static styles = css`
    :host { display:block; }
    .error,.fail { color: var(--tc_danger, rgb(255, 0, 51)); }
    .warning { color: var(--tc_warning, #b58900); }
    .pass { color: var(--tc_success, rgb(0, 136, 0)); }
    .progress { color: var(--tc_muted, #6b7280); }
    .summary { color: var(--tc_primary, #3366ff); }
  `;
});
