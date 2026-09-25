import getFlags from '../src/getFlags.js';

export default {
  'parses long flags with values and booleans': async ({pass, fail}) => {
    const args = ['--port', '8080', '--verbose'];
    const flags = getFlags(args, {port: 3000, verbose: false});
    
    if(flags.port !== '8080') throw new Error('port not parsed');
    if(flags.verbose !== true) throw new Error('verbose boolean not parsed');
    
    pass('parsed long flags');
  },
  'parses short flags using map and preserves defaults': async ({pass, fail}) => {
    const args = ['-p', '9090', '-v'];
    const flags = getFlags(args, {port: 3000, verbose: false}, {p: 'port', v: 'verbose'});
    
    if(flags.port !== '9090') throw new Error('short mapped value failed');
    if(flags.verbose !== true) throw new Error('short mapped boolean failed');
    
    pass('short flags parsed');
  },
  'treats next arg starting with dash as boolean flag': async ({pass, fail}) => {
    const args = ['-l', '-5', 'file'];
    const flags = getFlags(args, {l: 2});
    
    if(flags.l !== true) throw new Error('should be boolean true');
    
    pass('dash after flag -> boolean');
  }
};
