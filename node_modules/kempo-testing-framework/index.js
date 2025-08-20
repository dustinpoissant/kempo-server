#!/usr/bin/env node

/*
 * CLI Flag Mapping
 */
const shortFlagMap = {
    'b': 'browser',
    'n': 'node',
    'l': 'log-level',
    'd': 'delay',
    'p': 'port',
    'g': 'gui',
    'w': 'show-browser',
    'h': 'help'
};

/*
 * Argument Processing
 */
const args = process.argv.slice(2);
const flags = {};
const remainingArgs = [];

// Define which flags take values vs booleans
const valueFlags = new Set(['log-level', 'delay', 'port']);
const booleanFlags = new Set(['browser', 'node', 'gui', 'show-browser', 'help', 'debug-flags']);

for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    // Long flags: --flag or --flag=value
    if (arg.startsWith('--')) {
        const eqIdx = arg.indexOf('=');
        let name = '';
        let value = undefined;
        if (eqIdx !== -1) {
            name = arg.slice(2, eqIdx);
            value = arg.slice(eqIdx + 1);
        } else {
            name = arg.slice(2);
        }

        // Normalize short form if someone passed unknown name
        const flagName = shortFlagMap[name] || name;

        if (valueFlags.has(flagName)) {
            if (value !== undefined) {
                flags[flagName] = value;
            } else if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
                flags[flagName] = args[i + 1];
                i++; // consume the value
            } else {
                // No value provided; set true to allow downstream defaults
                flags[flagName] = true;
            }
        } else {
            // Boolean-style flag; never consume next token
            flags[flagName] = true;
        }
        continue;
    }

    // Short flags: -x (single). We don't support bundling like -bn
    if (arg.startsWith('-') && arg.length > 1) {
        const content = arg.slice(1);
        const eqIdx = content.indexOf('=');
        let short = content;
        let attachedValue = undefined;
        if (eqIdx !== -1) {
            short = content.slice(0, eqIdx);
            attachedValue = content.slice(eqIdx + 1);
        }
        const flagName = shortFlagMap[short] || short;

        if (valueFlags.has(flagName)) {
            if (attachedValue !== undefined) {
                flags[flagName] = attachedValue;
            } else if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
                flags[flagName] = args[i + 1];
                i++; // consume the value
            } else {
                flags[flagName] = true; // allow downstream defaults
            }
        } else {
            // Boolean-style flag; never consume next token; ignore any attached value
            flags[flagName] = true;
        }
        continue;
    }

    // Positional arg (suite/test filters)
    remainingArgs.push(arg);
}

// Normalize --log-level/-l to numeric flags.logLevel (0-4)
if (Object.prototype.hasOwnProperty.call(flags, 'log-level')) {
    const raw = String(flags['log-level']).toLowerCase();
    const map = {
        '0': 0, '1': 1, '2': 2, '3': 3, '4': 4,
        'silent': 0, 's': 0,
        'minimal': 1, 'm': 1,
        'normal': 2, 'n': 2,
        'verbose': 3, 'v': 3,
        'debug': 4, 'd': 4,
    };
    const val = Object.prototype.hasOwnProperty.call(map, raw) ? map[raw] : Number(raw);
    const level = Number.isFinite(val) && val >= 0 && val <= 4 ? val : 2;
    flags.logLevel = level;
    delete flags['log-level'];
}

/*
 * Help Display
 */
if (flags.help || flags.h) {
    console.log(`
Kempo Testing Framework

USAGE:
  kempo-test [OPTIONS] [SUITE_FILTER] [TEST_FILTER]

OPTIONS:
  -h, --help              Show this help message and exit
  -b, --browser           Run only browser tests
  -n, --node              Run only node tests
  -l, --log-level LEVEL   Set log level (0-4 or silent/minimal/normal/verbose/debug)
  -d, --delay MS          Add delay between tests in milliseconds
  -p, --port PORT         Set port for test server (default: 3000)
  -g, --gui               Launch GUI mode
  -w, --show-browser      Show browser window during tests

ARGUMENTS:
  SUITE_FILTER           Filter test suites by name
  TEST_FILTER            Filter individual tests by name

EXAMPLES:
  kempo-test                    # Run all tests
  kempo-test --browser          # Run only browser tests
  kempo-test -l verbose         # Run with verbose logging
  kempo-test --gui              # Launch GUI mode
  kempo-test myComponent        # Run tests for 'myComponent' suite
  kempo-test myComponent myTest # Run specific test in specific suite
`);
    process.exit(0);
}

/*
 * Debug Flags (for testing only)
 */
if (flags['debug-flags']) {
    console.log('kempo-test flags:', flags);
}

/*
 * Mode Selection and Execution
 */
if (flags.gui) {
    const { default: gui } = await import('./src/gui.js');
    await gui(flags, remainingArgs);
} else {
    const { default: cli } = await import('./src/cli.js');
    await cli(flags, remainingArgs);
}
