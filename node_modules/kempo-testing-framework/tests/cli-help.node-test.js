import { spawn } from 'child_process';

const runWithHelp = (args, timeoutMs = 3000) => new Promise((resolve) => {
  const child = spawn(process.execPath, ['index.js', ...args], {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let out = '';
  let resolved = false;

  const finish = () => {
    if (resolved) return;
    resolved = true;
    try { child.kill('SIGTERM'); } catch {}
    resolve(out);
  };

  child.stdout.on('data', (chunk) => {
    out += chunk.toString();
    // Help should exit quickly, check for help content
    if (out.includes('Kempo Testing Framework') && out.includes('USAGE:')) {
      setTimeout(finish, 50);
    }
  });
  child.stderr.on('data', (chunk) => { out += chunk.toString(); });
  child.on('error', () => finish());
  child.on('exit', () => finish());

  setTimeout(finish, timeoutMs);
});

export default {
  '--help shows help message and exits': async ({ pass, fail }) => {
    const out = await runWithHelp(['--help']);
    const hasHelp = out.includes('Kempo Testing Framework') && 
                   out.includes('USAGE:') && 
                   out.includes('OPTIONS:') &&
                   out.includes('--help');
    const noTestRun = !out.includes('kempo-test flags:') && !out.includes('Test Summary');
    
    if (hasHelp && noTestRun) {
      pass('--help shows help message and exits without running tests');
    } else {
      fail(`Help output incorrect:\nHas help: ${hasHelp}\nNo test run: ${noTestRun}\nOutput:\n${out}`);
    }
  },
  '-h shows help message and exits': async ({ pass, fail }) => {
    const out = await runWithHelp(['-h']);
    const hasHelp = out.includes('Kempo Testing Framework') && 
                   out.includes('USAGE:') && 
                   out.includes('OPTIONS:') &&
                   out.includes('--help');
    const noTestRun = !out.includes('kempo-test flags:') && !out.includes('Test Summary');
    
    if (hasHelp && noTestRun) {
      pass('-h shows help message and exits without running tests');
    } else {
      fail(`Help output incorrect:\nHas help: ${hasHelp}\nNo test run: ${noTestRun}\nOutput:\n${out}`);
    }
  }
};
