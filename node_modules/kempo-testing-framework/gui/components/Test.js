import { LitElement, html, css } from '../lit-all.min.js';
import { statusMap } from './TestSuite.js';
import './Icon.js';
import './Logs.js';
import './Collapsible.js';
import { subscribe } from './settingsStore.js';

window.customElements.define('ktf-test', class extends LitElement {
	static properties = {
		file: { type: String, reflect: true },
		name: { type: String, reflect: true },
		status: { type: String, reflect: true }
	}
	#unsubscribe = null;
	constructor(){
		super();
		this.file = '';
		this.name = '';
		this.status = 'notran';
	}

	connectedCallback(){
		super.connectedCallback();
		this.#unsubscribe = subscribe(() => this.requestUpdate());
	}
	disconnectedCallback(){
		super.disconnectedCallback();
		if (this.#unsubscribe) this.#unsubscribe();
	}

	updated(changedProps){
		if(changedProps.has('status')){
			this.dispatchEvent(new CustomEvent('test_status_change', {
				detail: { status: this.status, file: this.file, name: this.name },
				bubbles: true,
				composed: true
			}));
		}
	}

	runTest = () => {
		const fw = this.closest('ktf-test-framework') || document.querySelector('ktf-test-framework');
		if(fw && typeof fw.enqueueTest==='function') fw.enqueueTest({ file: this.file, name: this.name, el: this });
	};

	render(){
		if(!this.file || !this.name) return html``;
		return html`
			<link rel="stylesheet" href="/essential.css">
			<ktf-collapsible>
				<span slot="title" id="title" class="-ml">
					${this.name}
				</span>
				<div slot="actions">
						${this.status==='notran' ? html`
						<button class="no-btn d-ib ph" @click=${this.runTest} aria-label="Run Test" ?disabled=${this.status==='queued' || this.status==='running'}>
								<ktf-icon name="play"></ktf-icon>
						</button>
					` : html`
						<span class="d-ib ph status-color" aria-hidden="true">
								<ktf-icon name="${this.status==='queued' ? 'scheduled' : this.status}" animation="${this.status === 'running' ? 'spin' : 'none'}"></ktf-icon>
						</span>
					`}
				</div>
				<div id="details">
					<div id="status">
						<h6>${statusMap[this.status]}</h6>
					</div>
					${this.status!=='running'?html`
						<button class="primary mb" @click=${this.runTest} ?disabled=${this.status==='queued'}>Run Test</button>
					`:html``}
					<ktf-logs id="logs"></ktf-logs>
				</div>
			</ktf-collapsible>
		`;
	}

	static styles = css`
		:host {
			--tc_status: var(--tc_default, inherit);
		}
		:host([status="running"]) {
			--tc_status: var(--tc_primary, #3366ff);
		}
		:host([status="pass"]) {
			--tc_status: var(--tc_success, rgb(0, 136, 0));
		}
		:host([status="fail"]) {
			--tc_status: var(--tc_danger, rgb(255, 0, 51));
		}
		#title { font-size: 1rem; font-weight: 600; }
		div[slot="actions"] { font-size: 1rem; }
		#title,
		#status {
			color: var(--tc_status);
		}
		.status-color { color: var(--tc_status); }
	`;
});
