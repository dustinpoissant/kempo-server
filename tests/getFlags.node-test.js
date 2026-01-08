import getFlags from '../src/getFlags.js';

export default {
  'parses long flags with values and booleans': async ({pass, fail}) => {
    const args = ['--port', '8080', '--rescan'];
    const flags = getFlags(args, {port: 3000, rescan: false});
    
    if(flags.port !== '8080') return fail('port not parsed');
    if(flags.rescan !== true) return fail('rescan boolean not parsed');
    
    pass('parsed long flags');
  },
  'parses short flags using map and preserves defaults': async ({pass, fail}) => {
    const args = ['-p', '9090', '-s'];
    const flags = getFlags(args, {port: 3000, rescan: false}, {p: 'port', s: 'rescan'});
    
    if(flags.port !== '9090') return fail('short mapped value failed');
    if(flags.rescan !== true) return fail('short mapped boolean failed');
    
    pass('short flags parsed');
  },
  'treats next arg starting with dash as boolean flag': async ({pass, fail}) => {
    const args = ['-l', '-5', 'file'];
    const flags = getFlags(args, {l: 2});
    
    if(flags.l !== true) return fail('should be boolean true');
    
    pass('dash after flag -> boolean');
  }
};
