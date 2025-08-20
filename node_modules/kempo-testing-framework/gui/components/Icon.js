import { LitElement, html, css, unsafeHTML } from '../lit-all.min.js';

// Static cache to store fetched icons across all instances
const iconCache = new Map();

window.customElements.define('ktf-icon', class extends LitElement {
	/*
		Properties
	*/
	static properties = {
		name: { type: String, reflect: true },
		svg: { type: String },
		animation: { type: String, reflect: true }
	}
	constructor(){
		super();
		this.name = '';
		this.animation = 'none';
		this.defaultSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960""><path fill="currentColor" d="M480-79q-16 0-30.5-6T423-102L102-423q-11-12-17-26.5T79-480q0-16 6-31t17-26l321-321q12-12 26.5-17.5T480-881q16 0 31 5.5t26 17.5l321 321q12 11 17.5 26t5.5 31q0 16-5.5 30.5T858-423L537-102q-11 11-26 17t-31 6Zm0-80 321-321-321-321-321 321 321 321Zm-40-281h80v-240h-80v240Zm40 120q17 0 28.5-11.5T520-360q0-17-11.5-28.5T480-400q-17 0-28.5 11.5T440-360q0 17 11.5 28.5T480-320Zm0-160Z"/></svg>';
		this.svg = this.defaultSvg;
	}

	/*
		Lifecycle Callback
	*/
	updated(changedProperties){
		if(changedProperties.has('name')){
			this.fetchIcon();
		}
	}
	
	/*
		Methods
	*/
	async fetchIcon(){
		if (this.name) {
			// Check cache first
			const cached = iconCache.get(this.name);
			if (cached) {
				if (cached instanceof Promise) {
					this.svg = await cached;
				} else {
					this.svg = cached;
				}
				return;
			}

			// Cache the promise immediately
			const promise = (async () => {
				try {
					const response = await fetch(`/icons/${this.name}.svg`);
					return response.ok ? await response.text() : this.defaultSvg;
				} catch {
					return this.defaultSvg;
				}
			})();
			
			iconCache.set(this.name, promise);
			
			const svgContent = await promise;
			iconCache.set(this.name, svgContent);
			this.svg = svgContent;
		}
	}

	/*
		Rendering
	*/
	render(){
		return html`${unsafeHTML(this.svg)}`;
	}
	static styles = css`
		:host {
			display: inline-block;
			height: 1.35em;
			width: 1.35em;
			vertical-align: top;
		}

		/* Animation classes */
		:host([animation="spin"]) {
			animation: spin 1s linear infinite;
		}

		:host([animation="pulse"]) {
			animation: pulse 1.5s ease-in-out infinite;
		}

		:host([animation="bounce"]) {
			animation: bounce 1s ease-in-out infinite;
		}

		:host([animation="shake"]) {
			animation: shake 0.5s ease-in-out infinite;
		}

		:host([animation="fade"]) {
			animation: fade 2s ease-in-out infinite;
		}

		:host([animation="flip"]) {
			animation: flip 2s ease-in-out infinite;
		}

		/* Keyframe definitions */
		@keyframes spin {
			from { transform: rotate(0deg); }
			to { transform: rotate(360deg); }
		}

		@keyframes pulse {
			0%, 100% { 
				transform: scale(1); 
				opacity: 1; 
			}
			50% { 
				transform: scale(1.1); 
				opacity: 0.7; 
			}
		}

		@keyframes bounce {
			0%, 20%, 50%, 80%, 100% {
				transform: translateY(0);
			}
			40% {
				transform: translateY(-0.3em);
			}
			60% {
				transform: translateY(-0.15em);
			}
		}

		@keyframes shake {
			0%, 100% { transform: translateX(0); }
			10%, 30%, 50%, 70%, 90% { transform: translateX(-0.1em); }
			20%, 40%, 60%, 80% { transform: translateX(0.1em); }
		}

		@keyframes fade {
			0%, 100% { opacity: 1; }
			50% { opacity: 0.3; }
		}

		@keyframes flip {
			0% { transform: rotateY(0deg); }
			50% { transform: rotateY(180deg); }
			100% { transform: rotateY(360deg); }
		}
	`
});
