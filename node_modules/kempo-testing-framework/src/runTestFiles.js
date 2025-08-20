import findTests from './findTests.js';
import runNodeTests from './runTests.js';
import runBrowserTests from './runBrowserTests.js';
import path from 'path';

/**
 * Runs test files and returns results without logging
 * @param {Object} options - Configuration options
 * @param {string} options.suiteFilter - Filter for test suites
 * @param {string} options.testFilter - Filter for individual tests
 * @param {boolean} options.shouldRunBrowser - Whether to run browser tests
 * @param {boolean} options.shouldRunNode - Whether to run node tests
 * @param {boolean} options.showBrowser - Whether to show browser during tests
 * @param {number} options.port - Port for browser tests
 * @param {number} options.logLevel - Log level for browser tests
 * @param {number} options.delayMs - Optional delay in ms to apply for browser runs
 * @param {Function} options.onNodeTestStart - Callback when a node test starts
 * @param {Function} options.onBrowserTestStart - Callback when a browser test starts
 * @param {string[]} options.specificFiles - Array of specific test files to run (overrides findTests)
 * @returns {Promise<{nodeResults: Object, browserResults: Object}>}
 */
export default async ({
  suiteFilter = '',
  testFilter = '',
  shouldRunBrowser = true,
  shouldRunNode = true,
  showBrowser = false,
  port = 3000,
  logLevel = 2,
  delayMs = 0,
  onNodeTestStart,
  onBrowserTestStart,
  specificFiles = null
}) => {
  let nodeTests = [];
  let browserTests = [];

  if (specificFiles) {
    // When specific files are provided, use them directly
    for (const file of specificFiles) {
      if (file.endsWith('.node-test.js') && shouldRunNode) {
        nodeTests.push(file);
      } else if (file.endsWith('.browser-test.js') && shouldRunBrowser) {
        browserTests.push(file);
      } else if (file.endsWith('.test.js')) {
        // Generic test files can be both
        if (shouldRunNode) nodeTests.push(file);
        if (shouldRunBrowser) browserTests.push(file);
      }
    }
  } else {
    // Use findTests for discovery
    const result = await findTests(suiteFilter, testFilter, shouldRunBrowser, shouldRunNode);
    nodeTests = result.nodeTests;
    browserTests = result.browserTests;
  }

  /*
   * Node Test Execution
   */
  const nodeResults = {};
  if(nodeTests.length){
    for(const file of nodeTests){
      if(onNodeTestStart) onNodeTestStart(file);
      // Convert forward slashes back to OS-specific path separators for file system operations
      const normalizedFile = file.replace(/\//g, path.sep);
      const module = await import(`file://${path.resolve(process.cwd(), normalizedFile)}`);
      nodeResults[file] = await runNodeTests(module, testFilter);
    }
  }

  /*
   * Browser Test Execution
   */
  const browserResults = {};
  if(browserTests.length){
    for(const testFile of browserTests){
      if(onBrowserTestStart) onBrowserTestStart(testFile);
      browserResults[testFile] = await runBrowserTests({
        testFile,
        filter: testFilter, // Changed from testFilter to filter
        showBrowser,
        port,
        logLevel,
        delayMs
      });
    }
  }

  return {
    nodeResults,
    browserResults
  };
};
