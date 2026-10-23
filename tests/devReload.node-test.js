import {startNode} from './utils/process.js';
import {randomPort} from './utils/port.js';
import {httpGet} from './utils/http.js';
import {withTempDir} from './utils/temp-dir.js';
import {write} from './utils/file-writer.js';
import path from 'path';
import ensureBuild from './utils/ensure-build.js';

ensureBuild();

const ROUTE = `import helper from '../helper.js';
import kept from '../lib/state.js';
export default async (request, response) => {
  response.status(200).send(helper + kept);
};`;

/*
  A route that imports a helper, served with the given config. Resolves with what the route answers before the helper
  is edited and after, so a test can say whether the edit was picked up without a restart.
*/
const edited = async config => withTempDir(async dir => {
  await write(dir, '.config.json', JSON.stringify(config));
  await write(dir, 'helper.js', "export default 'one';\n");
  await write(dir, 'lib/package.json', JSON.stringify({name: 'kept-package'}));
  await write(dir, 'lib/state.js', "export default 'one';\n");
  await write(dir, 'value/GET.js', ROUTE);
  const port = randomPort();
  const child = await startNode([path.join(process.cwd(), 'dist/index.js'), '-r', '.', '-p', String(port), '-l', '0'], {cwd: dir});
  const get = async () => {
    for(let attempt = 0; attempt < 30; attempt++){
      try {
        const {res, body} = await httpGet(`http://localhost:${port}/value`);
        if(res.statusCode === 200) return body.toString();
      } catch { /* the server is still starting */ }
      await new Promise(resolve => setTimeout(resolve, 150));
    }
    return 'the route never answered 200';
  };
  try {
    const first = await get();
    await write(dir, 'helper.js', "export default 'two';\n");
    await write(dir, 'lib/state.js', "export default 'two';\n");
    await new Promise(resolve => setTimeout(resolve, 600));
    const second = await get();
    return {first, second};
  } finally {
    const exited = new Promise(resolve => child.once('exit', resolve));
    child.kill();
    await exited;
  }
});

export default {
  'without dev reload, what a route imports stays as it was loaded': async ({pass, fail}) => {
    const {first, second} = await edited({});
    if(first !== 'oneone') return fail(`the route should answer oneone, got ${first}`);
    if(second !== 'oneone') return fail(`edited helpers are not loaded again without dev reload, got ${second}`);
    pass('the old helpers are still used');
  },

  'with dev reload, an edited helper is used by the next request': async ({pass, fail}) => {
    const {first, second} = await edited({dev: {reload: true}});
    if(first !== 'oneone') return fail(`the route should answer oneone, got ${first}`);
    if(second !== 'twotwo') return fail(`edited helpers should be loaded again, got ${second}`);
    pass('the edited helpers are used');
  },

  'a package in dev.ignorePackages keeps its one copy while the rest reloads': async ({pass, fail}) => {
    const {second} = await edited({dev: {reload: true, ignorePackages: ['kept-package']}});
    if(second !== 'twoone') return fail(`the project reloads and the kept package does not, got ${second}`);
    pass('only the listed package is left alone');
  },
};
