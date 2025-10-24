import defaultConfig from '../src/defaultConfig.js';

export default {
  'defaultConfig contains required fields and types': async ({pass, fail}) => {
    if(typeof defaultConfig !== 'object') return fail('not object');
  if(!defaultConfig.allowedMimes || !defaultConfig.disallowedRegex) return fail('missing keys');
  // Check for mime and encoding properties in a few extensions
  if(!defaultConfig.allowedMimes.html || defaultConfig.allowedMimes.html.mime !== 'text/html' || defaultConfig.allowedMimes.html.encoding !== 'utf8') return fail('html mime/encoding incorrect');
  if(!defaultConfig.allowedMimes.png || defaultConfig.allowedMimes.png.mime !== 'image/png' || defaultConfig.allowedMimes.png.encoding !== 'binary') return fail('png mime/encoding incorrect');
    if(!defaultConfig.routeFiles.includes('GET.js')) return fail('routeFiles missing GET.js');
    if(!defaultConfig.middleware || typeof defaultConfig.middleware !== 'object') return fail('middleware missing');
    
    pass('shape ok');
  }
};
