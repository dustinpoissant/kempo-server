import { spawn } from 'child_process';

const stripAnsi = (s) => s.replace(/\x1b\[[0-9;]*m/g, '');

const run = (args, timeoutMs = 8000) => new Promise((resolve) => {
  const child = spawn(process.execPath, ['index.js', ...args], {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let out = '';
  let resolved = false;
  const done = () => { if (!resolved) { resolved = true; try { child.kill('SIGTERM'); } catch {} resolve(out); } };
  child.stdout.on('data', c => { out += c.toString(); });
  child.stderr.on('data', c => { out += c.toString(); });
  child.on('exit', done);
  child.on('error', done);
  setTimeout(done, timeoutMs);
});

export default {
  'debug level prints debug preamble': async ({ pass, fail }) => {
    // Pass suite filter as positional arg so it isn't consumed as a value for -n
    const out = await run(['-l', 'debug', 'example']);
    const txt = stripAnsi(out);
    const ok = txt.includes('[Debug] Flags:') && txt.includes('[Debug] Args:') && txt.includes('[Debug] Log level: 4');
  ok ? pass('CLI debug level printed expected debug preamble') : fail(`CLI output missing debug preamble:\n${out}`);
  },
  'minimal level omits beforeAll sections': async ({ pass, fail }) => {
    const out = await run(['-l', 'minimal', 'example']);
    const txt = stripAnsi(out);
    const ok = !/beforeAll/.test(txt);
  ok ? pass('Minimal log level omitted beforeAll sections') : fail(`Output contained beforeAll unexpectedly:\n${out}`);
  },
  'verbose shows pass lines for passing tests': async ({ pass, fail }) => {
    const out = await run(['-l', 'verbose', 'example']);
    const txt = stripAnsi(out);
    const ok = /PASS\s+should handle basic string operations/.test(txt);
  ok ? pass('Verbose level printed PASS lines for passing tests') : fail(`Verbose output missing PASS lines:\n${out}`);
  }
};
