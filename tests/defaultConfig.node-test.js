import defaultConfig from '../src/defaultConfig.js';

export default {
  'defaultConfig contains required fields and types': async ({pass, fail}) => {
    if(typeof defaultConfig !== 'object') return fail('not object');
    if(!defaultConfig.allowedMimes || !defaultConfig.disallowedRegex) return fail('missing keys');
    if(!defaultConfig.routeFiles.includes('GET.js')) return fail('routeFiles missing GET.js');
    if(!defaultConfig.middleware || typeof defaultConfig.middleware !== 'object') return fail('middleware missing');
    
    pass('shape ok');
  }
};
