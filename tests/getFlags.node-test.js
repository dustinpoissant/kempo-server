import getFlags from '../src/getFlags.js';

export default {
  'parses long flags with values and booleans': async ({pass, fail}) => {
    const args = ['--port', '8080', '--verbose'];
    const flags = getFlags(args, {port: 3000, verbose: false});
    
    if(flags.port !== '8080') return fail('port not parsed');
    if(flags.verbose !== true) return fail('verbose boolean not parsed');
    
    pass('parsed long flags');
  },
  'parses short flags using map and preserves defaults': async ({pass, fail}) => {
    const args = ['-p', '9090', '-v'];
    const flags = getFlags(args, {port: 3000, verbose: false}, {p: 'port', v: 'verbose'});
    
    if(flags.port !== '9090') return fail('short mapped value failed');
    if(flags.verbose !== true) return fail('short mapped boolean failed');
    
    pass('short flags parsed');
  },
  'treats next arg starting with dash as boolean flag': async ({pass, fail}) => {
    const args = ['-l', '-5', 'file'];
    const flags = getFlags(args, {l: 2});
    
    if(flags.l !== true) return fail('should be boolean true');
    
    pass('dash after flag -> boolean');
  }
};
