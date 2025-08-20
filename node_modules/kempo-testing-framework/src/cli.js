import runTestFiles from './runTestFiles.js';
import LOG_LEVELS from './utils/logLevels.js';

export default async (flags, args) => {
  const [suiteFilter, testFilter] = args;
  
  /*
   * Log Level Configuration
   */
  let logLevel = LOG_LEVELS.NORMAL;
  if (typeof flags.logLevel === 'number' && Number.isFinite(flags.logLevel)) {
    const lvl = Math.max(0, Math.min(4, flags.logLevel));
    logLevel = lvl;
  }
  
  if(logLevel >= LOG_LEVELS.DEBUG){
    console.log('\x1b[90m[Debug] Flags:', flags);
    console.log('[Debug] Args:', args);
    console.log(`[Debug] Log level: ${logLevel}\x1b[0m`);
  }
  
  /*
   * Test Configuration
   */
  const showBrowser = Boolean(flags['show-browser']);
  const runBrowser = Boolean(flags.browser);
  const runNode = Boolean(flags.node);
  const shouldRunBrowser = runBrowser || (!runBrowser && !runNode);
  const shouldRunNode = runNode || (!runBrowser && !runNode);
  const port = flags.port ? parseInt(flags.port, 10) : 3000;
  // Parse delay (milliseconds). Non-numeric or missing => 0
  const delayMs = Number.isFinite(parseInt(flags.delay, 10)) ? Math.max(0, parseInt(flags.delay, 10)) : 0;

  /*
   * Color Configuration
   */
  const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m',
    gray: '\x1b[90m',
    blue: '\x1b[34m'
  };

  /*
   * Test Execution
   */
  const { nodeResults, browserResults } = await runTestFiles({
    suiteFilter,
    testFilter,
    shouldRunBrowser,
    shouldRunNode,
    showBrowser,
    port,
    logLevel,
    delayMs,
    onNodeTestStart: logLevel > LOG_LEVELS.MINIMAL ? (file) => {
      console.log(`${colors.cyan}Running Node test: ${file}${colors.reset}`);
    } : undefined,
    onBrowserTestStart: logLevel > LOG_LEVELS.MINIMAL ? (file) => {
      console.log(`${colors.magenta}Running Browser test: ${file}${colors.reset}`);
    } : undefined
  });
  
  /*
   * Results Display
   */
  if(logLevel >= LOG_LEVELS.SILENT){
    displayResults('Node', nodeResults, logLevel, colors);
    displayResults('Browser', browserResults, logLevel, colors);
    displaySummary(nodeResults, browserResults, colors);
  }
};

const displayResults = (type, results, logLevel, colors) => {
  if(Object.keys(results).length === 0) return;
  
  if(logLevel > LOG_LEVELS.MINIMAL){
    console.log(`\n${colors.bright}=== ${type} Test Results ====${colors.reset}`);
  }
  let hasFailedTests = false;
  if(logLevel === LOG_LEVELS.MINIMAL){
    for(const [_, result] of Object.entries(results)){
      for(const [_, testResult] of Object.entries(result.tests)){
        if(!testResult.passed){
          hasFailedTests = true;
          break;
        }
      }
      if(hasFailedTests) break;
    }
    
    if(hasFailedTests){
      console.log(`\n${colors.red}Failed ${type} Tests:${colors.reset}`);
    }
  }
  
  for(const [file, result] of Object.entries(results)){
    let fileHeaderShown = logLevel > LOG_LEVELS.MINIMAL;
    
    if(logLevel >= LOG_LEVELS.VERBOSE && result.beforeAllLogs?.length){
      if(!fileHeaderShown){
        console.log(`\n${colors.bright}${file}${colors.reset}`);
        fileHeaderShown = true;
      }
      console.log(`${colors.blue}${colors.bright}beforeAll${colors.reset}`);
      result.beforeAllLogs.forEach(log => {
        if(log.level <= logLevel){
          console.log(`  ${colors.blue}${log.message}${colors.reset}`);
        }
      });
    }
    for(const [testName, testResult] of Object.entries(result.tests)){
      
      if(logLevel === LOG_LEVELS.MINIMAL && testResult.passed){
        continue;
      }
      const passStatus = testResult.passed 
        ? `${colors.green}PASS${colors.reset}` 
        : `${colors.red}FAIL${colors.reset}`;
      
      if(!fileHeaderShown){
        console.log(`\n${colors.bright}${file}${colors.reset}`);
        fileHeaderShown = true;
      }
      
      if(logLevel >= LOG_LEVELS.MINIMAL){
        console.log(`  ${passStatus} ${testName}`);
      }
      
      if(logLevel >= LOG_LEVELS.VERBOSE || (!testResult.passed && logLevel >= LOG_LEVELS.NORMAL)){
        if(testResult.logs && testResult.logs.length > 0){
          if(logLevel >= LOG_LEVELS.VERBOSE){
            console.log(`    ${colors.cyan}--Test Logs--${colors.reset}`);
          }
          
          const logsToShow = testResult.logs.filter(log => {
            if(logLevel >= LOG_LEVELS.VERBOSE) return true;
            return log.type !== 'progress' && log.level <= logLevel;
          });
            
          logsToShow.forEach(log => {
            let logColor = colors.gray;
            if(log.type === 'fail') logColor = colors.red;
            if(log.type === 'pass') logColor = colors.green;
            
            console.log(`      ${logColor}${log.message}${colors.reset}`);
          });
        }
      }
    }
    
    if(logLevel >= LOG_LEVELS.VERBOSE && result.afterAllLogs?.length){
      if(!fileHeaderShown){
        console.log(`\n${colors.bright}${file}${colors.reset}`);
        fileHeaderShown = true;
      }
      console.log(`${colors.blue}${colors.bright}afterAll${colors.reset}`);
      result.afterAllLogs.forEach(log => {
        if(log.level <= logLevel){
          console.log(`  ${colors.blue}${log.message}${colors.reset}`);
        }
      });
    }
  }
};

const displaySummary = (nodeResults, browserResults, colors) => {
  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;
  Object.values(nodeResults).forEach(result => {
    Object.values(result.tests || {}).forEach(test => {
      totalTests++;
      if(test.passed) passedTests++;
      else failedTests++;
    });
  });
  Object.values(browserResults).forEach(result => {
    Object.values(result.tests || {}).forEach(test => {
      totalTests++;
      if(test.passed) passedTests++;
      else failedTests++;
    });
  });
  console.log(`\n${colors.bright}=== Test Summary ====${colors.reset}`);
  console.log(`${colors.bright}Total Tests:${colors.reset} ${totalTests}`);
  console.log(`${colors.green}Passed:${colors.reset} ${passedTests}`);
  console.log(`${colors.red}Failed:${colors.reset} ${failedTests}`);
  if(failedTests === 0){
    console.log(`\n${colors.green}${colors.bright}All tests passed!${colors.reset}`);
  } else {
    console.log(`\n${colors.red}${colors.bright}Some tests failed. See details above.${colors.reset}`);
  }
};
