class Counter extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.count = 0;
  }

  connectedCallback() {
    this.render();
    this.shadowRoot.querySelector('button').addEventListener('click', this.increment);
  }

  disconnectedCallback() {
    const button = this.shadowRoot.querySelector('button');
    if (button) {
      button.removeEventListener('click', this.increment);
    }
  }

  increment = () => {
    this.count++;
    this.render();
  }

  render() {
    this.shadowRoot.innerHTML = `
      <button>Increment</button>
      <div>Count: ${this.count}</div>
    `;
    this.shadowRoot.querySelector('button').addEventListener('click', this.increment);
  }
}

customElements.define('my-counter', Counter);