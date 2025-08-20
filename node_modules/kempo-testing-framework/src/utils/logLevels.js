export default {
  SILENT: 0,    // No output except final summary
  MINIMAL: 1,   // Only test names and pass/fail status
  NORMAL: 2,    // Test names, status, and logs from failed tests
  VERBOSE: 3,   // All test output including logs from passing tests
  DEBUG: 4      // Everything including framework internals
};
