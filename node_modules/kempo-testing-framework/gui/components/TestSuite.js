import { LitElement, html, css, render } from '../lit-all.min.js';
import './Icon.js';
import './Test.js';
import './Logs.js';
import './Collapsible.js';
import { subscribe } from './settingsStore.js';

export const statusMap = {
  notran: 'Not Ran',
  queued: 'Queued',
  running: 'Running',
  pass: 'Pass',
  fail: 'Fail'
};

class TestSuiteEl extends LitElement {
  /*
    Properties
  */
  static properties = {
    file: { type: String, reflect: true },
    testNames: { type: Array },
  status: { type: String, reflect: true }
  };
  #unsubscribe = null;
  #testsContainer = null;
  constructor(){
    super();
    this.file = '';
    this.testNames = [];
    this.status = 'notran';
  }

  /*
    LifecycleCallbacks
  */
  connectedCallback(){
    super.connectedCallback();
  }
  firstUpdated(){
    // Listen on host so light-DOM children bubble here
    this.addEventListener('test_status_change', this.testStatusChangeHandler);
    this.#unsubscribe = subscribe(() => this.requestUpdate());
    // Ensure a light-DOM container exists for tests and render them there
    const existing = this.querySelector('[slot="tests"]');
    this.#testsContainer = existing || (() => {
      const c = document.createElement('div');
      c.setAttribute('slot', 'tests');
      this.appendChild(c);
      return c;
    })();
    this.renderTests();
  }
  disconnectedCallback(){
    super.disconnectedCallback();
    this.removeEventListener('test_status_change', this.testStatusChangeHandler);
    if(this.#unsubscribe) this.#unsubscribe();
  }
  updated(changedProps){
    if(changedProps.has('status')){
      this.dispatchEvent(new CustomEvent('testfile_status_change', {
        detail: { file: this.file, status: this.status },
        bubbles: true,
        composed: true
      }));
    }
    if(changedProps.has('file') || changedProps.has('testNames')){
      this.renderTests();
    }
  }

  /*
    Methods
  */
  runAllTests = () => {
    const getFrameworkEl = () => {
      let node = this;
      while(node){
        if(node && node.closest){
          const fw = node.closest('ktf-test-framework');
          if(fw) return fw;
        }
        const root = node?.getRootNode?.();
        const host = root && root.host ? root.host : null;
        if(!host) break;
        node = host;
      }
      return document.querySelector('ktf-test-framework');
    };
    const fw = getFrameworkEl();
    if(fw && typeof fw.enqueueSuite==='function') fw.enqueueSuite({ file: this.file, testNames: this.testNames, el: this });
  };
  testStatusChangeHandler = () => { this.status = this.calcStatus(); };

  /*
    Utility Methods
  */
  getFrameworkEl = () => {
    let node = this;
    while(node){
      if(node && node.closest){
        const fw = node.closest('ktf-test-framework');
        if(fw) return fw;
      }
      const root = node?.getRootNode?.();
      const host = root && root.host ? root.host : null;
      if(!host) break;
      node = host;
    }
    return document.querySelector('ktf-test-framework');
  };
  calcStatus = () => {
  const root = this.#testsContainer || this;
  const testElements = root.querySelectorAll('ktf-test');
    const statuses = Array.from(testElements).map(el => el.status);
    if(statuses.includes('running')) return 'running';
    if(statuses.includes('fail')) return 'fail';
    if(statuses.length && statuses.every(s => s==='pass')) return 'pass';
    return 'notran';
  };

  /*
    Light DOM rendering for tests
  */
  renderTests(){
    if(!this.#testsContainer) return;
    const list = Array.isArray(this.testNames) ? this.testNames : [];
    const tpl = html`${list.map(name => html`<ktf-test .file=${this.file} .name=${name}></ktf-test>`)}`;
    render(tpl, this.#testsContainer);
  }

  /*
    Rendering
  */
  render(){
    if(!this.file || !this.testNames.length) return html``;
    const titleText = this.file.replace('tests/', '').replace('.node-test.js', '').replace('.browser-test.js', '').replace('.test.js', '');
    return html`
      <link rel="stylesheet" href="/essential.css">
      <ktf-collapsible>
        <span slot="title" id="title" class="-ml">${titleText}</span>
        <div slot="actions">
          ${this.status==='notran' || this.status==='queued' ? html`
            <button class="no-btn d-ib ph" @click=${this.runAllTests} aria-label="Run Test Suite" ?disabled=${this.status==='queued'}>
              <ktf-icon name="${this.status==='queued'?'scheduled':'play'}"></ktf-icon>
            </button>
          ` : html`
            <span class="d-ib ph status-color" aria-hidden="true">
              <ktf-icon name="${this.status}" animation="${this.status==='running'?'spin':'none'}"></ktf-icon>
            </span>
          `}
        </div>
        <div id="details">
          <div id="status">
            <h6>${statusMap[this.status]}</h6>
            ${this.status!=='running'?html`
              <button class="primary mb" @click=${this.runAllTests} ?disabled=${this.status==='queued'}>Run Test Suite</button>
            `:html``}
          </div>
          <ktf-logs id="fileLogs"></ktf-logs>
          <slot name="tests"></slot>
        </div>
      </ktf-collapsible>
    `;
  }

  static styles = css`
    :host{ --tf_status: var(--tc_default, inherit); }
    :host([status="running"]){ --tf_status: var(--tc_primary, #3366ff); }
    :host([status="pass"]){ --tf_status: var(--tc_success, rgb(0, 136, 0)); }
    :host([status="fail"]){ --tf_status: var(--tc_danger, rgb(255, 0, 51)); }
    #title{ font-size: 1.25rem; font-weight: 600; }
    div[slot="actions"]{ font-size: 1.25rem; }
    #title,
    #status{ color: var(--tf_status); }
    .status-color{ color: var(--tf_status); }
  `;
}

window.customElements.define('ktf-test-suite', TestSuiteEl);

