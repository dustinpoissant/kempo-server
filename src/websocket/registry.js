/*
  The set of open sockets, so code outside a WS.js route — an HTTP route, or a kempo (CMS) extension —
  can find and push to connections.

  It hangs off a global keyed by Symbol.for rather than living in module scope because kempo-server can
  legitimately appear more than once in a resolved dependency tree: it is symlinked during local
  development (`npm run link:local`), and a consumer may hoist one copy while a nested dependency
  keeps its own. Module scope is per-copy, so a route registering into copy A and a webhook handler
  reading from copy B would each see an empty set and silently send nothing. A registered symbol is
  process-wide, so every copy shares one set.

  Single process only. There is no cross-process or cross-host fan-out here: behind a load balancer
  with more than one worker, a socket is only reachable from the process that accepted it.
*/

const REGISTRY = Symbol.for('kempo-server.websocket.registry');

if(!globalThis[REGISTRY]){
  globalThis[REGISTRY] = new Set();
}

const registry = () => globalThis[REGISTRY];

export const register = (socket) => { registry().add(socket); };

export const unregister = (socket) => { registry().delete(socket); };

/*
  `path` matches the route path the socket connected on; `filter` receives each socket so a route can
  select on whatever it attached to `socket.data`.
*/
export const sockets = ({ path, filter } = {}) => {
  let found = Array.from(registry());
  if(path !== undefined) found = found.filter(socket => socket.path === path);
  if(filter) found = found.filter(filter);
  return found;
};

// Returns the number of sockets the message was handed to.
export const broadcast = (message, options = {}) => {
  let sent = 0;
  for(const socket of sockets(options)){
    if(socket.send(message)) sent++;
  }
  return sent;
};

export const closeAll = (code, reason) => {
  for(const socket of sockets()){
    socket.close(code, reason);
  }
};

export default { register, unregister, sockets, broadcast, closeAll };
