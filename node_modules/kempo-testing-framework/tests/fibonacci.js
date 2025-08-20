/**
 * Fibonacci sequence utility functions
 * Works in both Node.js and browser environments
 */

/**
 * Generate the nth Fibonacci number (0-indexed)
 * @param {number} n - The position in the sequence (0-indexed)
 * @returns {number} The Fibonacci number at position n
 * @throws {Error} If n is negative or not a number
 */
const fibonacci = (n) => {
  if(typeof n !== 'number' || !Number.isInteger(n)) {
    throw new Error('Input must be a non-negative integer');
  }
  
  if(n < 0) {
    throw new Error('Input must be a non-negative integer');
  }
  
  if(n === 0) return 0;
  if(n === 1) return 1;
  
  let a = 0;
  let b = 1;
  
  for(let i = 2; i <= n; i++) {
    const temp = a + b;
    a = b;
    b = temp;
  }
  
  return b;
};

/**
 * Generate a Fibonacci sequence up to n terms
 * @param {number} count - Number of terms to generate
 * @returns {number[]} Array containing the Fibonacci sequence
 * @throws {Error} If count is negative or not a number
 */
const fibonacciSequence = (count) => {
  if(typeof count !== 'number' || !Number.isInteger(count)) {
    throw new Error('Count must be a non-negative integer');
  }
  
  if(count < 0) {
    throw new Error('Count must be a non-negative integer');
  }
  
  if(count === 0) return [];
  if(count === 1) return [0];
  if(count === 2) return [0, 1];
  
  const sequence = [0, 1];
  
  for(let i = 2; i < count; i++) {
    sequence.push(sequence[i - 1] + sequence[i - 2]);
  }
  
  return sequence;
};

/**
 * Check if a number is a Fibonacci number
 * @param {number} num - The number to check
 * @returns {boolean} True if the number is in the Fibonacci sequence
 */
const isFibonacci = (num) => {
  if(typeof num !== 'number' || !Number.isInteger(num) || num < 0) {
    return false;
  }
  
  if(num === 0 || num === 1) return true;
  
  let a = 0;
  let b = 1;
  
  while (b < num) {
    const temp = a + b;
    a = b;
    b = temp;
  }
  
  return b === num;
};

export default {
  fibonacci,
  fibonacciSequence,
  isFibonacci
};
