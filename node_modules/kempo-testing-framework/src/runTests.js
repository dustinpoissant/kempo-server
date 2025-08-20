const wait = ms => new Promise(r => setTimeout(r, ms));

export default async ({
  beforeAll = async () => {},
  beforeEach = async () => {},
  afterEach = async () => {},
  afterAll = async () => {},
  default: tests
} = {}, filter = false, delay = 0) => {
  const testsToRun = filter ? Object.keys(tests).filter(name => name.trim().toLowerCase().includes(filter.trim().toLowerCase())) : Object.keys(tests);
  if(!testsToRun.length) throw new Error('No tests found matching the filter');
  
  /*
   * Test Results Structure
   */
  const results = {
    beforeAllLogs: [],
    tests: {},
    afterAllLogs: []
  };
  
  /*
   * Execute beforeAll Hook
   */
  await beforeAll(message => {
    results.beforeAllLogs.push({
      message,
      type: 'log',
      level: 3
    });
  });
  
  /*
   * Execute Individual Tests
   */
  for (const name of testsToRun) {
    const result = {
      logs: [],
      passed: null
    };
    const log = (message, type = 'log', level = 3) => {
      result.logs.push({
        message,
        type,
        level
      });
    };
    log(`== Starting Test "${name}" ==`, 'progress', 3);
    log('== Before Each ==', 'progress', 3);
    await beforeEach(log);
    await tests[name]({
      log,
      pass: message => {
        result.passed = true;
        log(message, 'pass', 2); // was 3; make visible at NORMAL
      },
      fail: message => {
        result.passed = false;
        log(message, 'fail', 2);
      }
    });
    await afterEach(log);
    log('== After Each ==', 'progress', 3);
    if(!result.passed){ // If the test failed, elevate all logs to a level 2
      result.logs.forEach(log => log.level = 2);
    }
    results.tests[name] = result;
    await wait(delay);
  }
  
  /*
   * Execute afterAll Hook
   */
  await afterAll(message => {
    results.afterAllLogs.push({
      message,
      type: 'log',
      level: 3
    });
  });
  
  return results;
};
