export const gzipSize = async (buf) => {
  const {gzip} = await import('zlib');
  return new Promise((res, rej) => gzip(buf, (e, out) => e ? rej(e) : res(out.length)));
};