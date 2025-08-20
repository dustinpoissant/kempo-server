// Import the fibonacci utility functions
import fibonacciUtils from './fibonacci.js';

const { fibonacci, fibonacciSequence, isFibonacci } = fibonacciUtils;

/*
  Lifecycle Callbacks
*/
export const beforeAll = async (log) => {
  log('Setting up Fibonacci utility tests...');
};

export const beforeEach = async (log) => {
  log('Running Fibonacci test');
};

export const afterEach = async (log) => {
  log('Fibonacci test completed');
};

export const afterAll = async (log) => {
  log('Fibonacci utility tests finished');
};

/*
  Test Cases
*/
export default {
  'fibonacci - should return correct values for base cases': async ({pass, fail, log}) => {
    try {
      const testCases = [
        { input: 0, expected: 0 },
        { input: 1, expected: 1 },
        { input: 2, expected: 1 }
      ];
      
      for(const { input, expected } of testCases) {
        const result = fibonacci(input);
        if(result !== expected) {
          fail(`fibonacci(${input}) expected ${expected}, got ${result}`);
          return;
        }
        log(`✓ fibonacci(${input}) = ${result}`);
      }
      
      pass('Base cases work correctly');
    } catch (error) {
      fail(`Unexpected error: ${error.message}`);
    }
  },

  'fibonacci - should calculate correct sequence values': async ({pass, fail, log}) => {
    try {
      const testCases = [
        { input: 3, expected: 2 },
        { input: 4, expected: 3 },
        { input: 5, expected: 5 },
        { input: 6, expected: 8 },
        { input: 7, expected: 13 },
        { input: 8, expected: 21 },
        { input: 10, expected: 55 }
      ];
      
      for(const { input, expected } of testCases) {
        const result = fibonacci(input);
        if(result !== expected) {
          fail(`fibonacci(${input}) expected ${expected}, got ${result}`);
          return;
        }
        log(`✓ fibonacci(${input}) = ${result}`);
      }
      
      pass('Sequence calculations are correct');
    } catch (error) {
      fail(`Unexpected error: ${error.message}`);
    }
  },

  'fibonacci - should handle large numbers efficiently': async ({pass, fail, log}) => {
    try {
      const result = fibonacci(20);
      const expected = 6765;
      
      if(result !== expected) {
        fail(`fibonacci(20) expected ${expected}, got ${result}`);
        return;
      }
      
      log(`✓ fibonacci(20) = ${result}`);
      pass('Large number calculation works efficiently');
    } catch (error) {
      fail(`Unexpected error: ${error.message}`);
    }
  },

  'fibonacci - should throw error for negative numbers': async ({pass, fail, log}) => {
    try {
      fibonacci(-1);
      fail('Should have thrown an error for negative input');
    } catch (error) {
      if(error.message === 'Input must be a non-negative integer') {
        log('✓ Properly rejects negative numbers');
        pass('Input validation for negative numbers works');
      } else {
        fail(`Expected specific error message, got: ${error.message}`);
      }
    }
  },

  'fibonacci - should throw error for non-integer inputs': async ({pass, fail, log}) => {
    try {
      const testInputs = [3.14, 'string', null, undefined, {}];
      
      for(const input of testInputs) {
        try {
          fibonacci(input);
          fail(`Should have thrown an error for input: ${input}`);
          return;
        } catch (error) {
          if(error.message === 'Input must be a non-negative integer') {
            log(`✓ Properly rejects invalid input: ${input}`);
          } else {
            fail(`Expected specific error message for ${input}, got: ${error.message}`);
            return;
          }
        }
      }
      
      pass('Input validation for non-integers works');
    } catch (error) {
      fail(`Unexpected error: ${error.message}`);
    }
  },

  'fibonacciSequence - should return empty array for count 0': async ({pass, fail, log}) => {
    try {
      const result = fibonacciSequence(0);
      
      if(!Array.isArray(result) || result.length !== 0) {
        fail(`Expected empty array, got: ${JSON.stringify(result)}`);
        return;
      }
      
      log('✓ Returns empty array for count 0');
      pass('Empty sequence handling works');
    } catch (error) {
      fail(`Unexpected error: ${error.message}`);
    }
  },

  'fibonacciSequence - should return correct sequences': async ({pass, fail, log}) => {
    try {
      const testCases = [
        { count: 1, expected: [0] },
        { count: 2, expected: [0, 1] },
        { count: 5, expected: [0, 1, 1, 2, 3] },
        { count: 8, expected: [0, 1, 1, 2, 3, 5, 8, 13] }
      ];
      
      for(const { count, expected } of testCases) {
        const result = fibonacciSequence(count);
        
        if(JSON.stringify(result) !== JSON.stringify(expected)) {
          fail(`fibonacciSequence(${count}) expected ${JSON.stringify(expected)}, got ${JSON.stringify(result)}`);
          return;
        }
        
        log(`✓ fibonacciSequence(${count}) = [${result.join(', ')}]`);
      }
      
      pass('Sequence generation works correctly');
    } catch (error) {
      fail(`Unexpected error: ${error.message}`);
    }
  },

  'fibonacciSequence - should validate input parameters': async ({pass, fail, log}) => {
    try {
      const invalidInputs = [-1, 3.14, 'string', null];
      
      for(const input of invalidInputs) {
        try {
          fibonacciSequence(input);
          fail(`Should have thrown an error for input: ${input}`);
          return;
        } catch (error) {
          if(error.message === 'Count must be a non-negative integer') {
            log(`✓ Properly rejects invalid input: ${input}`);
          } else {
            fail(`Expected specific error message for ${input}, got: ${error.message}`);
            return;
          }
        }
      }
      
      pass('Sequence input validation works');
    } catch (error) {
      fail(`Unexpected error: ${error.message}`);
    }
  },

  'isFibonacci - should correctly identify Fibonacci numbers': async ({pass, fail, log}) => {
    try {
      const fibonacciNumbers = [0, 1, 2, 3, 5, 8, 13, 21, 34, 55];
      const nonFibonacciNumbers = [4, 6, 7, 9, 10, 11, 12, 14, 15, 16];
      
      for(const num of fibonacciNumbers) {
        const result = isFibonacci(num);
        if(!result) {
          fail(`isFibonacci(${num}) should return true, got false`);
          return;
        }
        log(`✓ ${num} is correctly identified as Fibonacci`);
      }
      
      for(const num of nonFibonacciNumbers) {
        const result = isFibonacci(num);
        if(result) {
          fail(`isFibonacci(${num}) should return false, got true`);
          return;
        }
        log(`✓ ${num} is correctly identified as non-Fibonacci`);
      }
      
      pass('Fibonacci number identification works correctly');
    } catch (error) {
      fail(`Unexpected error: ${error.message}`);
    }
  },

  'isFibonacci - should handle edge cases and invalid inputs': async ({pass, fail, log}) => {
    try {
      const invalidInputs = [
        { input: -1, expected: false, desc: 'negative number' },
        { input: 3.14, expected: false, desc: 'decimal number' },
        { input: 'string', expected: false, desc: 'string input' },
        { input: null, expected: false, desc: 'null input' },
        { input: undefined, expected: false, desc: 'undefined input' }
      ];
      
      for(const { input, expected, desc } of invalidInputs) {
        const result = isFibonacci(input);
        if(result !== expected) {
          fail(`isFibonacci(${input}) for ${desc} expected ${expected}, got ${result}`);
          return;
        }
        log(`✓ ${desc} handled correctly`);
      }
      
      pass('Edge case handling works correctly');
    } catch (error) {
      fail(`Unexpected error: ${error.message}`);
    }
  },

  'integration - should work together across all functions': async ({pass, fail, log}) => {
    try {
      // Generate a sequence and verify each number
      const sequence = fibonacciSequence(10);
      log(`Generated sequence: [${sequence.join(', ')}]`);
      
      // Verify each number in the sequence using fibonacci function
      for(let i = 0; i < sequence.length; i++) {
        const expected = fibonacci(i);
        if(sequence[i] !== expected) {
          fail(`Sequence position ${i}: expected ${expected}, got ${sequence[i]}`);
          return;
        }
      }
      
      // Verify each number is identified as Fibonacci
      for(const num of sequence) {
        if(!isFibonacci(num)) {
          fail(`Number ${num} from sequence not identified as Fibonacci`);
          return;
        }
      }
      
      log('✓ All functions work together correctly');
      pass('Integration test passed successfully');
    } catch (error) {
      fail(`Integration test failed: ${error.message}`);
    }
  }
};
