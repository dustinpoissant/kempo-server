// Example Node test file for Kempo Testing Framework
// This demonstrates the basic structure and features

/* Export the optional lifecycle callbacks */
export const beforeAll = async (log) => {
  log('Setting up Node test environment...');
  // Setup that runs once before all tests
}

export const beforeEach = async (log) => {
  log('Setting up for each test');
  // Setup that runs before each individual test
}

export const afterEach = async (log) => {
  log('Cleaning up after each test');
  // Cleanup that runs after each individual test
}

export const afterAll = async (log) => {
  log('Cleaning up Node test environment...');
  // Cleanup that runs once after all tests
}

/* Export the Tests */
export default {
  'should handle basic string operations': async ({pass, fail, log}) => {
    const input = 'hello world';
    const expected = 'HELLO WORLD';
    const result = input.toUpperCase();
    
    log(`Testing string conversion: "${input}" -> "${result}"`);
    
    if (result === expected) {
      log('✓ String conversion works correctly');
      pass('String uppercase conversion test passed');
    } else {
      fail(`Expected "${expected}", got "${result}"`);
    }
  },

  'should validate array operations': async ({pass, fail, log}) => {
    const numbers = [1, 2, 3, 4, 5];
    const doubled = numbers.map(n => n * 2);
    const expected = [2, 4, 6, 8, 10];
    
    log(`Testing array mapping: [${numbers}] -> [${doubled}]`);
    
    if (JSON.stringify(doubled) === JSON.stringify(expected)) {
      log('✓ Array mapping works correctly');
      pass('Array mapping test passed');
    } else {
      fail(`Expected [${expected}], got [${doubled}]`);
    }
  },

  'should handle async operations': async ({pass, fail, log}) => {
    log('Testing async operation...');
    
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    const start = Date.now();
    
    await delay(100);
    
    const elapsed = Date.now() - start;
    log(`Async delay completed in ${elapsed}ms`);
    
    if (elapsed >= 100 && elapsed < 200) {
      log('✓ Async operation timing is correct');
      pass('Async operation test passed');
    } else {
      fail(`Expected delay of ~100ms, got ${elapsed}ms`);
    }
  },

  'should handle error conditions': async ({pass, fail, log}) => {
    log('Testing error handling...');
    
    try {
      JSON.parse('invalid json');
      fail('Should have thrown an error for invalid JSON');
    } catch (error) {
      log(`✓ Caught expected error: ${error.message}`);
      pass('Error handling test passed');
    }
  },

  'should work with Node.js specific features': async ({pass, fail, log}) => {
    // Test Node.js specific functionality
    const process_exists = typeof process !== 'undefined';
    const has_global = typeof global !== 'undefined';
    
    log(`Process object exists: ${process_exists}`);
    log(`Global object available: ${has_global}`);
    
    if (process_exists && has_global) {
      log('✓ Node.js environment detected correctly');
      pass('Node.js environment test passed');
    } else {
      fail('Node.js environment features not available');
    }
  }
};
