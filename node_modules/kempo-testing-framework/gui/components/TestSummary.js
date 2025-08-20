import { LitElement, html, css } from '../lit-all.min.js';
import './Collapsible.js';
import './Icon.js';

window.customElements.define('ktf-test-summary', class extends LitElement {
  /*
    Properties
  */
  static properties = {
    status: { type: String, reflect: true },
    fileCounts: { state: true },
  testCounts: { state: true },
  queueLength: { state: true }
  };

  constructor(){
    super();
    this.status = 'notran';
    this.testsMap = new Map();
    this.fileCounts = { total: 0, pass: 0, fail: 0, running: 0, notran: 0 };
    this.testCounts = { total: 0, pass: 0, fail: 0, running: 0, notran: 0 };
  this.queueLength = 0;
  }

  /*
    Lifecycle Callbacks
  */
  connectedCallback(){
    super.connectedCallback();
  const fw = this.getFrameworkEl();
  (fw||window).addEventListener('testfile_status_change', this.onFileStatusChange);
  (fw||window).addEventListener('test_status_change', this.onTestStatusChange);
  if(fw) fw.addEventListener('ktf:queue-updated', this.onQueueUpdated);
  }
  disconnectedCallback(){
    super.disconnectedCallback();
  const fw = this.getFrameworkEl();
  (fw||window).removeEventListener('testfile_status_change', this.onFileStatusChange);
  (fw||window).removeEventListener('test_status_change', this.onTestStatusChange);
  if(fw) fw.removeEventListener('ktf:queue-updated', this.onQueueUpdated);
  }
  firstUpdated(){
  this.initializeFromChildren();
  const fw = this.getFrameworkEl();
  if(fw){ this.onQueueUpdated({ detail: { length: fw.queue?.length || 0 } }); }
  }

  /*
    Event Handlers
  */
  onSlotChange = () => { this.initializeFromChildren(); };
  onFileStatusChange = () => { this.recountFiles(); this.updateSuiteStatus(); };
  onTestStatusChange = (e) => {
    const d = e?.detail || {};
    if(d && d.file && d.name && d.status){
      const key = `${d.file}::${d.name}`;
      this.testsMap.set(key, d.status);
      this.recountTests();
      this.updateSuiteStatus();
    }
  };
  onQueueUpdated = (e) => { this.queueLength = Number(e?.detail?.length||0); };
  getFrameworkEl(){ return this.closest('ktf-test-framework'); }
  runAllSuites = () => {
  const fw = this.getFrameworkEl();
  if(fw && typeof fw.runAllSuites==='function') fw.runAllSuites();
  };

  /*
    Utility Methods
  */
  initializeFromChildren(){
  const root = this.getFrameworkEl() || document;
  const fileEls = Array.from(root.querySelectorAll('ktf-test-suite'));
    for(const el of fileEls){
      const file = el.file || el.getAttribute('file') || '';
      const names = Array.isArray(el.testNames) ? el.testNames : [];
      for(const name of names){
        const key = `${file}::${name}`;
        if(!this.testsMap.has(key)) this.testsMap.set(key, 'notran');
      }
    }
    this.recountFiles();
    this.recountTests();
    this.updateSuiteStatus();
  }
  recountFiles(){
  const root = this.getFrameworkEl() || document;
  const fileEls = Array.from(root.querySelectorAll('ktf-test-suite'));
    const counts = { total: fileEls.length, pass: 0, fail: 0, running: 0, notran: 0 };
    for(const el of fileEls){
      const s = el.getAttribute('status') || 'notran';
      if(s==='pass') counts.pass++;
      else if(s==='fail') counts.fail++;
      else if(s==='running') counts.running++;
      else counts.notran++;
    }
    this.fileCounts = counts;
  }
  recountTests(){
    const counts = { total: 0, pass: 0, fail: 0, running: 0, notran: 0 };
    for(const s of this.testsMap.values()){
      counts.total++;
      if(s==='pass') counts.pass++;
      else if(s==='fail') counts.fail++;
      else if(s==='running') counts.running++;
      else counts.notran++;
    }
    this.testCounts = counts;
  }
  updateSuiteStatus(){
    const f = this.fileCounts;
    const t = this.testCounts;
    let next = 'notran';
    if(f.running>0 || t.running>0) next = 'running';
    else if(f.fail>0 || t.fail>0) next = 'fail';
    else if((f.total>0 || t.total>0) && f.fail===0 && t.fail===0 && f.running===0 && t.running===0 && f.notran===0 && t.notran===0) next = 'pass';
    else next = 'notran';
    if(this.status!==next) this.status = next;
  }

  /*
    Rendering
  */
  render(){
    const f = this.fileCounts;
    const t = this.testCounts;
    return html`
      <link rel="stylesheet" href="/essential.css">
  <ktf-collapsible opened>
        <span slot="title" class="-ml"><b>Test Summary</b></span>
  <div slot="actions">
          ${this.status==='notran' ? html`
            <button class="no-btn d-ib ph" @click=${this.runAllSuites} aria-label="Run All Tests">
              <ktf-icon name="play"></ktf-icon>
            </button>
          ` : html`
            <span class="d-ib ph status-color" aria-hidden="true">
              <ktf-icon name="${this.status}" animation="${this.status==='running'?'spin':'none'}"></ktf-icon>
            </span>
          `}
        </div>
        <div class="summary mb">
          <button class="primary mb" @click=${this.runAllSuites} ?disabled=${this.status==='running'}>Run All Tests</button>
          <div class="counts mt">
            <span class="muted">Queue: ${this.queueLength}</span>
          </div>
          <div class="row">
            <div class="col">
              <h6>Files</h6>
              <div class="counts">
                <span>Total: ${f.total}</span>
                <span class="pass">Pass: ${f.pass}</span>
                <span class="fail">Fail: ${f.fail}</span>
                <span class="running">Running: ${f.running}</span>
                <span class="notran">Not Ran: ${f.notran}</span>
              </div>
            </div>
            <div class="col">
              <h6>Tests</h6>
              <div class="counts">
                <span>Total: ${t.total}</span>
                <span class="pass">Pass: ${t.pass}</span>
                <span class="fail">Fail: ${t.fail}</span>
                <span class="running">Running: ${t.running}</span>
                <span class="notran">Not Ran: ${t.notran}</span>
              </div>
            </div>
          </div>
          <slot></slot>
        </div>
      </ktf-collapsible>
    `;
  }

  static styles = css`
    :host{ --suite_status: var(--tc_default, inherit); }
    :host([status="running"]){ --suite_status: var(--tc_primary,#3366ff); }
    :host([status="pass"]){ --suite_status: var(--tc_success, rgb(0,136,0)); }
    :host([status="fail"]){ --suite_status: var(--tc_danger, rgb(255,0,51)); }
    .summary h6{ color: var(--suite_status); }
    div[slot="actions"]{ font-size: 1.25rem; }
    .counts{ display:flex; gap: var(--spacer_h); flex-wrap: wrap; }
    .counts .pass{ color: var(--tc_success, rgb(0,136,0)); }
    .counts .fail{ color: var(--tc_danger, rgb(255,0,51)); }
    .counts .running{ color: var(--tc_primary,#3366ff); }
    .counts .notran{ color: var(--tc_muted); }
  `;
});
