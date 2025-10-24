export const setEnv = (pairs, fn) => {
  const prev = {};
  Object.keys(pairs).forEach(k => { prev[k] = process.env[k]; process.env[k] = pairs[k]; });
  const restore = () => { Object.keys(pairs).forEach(k => { if(prev[k] === undefined){ delete process.env[k]; } else { process.env[k] = prev[k]; } }); };
  return fn().finally(restore);
};