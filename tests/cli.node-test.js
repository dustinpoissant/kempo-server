import { getArgs } from '../utils/cli.js';

export default {
  'parses long flags with space-separated values': async ({pass, fail}) => {
    const argv = ['node', 'script.js', '--name', 'John', '--age', '30'];
    const args = getArgs({}, argv);

    if (args.name !== 'John') return fail('name not parsed');
    if (args.age !== '30') return fail('age not parsed');

    pass('space-separated values work');
  },

  'parses long flags with equals-separated values': async ({pass, fail}) => {
    const argv = ['node', 'script.js', '--name=John', '--age=30'];
    const args = getArgs({}, argv);

    if (args.name !== 'John') return fail('name not parsed with equals');
    if (args.age !== '30') return fail('age not parsed with equals');

    pass('equals-separated values work');
  },

  'parses short flags with equals-separated values and mapping': async ({pass, fail}) => {
    const argv = ['node', 'script.js', '-n=John', '-a=30'];
    const args = getArgs({ n: 'name', a: 'age' }, argv);

    if (args.name !== 'John') return fail('short name not parsed with equals');
    if (args.age !== '30') return fail('short age not parsed with equals');

    pass('short flags with equals and mapping work');
  },

  'handles mixed formats': async ({pass, fail}) => {
    const argv = ['node', 'script.js', '--name=John', '-a', '30', '--verbose'];
    const args = getArgs({ a: 'age' }, argv);

    if (args.name !== 'John') return fail('equals format failed');
    if (args.age !== '30') return fail('space format failed');
    if (args.verbose !== true) return fail('boolean flag failed');

    pass('mixed formats work');
  },

  'handles values with equals signs': async ({pass, fail}) => {
    const argv = ['node', 'script.js', '--url=https://example.com?param=value'];
    const args = getArgs({}, argv);

    if (args.url !== 'https://example.com?param=value') return fail('value with equals not handled');

    pass('values with equals work');
  },

  'converts string true and false to booleans': async ({pass, fail}) => {
    const argv = ['node', 'script.js', '--enabled=true', '--disabled=false', '--name=John'];
    const args = getArgs({}, argv);

    if (args.enabled !== true) return fail('true not converted to boolean');
    if (args.disabled !== false) return fail('false not converted to boolean');
    if (args.name !== 'John') return fail('string value not handled');

    pass('string booleans converted correctly');
  }
};