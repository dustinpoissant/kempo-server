import getFlags from '../src/getFlags.js';

export default {
  'parses long flags with values and booleans': async ({pass, fail}) => {
    const args = ['--port', '8080', '--scan'];
    const flags = getFlags(args, {port: 3000, scan: false});
    try {
      if(flags.port !== '8080') throw new Error('port not parsed');
      if(flags.scan !== true) throw new Error('scan boolean not parsed');
      pass('parsed long flags');
    } catch(e){ fail(e.message); }
  },
  'parses short flags using map and preserves defaults': async ({pass, fail}) => {
    const args = ['-p', '9090', '-s'];
    const flags = getFlags(args, {port: 3000, scan: false}, {p: 'port', s: 'scan'});
    try {
      if(flags.port !== '9090') throw new Error('short mapped value failed');
      if(flags.scan !== true) throw new Error('short mapped boolean failed');
      pass('short flags parsed');
    } catch(e){ fail(e.message); }
  },
  'treats next arg starting with dash as boolean flag': async ({pass, fail}) => {
    const args = ['-l', '-5', 'file'];
    const flags = getFlags(args, {l: 2});
    try {
      if(flags.l !== true) throw new Error('should be boolean true');
      pass('dash after flag -> boolean');
    } catch(e){ fail(e.message); }
  }
};
