import extendConfig from '../src/extendConfig.js';
import {withTempDir} from './utils/temp-dir.js';
import {write} from './utils/file-writer.js';
import path from 'path';

export default {
  'a config that extends another changes only what it says': async ({pass, fail}) => {
    await withTempDir(async dir => {
      await write(dir, '.config.json', JSON.stringify({customRoutes: {'/a/**': '../a/**'}, cache: {enabled: true, maxSize: 10}, disallowedRegex: ['x']}));
      const file = path.join(dir, 'dev.config.json');
      const result = await extendConfig({extends: '.config.json', cache: {enabled: false}, dev: {reload: true}}, file);
      if(result.extends !== undefined) return fail('extends is not part of the result');
      if(result.customRoutes?.['/a/**'] !== '../a/**') return fail('the base routes are kept');
      if(result.cache.enabled !== false || result.cache.maxSize !== 10) return fail(`objects merge key by key: ${JSON.stringify(result.cache)}`);
      if(!result.dev.reload) return fail('what the file adds is there');
      if(JSON.stringify(result.disallowedRegex) !== '["x"]') return fail('a list the file does not mention is kept');
      pass('merged');
    });
  },

  'a list in the extending file replaces the base list': async ({pass, fail}) => {
    await withTempDir(async dir => {
      await write(dir, '.config.json', JSON.stringify({disallowedRegex: ['x', 'y']}));
      const result = await extendConfig({extends: '.config.json', disallowedRegex: ['z']}, path.join(dir, 'dev.config.json'));
      if(JSON.stringify(result.disallowedRegex) !== '["z"]') return fail(`got ${JSON.stringify(result.disallowedRegex)}`);
      pass('replaced');
    });
  },

  'a chain of files works and a loop is refused': async ({pass, fail}) => {
    await withTempDir(async dir => {
      await write(dir, 'a.config.json', JSON.stringify({one: 1, two: 1}));
      await write(dir, 'b.config.json', JSON.stringify({extends: 'a.config.json', two: 2}));
      const chained = await extendConfig({extends: 'b.config.json', three: 3}, path.join(dir, 'c.config.json'));
      if(chained.one !== 1 || chained.two !== 2 || chained.three !== 3) return fail(`got ${JSON.stringify(chained)}`);
      await write(dir, 'loop.config.json', JSON.stringify({extends: 'loop.config.json'}));
      try {
        await extendConfig({extends: 'loop.config.json'}, path.join(dir, 'loop.config.json'));
        return fail('a file that extends itself is refused');
      } catch(error) {
        if(!/loop/.test(error.message)) return fail(error.message);
      }
      pass('chain and loop');
    });
  },

  'a config with no extends is returned as it is': async ({pass, fail}) => {
    const config = {a: 1};
    if(await extendConfig(config, '/nowhere/.config.json') !== config) return fail('the same object');
    pass('unchanged');
  },
};
