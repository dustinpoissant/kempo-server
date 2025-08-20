import defaultConfig from '../defaultConfig.js';

export default {
  'defaultConfig contains required fields and types': async ({pass, fail}) => {
    try {
      if(typeof defaultConfig !== 'object') throw new Error('not object');
      if(!defaultConfig.allowedMimes || !defaultConfig.disallowedRegex) throw new Error('missing keys');
      if(!defaultConfig.routeFiles.includes('GET.js')) throw new Error('routeFiles missing GET.js');
      if(!defaultConfig.middleware || typeof defaultConfig.middleware !== 'object') throw new Error('middleware missing');
      pass('shape ok');
    } catch(e){ fail(e.message); }
  }
};
