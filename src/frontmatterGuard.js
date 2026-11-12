import { stripFrontmatter } from './templating/frontmatter.js';

/*
  Frontmatter Guard

  Custom middleware writes its own responses, so nothing kempo-server renders passes through them. A request for a
  `.page.html` URL is a request for a page's source, and that source starts with its frontmatter, which is for the author
  and the site's own tooling. This wraps one custom middleware and, for such a URL, holds back what the middleware writes
  until the response is complete, then drops the frontmatter from it.

  It is active only while that middleware can write. Once the middleware calls next() the request belongs to
  kempo-server's own routing, which never writes frontmatter, and the wrapper steps aside.
*/
const toBuffer = (chunk, encoding) => typeof chunk === 'string' ? Buffer.from(chunk, typeof encoding === 'string' ? encoding : 'utf8') : Buffer.from(chunk);

export default middleware => async (req, res, next) => {
  const pathname = String(req.url || '').split('?')[0];
  let decoded = pathname;
  try {
    decoded = decodeURIComponent(pathname);
  } catch { /* a path that cannot be decoded is matched as it was sent */ }
  if(!/\.page\.html$/i.test(decoded)) return middleware(req, res, next);

  /*
    Both objects are guarded: the enhanced response binds the raw response's methods when it is made, so a method put on the
    raw one afterwards is never reached by middleware that writes through the enhanced one, and the helpers on the enhanced
    one (send, html, json) reach the raw one. Both share one buffer.
  */
  const raw = res._originalResponse || res;
  const targets = res === raw ? [raw] : [raw, res];
  const saved = targets.map(target => ({ writeHead: target.writeHead, write: target.write, end: target.end }));
  const chunks = [];

  const release = () => {
    targets.forEach((target, index) => Object.assign(target, saved[index]));
    if(chunks.length) saved[0].write.call(raw, Buffer.concat(chunks.splice(0)));
  };

  /*
    writeHead would send the headers now, before the body can be changed, so it only records them: the status and headers
    go out with the first write, and Content-Length can still be corrected.
  */
  const writeHead = (status, ...rest) => {
    raw.statusCode = status;
    if(typeof rest[0] === 'string') raw.statusMessage = rest[0];
    const headers = rest.find(arg => arg && typeof arg === 'object');

    // Node takes headers as an object, as [name, value] pairs, or as one flat list; flat() makes the last two the same list
    if(Array.isArray(headers)) headers.flat().forEach((value, index, all) => {
      if(index % 2 === 0) raw.setHeader(value, all[index + 1]);
    });
    else Object.entries(headers || {}).forEach(([name, value]) => raw.setHeader(name, value));
    return res;
  };

  const write = (chunk, encoding, callback) => {
    if(typeof encoding === 'function') [callback, encoding] = [encoding, undefined];
    if(chunk !== undefined && chunk !== null) chunks.push(toBuffer(chunk, encoding));
    if(callback) process.nextTick(callback);
    return true;
  };

  const end = (chunk, encoding, callback) => {
    if(typeof chunk === 'function') [callback, chunk] = [chunk, undefined];
    else if(typeof encoding === 'function') [callback, encoding] = [encoding, undefined];
    if(chunk !== undefined && chunk !== null) chunks.push(toBuffer(chunk, encoding));
    const body = Buffer.concat(chunks.splice(0));
    const encoded = raw.getHeader('content-encoding');
    const readable = !(encoded && encoded !== 'identity') && !raw.getHeader('content-range');

    // A body that is compressed or partial cannot be read here, and one that is unchanged is sent as the bytes it was, never as decoded text
    const text = readable ? body.toString('utf8') : null;
    const stripped = readable ? stripFrontmatter(text) : null;
    const result = readable && stripped !== text ? Buffer.from(stripped, 'utf8') : body;

    release();
    if(result !== body && raw.getHeader('content-length') !== undefined) raw.setHeader('Content-Length', result.length);
    return saved[0].end.call(raw, result, ...(callback ? [callback] : []));
  };

  targets.forEach(target => Object.assign(target, { writeHead, write, end }));
  return middleware(req, res, () => {
    release();
    return next();
  });
};
