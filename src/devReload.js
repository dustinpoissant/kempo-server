import { register } from 'module';
import { MessageChannel } from 'worker_threads';
import { watch, readdirSync, lstatSync, realpathSync, readFileSync } from 'fs';
import path from 'path';

/*
  Dev reload: with `"dev": { "reload": true }` in the config, a change to a server file takes effect on the next
  request, with no restart. A route file is always loaded fresh, but what it imports (utilities, schema, other
  packages' code) is loaded once per process; this loads those again after a file changes.

    reload          turn it on (default false)
    ignorePackages  packages that keep their one copy, because they hold state that must not start over
                    (default kempo, kempo-server, kempo-ui, kempo-css)
    watch           more folders to watch, besides the project and the packages linked into node_modules

  What is watched: the project folder and every package linked into node_modules (a checkout used with `npm link` or
  a `file:` dependency). Packages installed from the registry are left alone, like node_modules, and .git.
*/
const DEFAULT_IGNORED_PACKAGES = ['kempo', 'kempo-server', 'kempo-ui', 'kempo-css'];
const SERVER_FILE = /\.(m?js|json)$/;
const SKIPPED = /(^|[\\/])(node_modules|\.git)([\\/]|$)/;

/* The real folders of the packages linked into node_modules (symbolic links and junctions), except the ones that are left alone. */
const linkedPackages = (nodeModules, ignored) => {
  const found = [];
  const look = folder => {
    for(const entry of readdirSync(folder)){
      const full = path.join(folder, entry);
      if(entry.startsWith('@')){
        look(full);
      } else if(lstatSync(full).isSymbolicLink()){
        const real = realpathSync(full);
        let name = '';
        try {
          name = JSON.parse(readFileSync(path.join(real, 'package.json'), 'utf8')).name;
        } catch { /* not a package */ }
        if(!ignored.includes(name)) found.push(real);
      }
    }
  };
  try {
    look(nodeModules);
  } catch { /* no node_modules */ }
  return found;
};

export default async ({ config, log }) => {
  const dev = config.dev ?? {};
  if(!dev.reload) return;

  const { port1, port2 } = new MessageChannel();
  register('./devLoader.js', { parentURL: import.meta.url, data: { port: port2, ignore: dev.ignorePackages ?? DEFAULT_IGNORED_PACKAGES }, transferList: [port2] });

  /* Code that remembers what it loaded (kempo's hook handlers) reads this to know it is out of date. */
  globalThis.kempoDevGeneration = 0;

  let timer = null;
  const changed = (base, file) => {
    if(!file || SKIPPED.test(file) || !SERVER_FILE.test(file)) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      globalThis.kempoDevGeneration++;
      port1.postMessage('changed');
      log(`Dev reload: ${path.join(base, file)} changed`, 2);
    }, 50);
  };

  /* Each folder of a tree on its own, so node_modules and .git are never walked. */
  const watchTree = base => {
    watch(base, (event, file) => changed(base, file));
    for(const entry of readdirSync(base, { withFileTypes: true })){
      if(entry.isDirectory() && !SKIPPED.test(entry.name)) watch(path.join(base, entry.name), { recursive: true }, (event, file) => changed(path.join(base, entry.name), file));
    }
  };

  const folders = new Set([process.cwd(), ...linkedPackages(path.join(process.cwd(), 'node_modules'), dev.ignorePackages ?? DEFAULT_IGNORED_PACKAGES), ...(dev.watch ?? []).map(folder => path.resolve(folder))]);
  folders.forEach(watchTree);
  log(`Dev reload: watching ${folders.size} folder${folders.size === 1 ? '' : 's'} for server file changes`, 2);
};
