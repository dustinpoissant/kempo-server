export const startNode = async (args, options = {}) => {
  const {spawn} = await import('child_process');
  const child = spawn(process.execPath, args, {stdio: ['ignore', 'pipe', 'pipe'], ...options});
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  return child;
};