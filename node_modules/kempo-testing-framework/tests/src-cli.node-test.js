import { spawn } from 'child_process';

const stripAnsi = (s) => s.replace(/\x1b\[[0-9;]*m/g, '');

const run = (args, timeoutMs = 10000) => new Promise((resolve) => {
  const child = spawn(process.execPath, ['index.js', ...args], {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let out = '';
  const finish = () => { try { child.kill('SIGTERM'); } catch {} resolve(out); };
  child.stdout.on('data', c => { out += c.toString(); });
  child.stderr.on('data', c => { out += c.toString(); });
  child.on('exit', finish);
  setTimeout(finish, timeoutMs);
});

export default {
  'passes delay to browser runner and prints delay logs in verbose': async ({ pass, fail }) => {
    const out = await run(['-b', '-w', '-l', 'verbose', '-d', '200', 'counter']);
    const txt = stripAnsi(out);
    const ok = /Applying pre-test browser delay: 200ms/.test(txt) && /Applying post-test browser delay: 200ms/.test(txt);
  ok ? pass('CLI printed verbose delay logs for browser run') : fail(`Unexpected CLI output:\n${out}`);
  },
  'node-only ignores delay and still runs filtered tests': async ({ pass, fail }) => {
    const out = await run(['-n', '-l', 'minimal', 'example']);
    const txt = stripAnsi(out);
    const hasSummary = /=== Test Summary ===/.test(txt) && /Total Tests:\s*\d+/.test(txt);
    const noBrowser = !/=== Browser Test Results ===/.test(txt) && !/Running Browser test:/.test(txt);
  hasSummary && noBrowser ? pass('Node-only run produced summary without browser section') : fail(`Unexpected CLI output:\n${out}`);
  }
};
