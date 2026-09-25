import defaultConfig from '../src/defaultConfig.js';
import path from 'path';
import { writeFile, mkdir, rm } from 'fs/promises';

/*
  Test Utilities
*/
const createTempConfig = async (config) => {
  const tempDir = path.join(process.cwd(), 'tests', 'temp-config-test');
  await mkdir(tempDir, { recursive: true });
  
  const configPath = path.join(tempDir, 'test.config.js');
  await writeFile(configPath, `export default ${JSON.stringify(config, null, 2)}`);
  
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
export const afterAll = async () => {
  const tempDir = path.join(process.cwd(), 'tests', 'temp-config-test');
  await cleanupTempConfig(tempDir);
};

/*
  Cache Configuration Tests
*/
export default {
  'default cache configuration includes all required fields': async ({pass, fail}) => {
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
    
    pass('Default cache configuration verified');
  },

  'cache can be completely disabled': async ({pass, fail}) => {
    const { tempDir, configPath } = await createTempConfig({
      cache: { enabled: false }
    });
    
    // Import router to test config loading
    const router = await import('../src/router.js');
    const flags = { root: 'docs', config: configPath };
    
    const handler = await router.default(flags, () => {}); // Empty log function
    
    if(handler.moduleCache !== null) {
      await cleanupTempConfig(tempDir);
      throw new Error('cache should be null when disabled');
    }
    
    await cleanupTempConfig(tempDir);
    pass('Cache disable configuration verified');
  },

  'custom cache limits are applied correctly': async ({pass, fail}) => {
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
    
    if(!handler.moduleCache) {
      await cleanupTempConfig(tempDir);
      throw new Error('cache should be enabled');
    }
    
    const stats = handler.getStats();
    if(stats.cache.maxSize !== 25) {
      handler.moduleCache.destroy();
      await cleanupTempConfig(tempDir);
      throw new Error('maxSize not applied');
    }
    
    if(stats.cache.maxMemoryMB !== 10) {
      handler.moduleCache.destroy();
      await cleanupTempConfig(tempDir);
      throw new Error('maxMemoryMB not applied');
    }
    
    if(stats.config.ttlMs !== 120000) {
      handler.moduleCache.destroy();
      await cleanupTempConfig(tempDir);
      throw new Error('ttlMs not applied');
    }
    
    handler.moduleCache.destroy();
    await cleanupTempConfig(tempDir);
    pass('Custom cache configuration verified');
  }
};
