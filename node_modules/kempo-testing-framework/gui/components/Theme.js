import { LitElement, html, css } from '../lit-all.min.js';
import { getSettings, subscribe } from './settingsStore.js';

window.customElements.define('ktf-theme', class extends LitElement {
  static properties = {
    theme: { type: String, reflect: true }
  }
  #unsubscribe = null;
  constructor(){
    super();
    this.theme = (getSettings().theme) || 'auto';
  }
  connectedCallback(){
    super.connectedCallback();
    this.applyTheme(this.theme);
    this.#unsubscribe = subscribe(s => {
      if (s.theme !== this.theme) {
        this.theme = s.theme || 'auto';
        this.applyTheme(this.theme);
      }
    });
  }
  disconnectedCallback(){
    super.disconnectedCallback();
    if (this.#unsubscribe) this.#unsubscribe();
  }

  applyTheme(theme){
    document.documentElement.setAttribute('theme', theme || 'auto');
  }

  render(){
    // No UI; control is in Settings accordion. Keep a subtle indicator if needed.
    return html``;
  }

  static styles = css`
    :host { display:none; }
  `;
});
