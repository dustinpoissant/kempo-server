import defaultConfig from '../src/defaultConfig.js';
import path from 'path';
import { writeFile, mkdir, rm } from 'fs/promises';

/*
  Test Utilities
*/
const createTempConfig = async (config) => {
  const tempDir = path.join(process.cwd(), 'tests', 'temp-config-test');
  await mkdir(tempDir, { recursive: true });
  
  const configPath = path.join(tempDir, 'test.config.json');
  await writeFile(configPath, JSON.stringify(config, null, 2));
  
  return { tempDir, configPath };
};

const cleanupTempConfig = async (tempDir) => {
  try {
    await rm(tempDir, { recursive: true });
  } catch(e) {
    // Directory might not exist
  }
};

/*
  Lifecycle Callbacks
*/
export const afterAll = async (log) => {
  log('Cleaning up cache configuration test environment...');
  const tempDir = path.join(process.cwd(), 'tests', 'temp-config-test');
  await cleanupTempConfig(tempDir);
};

/*
  Cache Configuration Tests
*/
export default {
  'default cache configuration includes all required fields': async ({pass, fail, log}) => {
    try {
      const cache = defaultConfig.cache;
      
      if(!cache) throw new Error('cache config missing from defaults');
      if(typeof cache.enabled !== 'boolean') throw new Error('enabled should be boolean');
      if(typeof cache.maxSize !== 'number') throw new Error('maxSize should be number');
      if(typeof cache.maxMemoryMB !== 'number') throw new Error('maxMemoryMB should be number');
      if(typeof cache.ttlMs !== 'number') throw new Error('ttlMs should be number');
      if(typeof cache.maxHeapUsagePercent !== 'number') throw new Error('maxHeapUsagePercent should be number');
      if(typeof cache.memoryCheckInterval !== 'number') throw new Error('memoryCheckInterval should be number');
      if(typeof cache.watchFiles !== 'boolean') throw new Error('watchFiles should be boolean');
      if(typeof cache.enableMemoryMonitoring !== 'boolean') throw new Error('enableMemoryMonitoring should be boolean');
      
      log('✓ Default cache configuration structure valid');
      pass('Default cache configuration verified');
    } catch(e){ fail(e.message); }
  },

  'cache can be completely disabled': async ({pass, fail, log}) => {
    try {
      const { tempDir, configPath } = await createTempConfig({
        cache: { enabled: false }
      });
      
      // Import router to test config loading
      const router = await import('../src/router.js');
      const flags = { root: 'docs', config: configPath };
      
      const handler = await router.default(flags, () => {}); // Empty log function
      
      if(handler.moduleCache !== null) throw new Error('cache should be null when disabled');
      
      await cleanupTempConfig(tempDir);
      log('✓ Cache properly disabled via configuration');
      pass('Cache disable configuration verified');
    } catch(e){ fail(e.message); }
  },

  'custom cache limits are applied correctly': async ({pass, fail, log}) => {
    try {
      const { tempDir, configPath } = await createTempConfig({
        cache: {
          enabled: true,
          maxSize: 25,
          maxMemoryMB: 10,
          ttlMs: 120000
        }
      });
      
      const router = await import('../src/router.js');
      const flags = { root: 'docs', config: configPath };
      
      const handler = await router.default(flags, () => {});
      
      if(!handler.moduleCache) throw new Error('cache should be enabled');
      
      const stats = handler.getStats();
      if(stats.cache.maxSize !== 25) throw new Error('maxSize not applied');
      if(stats.cache.maxMemoryMB !== 10) throw new Error('maxMemoryMB not applied');
      if(stats.config.ttlMs !== 120000) throw new Error('ttlMs not applied');
      
      handler.moduleCache.destroy();
      await cleanupTempConfig(tempDir);
      log('✓ Custom cache limits applied correctly');
      pass('Custom cache configuration verified');
    } catch(e){ fail(e.message); }
  }
};
