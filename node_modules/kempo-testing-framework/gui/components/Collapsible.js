import { LitElement, html, css } from '../lit-all.min.js';

window.customElements.define('ktf-collapsible', class extends LitElement {
	/*
		Properties
	*/
	static properties = {
		opened: { type: Boolean, reflect: true }
	}
	constructor(){
		super();
		this.opened = false;
	}
	connectedCallback(){
		super.connectedCallback();
		if (this.hasAttribute('opened')) this.opened = true;
	}

	/*
		Event Handling
	*/
	toggle = () => {
		this.opened = !this.opened;
	}

	/*
		Rendering
	*/
	render(){
		return html`
			<link rel="stylesheet" href="/essential.css">
			<div class="header">
				<div class="actions">
					<slot name="actions"></slot>
				</div>
				<button class="no-btn p r title" @click=${this.toggle}>
					<slot name="title">Show ${this.opened?'Less':'More'}</slot>
				</button>
			</div>
			${this.opened?html`<div class="bt p pb0"><slot></slot></div>`:''}
		`;
	}
	static styles = css`
		:host {
			display: block;
			border: 1px solid var(--c_border, #cccccc);
			border-radius: var(--radius, 0.25rem);
			margin-bottom: var(--spacer, 1rem);
		}
		.header { display: flex; align-items: center; }
		.title { flex: 1; text-align: left; }
		.actions { display: inline-flex; align-items: center; gap: .5rem; }
	`;
});
