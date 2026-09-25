import crypto from 'crypto';
import { GUID } from './frames.js';

/*
  The opening handshake, RFC 6455 section 4. This module only inspects headers and reports a verdict;
  writing the response is the upgrade handler's job.
*/

export const computeAccept = (key) =>
  crypto.createHash('sha1').update(key + GUID).digest('base64');

/*
  Sec-WebSocket-Key is 16 random bytes, base64 encoded. Node's base64 decoder is lenient, so the
  round-trip comparison is what actually rejects a malformed key rather than the byte length alone.
*/
const isValidKey = (key) => {
  if(typeof key !== 'string' || key.length === 0) return false;
  const decoded = Buffer.from(key, 'base64');
  return decoded.length === 16 && decoded.toString('base64') === key;
};

/*
  `Connection` is a comma-separated list of tokens and may carry more than just `Upgrade`, so it is
  matched token-wise rather than compared whole.
*/
const hasUpgradeToken = (value) =>
  (value || '').split(',').some(token => token.trim().toLowerCase() === 'upgrade');

/*
  Origin is validated because the session cookie rides along on the handshake: without this check any
  page anywhere could open a socket that authenticates as the logged-in user (cross-site WebSocket
  hijacking). Unlike fetch, the browser applies no same-origin policy of its own to WebSockets — the
  handshake is not blocked and no CORS preflight happens — so the server is the only place this can
  be caught.

  `allowedOrigins` is null for same-origin only (the default), '*' to allow any, or an array of exact
  origins. A request with no Origin header is allowed unless `requireOrigin` is set: browsers always
  send Origin on a handshake, so the header's absence means a non-browser client (a CLI, a service,
  another server), which is not the threat this check exists for and has no ambient cookies to abuse.
*/
export const isOriginAllowed = (origin, host, { allowedOrigins = null, requireOrigin = false } = {}) => {
  if(!origin) return !requireOrigin;
  if(allowedOrigins === '*') return true;

  if(Array.isArray(allowedOrigins)){
    return allowedOrigins.includes(origin);
  }

  if(!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
};

/*
  Returns { ok: true, accept } or { ok: false, status, headers, message }.
*/
export const validateHandshake = (request, websocketConfig = {}) => {
  const headers = request.headers || {};

  if((request.method || '').toUpperCase() !== 'GET'){
    return { ok: false, status: 400, message: 'WebSocket handshake must use GET' };
  }

  if((headers.upgrade || '').toLowerCase() !== 'websocket'){
    return { ok: false, status: 400, message: 'Missing or invalid Upgrade header' };
  }

  if(!hasUpgradeToken(headers.connection)){
    return { ok: false, status: 400, message: 'Missing or invalid Connection header' };
  }

  /*
    Version is checked before the key so an old client gets the actionable 426 telling it which
    version to speak, rather than a generic 400 about a key it encoded correctly.
  */
  if(headers['sec-websocket-version'] !== '13'){
    return {
      ok: false,
      status: 426,
      headers: { 'Sec-WebSocket-Version': '13' },
      message: 'Unsupported WebSocket version'
    };
  }

  if(!isValidKey(headers['sec-websocket-key'])){
    return { ok: false, status: 400, message: 'Missing or invalid Sec-WebSocket-Key' };
  }

  if(!isOriginAllowed(headers.origin, headers.host, websocketConfig)){
    return { ok: false, status: 403, message: 'Origin not allowed' };
  }

  return { ok: true, accept: computeAccept(headers['sec-websocket-key']) };
};
