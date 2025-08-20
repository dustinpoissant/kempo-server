import './Counter.js';

const wait = ms => new Promise(r=>setTimeout(r,ms));

export const beforeAll = (log) => {
  log('Setting up browser test environment for Counter component');
}

export const beforeEach = (log) => {
  log('Setting up test fixture - creating counter element');
  const $counter = document.createElement('my-counter');
  $counter.id = 'test-counter';
  document.body.appendChild($counter);
}

export const afterEach = (log) => {
  log('Cleaning up - removing counter element');
  const $counter = document.getElementById('test-counter');
  if ($counter) {
    $counter.remove();
  }
}

export const afterAll = (log) => {
  log('Cleaning up browser test environment');
}

export default {
  'Counter component should be defined': ({pass, fail, log}) => {
    log('Checking if my-counter element is defined');
    if (window.customElements.get('my-counter')) {
      pass('Counter component is properly registered');
    } else {
      fail('Counter component is not registered as a custom element');
    }
  },
  
  'Counter should render with initial count of 0': ({pass, fail, log}) => {
    const $counter = document.getElementById('test-counter');
    log('Checking initial counter value');
    
    if (!$counter) {
      fail('Counter element not found');
      return;
    }
    
    // Check shadow DOM content
    const countDisplay = $counter.shadowRoot.querySelector('div');
    if (countDisplay && countDisplay.textContent.includes('Count: 0')) {
      pass('Counter initializes with count of 0');
    } else {
      fail(`Counter does not show the expected initial value. Found: ${countDisplay?.textContent}`);
    }
  },
  
  'Counter should increment when clicked': async ({pass, fail, log}) => {
    const counter = document.getElementById('test-counter');
    log('Testing click increment functionality');
    
    if (!counter) {
      fail('Counter element not found');
      return;
    }
    
    const button = counter.shadowRoot.querySelector('button');
    
    // Initial state check
    let countDisplay = counter.shadowRoot.querySelector('div');
    const initialText = countDisplay.textContent;
    log(`Initial state: ${initialText}`);
    
    // Trigger click event
    button.click();
    
    // Check updated state
    countDisplay = counter.shadowRoot.querySelector('div');
    const updatedText = countDisplay.textContent;
    log(`After click: ${updatedText}`);
    
    if (updatedText.includes('Count: 1')) {
      pass('Counter successfully incremented to 1 after click');
    } else {
      fail(`Counter did not increment properly. Expected 'Count: 1' but found '${updatedText}'`);
    }
  },
  
  'Counter should increment multiple times': async ({pass, fail, log}) => {
    const counter = document.getElementById('test-counter');
    log('Testing multiple increments');
    
    if (!counter) {
      fail('Counter element not found');
      return;
    }
    
    const button = counter.shadowRoot.querySelector('button');
    
    // Simply click the button multiple times
    for (let i = 0; i < 3; i++) {
      button.click();
      await wait(100);
      log(`After click ${i+1}, counter shows: ${counter.shadowRoot.querySelector('div').textContent}`);
    }
    
    const countDisplay = counter.shadowRoot.querySelector('div');
    const countText = countDisplay.textContent;
    
    if (countText.includes('Count: 3')) {
      pass('Counter successfully incremented multiple times to 3');
    } else {
      fail(`Counter did not increment correctly after multiple clicks. Expected 'Count: 3' but found '${countText}'`);
    }
  },
  
  'Counter should maintain internal state': ({pass, fail, log}) => {
    const counter = document.getElementById('test-counter');
    log('Testing internal state management');
    
    if (!counter) {
      fail('Counter element not found');
      return;
    }
    
    // Check initial internal state
    if (counter.count === 0) {
      // Manually update the internal state
      counter.count = 42;
      counter.render();
      
      // Verify the rendered output matches the internal state
      const countDisplay = counter.shadowRoot.querySelector('div');
      if (countDisplay.textContent.includes('Count: 42')) {
        pass('Counter maintains and displays internal state correctly');
      } else {
        fail(`Counter does not display the expected state. Expected 'Count: 42' but found '${countDisplay.textContent}'`);
      }
    } else {
      fail(`Initial counter state is not 0, found: ${counter.count}`);
    }
  }
};