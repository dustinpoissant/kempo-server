import ModuleCache from '../src/moduleCache.js';
import path from 'path';
import { writeFile, unlink, stat, mkdir, rm } from 'fs/promises';

/*
  Test Utilities
*/
const activeCaches = [];

const createTestCache = (config = {}) => {
  const cache = new ModuleCache({
    enableMemoryMonitoring: false, // Always disable to prevent hanging
    watchFiles: false,             // Default to false for most tests
    ...config
  });
  activeCaches.push(cache);
  return cache;
};
const createTempDir = async () => {
  const tempDir = path.join(process.cwd(), 'tests', 'temp-cache-test');
  try {
    await mkdir(tempDir, { recursive: true });
  } catch(e) {
    // Directory might already exist
  }
  return tempDir;
};

const cleanupTempDir = async (tempDir) => {
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
  // Destroy all active caches to clean up timers and watchers
  for(let i = 0; i < activeCaches.length; i++) {
    activeCaches[i].destroy();
  }
  activeCaches.length = 0;
  
  // Give file watchers extra time to fully close
  await new Promise(resolve => setTimeout(resolve, 500));
  
  const tempDir = path.join(process.cwd(), 'tests', 'temp-cache-test');
  await cleanupTempDir(tempDir);
};

/*
  Module Cache Tests
*/
export default {
  'basic LRU functionality works correctly': async ({pass, fail, log}) => {
    const cache = createTestCache({
      maxSize: 2,
      maxMemoryMB: 10,
      ttlMs: 60000,
      watchFiles: false
    });

    const mockStats1 = { mtime: new Date('2023-01-01') };
    const mockStats2 = { mtime: new Date('2023-01-02') };
    const mockStats3 = { mtime: new Date('2023-01-03') };

    cache.set('/test1.js', { default: () => 'test1' }, mockStats1, 1);
    if(cache.cache.size !== 1) {
      cache.destroy();
      return fail('size should be 1');
    }

    cache.set('/test2.js', { default: () => 'test2' }, mockStats2, 1);
    if(cache.cache.size !== 2) {
      cache.destroy();
      return fail('size should be 2');
    }

    cache.set('/test3.js', { default: () => 'test3' }, mockStats3, 1);
    if(cache.cache.size !== 2) {
      cache.destroy();
      return fail('size should still be 2');
    }
    if(cache.get('/test1.js', mockStats1) !== null) {
      cache.destroy();
      return fail('oldest should be evicted');
    }

    cache.destroy();
    pass('LRU functionality verified');
  },

  'TTL expiration invalidates entries': async ({pass, fail, log}) => {
    const cache = createTestCache({
      maxSize: 10,
      ttlMs: 50,
      watchFiles: false
    });

    const mockStats = { mtime: new Date('2023-01-01') };
    cache.set('/test.js', { default: () => 'test' }, mockStats, 1);
    
    if(cache.get('/test.js', mockStats) === null) {
      cache.destroy();
      return fail('should be available immediately');
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    if(cache.get('/test.js', mockStats) !== null) {
      cache.destroy();
      return fail('should be expired');
    }
    
    cache.destroy();
    pass('TTL expiration verified');
  },

  'file modification invalidates cache entry': async ({pass, fail, log}) => {
    const cache = createTestCache({
      maxSize: 10,
      ttlMs: 60000,
      watchFiles: false
    });

    const oldStats = { mtime: new Date('2023-01-01') };
    const newStats = { mtime: new Date('2023-01-02') };
    
    cache.set('/test.js', { default: () => 'test' }, oldStats, 1);
    
    if(cache.get('/test.js', oldStats) === null) {
      cache.destroy();
      return fail('should be available with old stats');
    }
    
    if(cache.get('/test.js', newStats) !== null) {
      cache.destroy();
      return fail('should be invalidated with newer stats');
    }
    
    cache.destroy();
    pass('File modification invalidation verified');
  },

  'memory limit enforcement evicts oldest entries': async ({pass, fail, log}) => {
    const cache = createTestCache({
      maxSize: 100,
      maxMemoryMB: 0.002,
      ttlMs: 60000,
      watchFiles: false
    });

    const mockStats = { mtime: new Date('2023-01-01') };
    
    cache.set('/test1.js', { default: () => 'test1' }, mockStats, 1);
    cache.set('/test2.js', { default: () => 'test2' }, mockStats, 1);
    cache.set('/test3.js', { default: () => 'test3' }, mockStats, 1);
    
    if(cache.get('/test1.js', mockStats) !== null) {
      cache.destroy();
      return fail('first entry should be evicted due to memory limit');
    }
    
    if(cache.get('/test2.js', mockStats) === null) {
      cache.destroy();
      return fail('second entry should still be cached');
    }
    
    if(cache.get('/test3.js', mockStats) === null) {
      cache.destroy();
      return fail('third entry should still be cached');
    }
    
    cache.destroy();
    pass('Memory limit enforcement verified');
  },

  'statistics tracking works correctly': async ({pass, fail, log}) => {
    const cache = createTestCache({
      maxSize: 10,
      watchFiles: false
    });

    const mockStats = { mtime: new Date('2023-01-01') };
    
    if(cache.get('/test.js', mockStats) !== null) {
      cache.destroy();
      return fail('should be cache miss');
    }
    
    if(cache.stats.misses !== 1) {
      cache.destroy();
      return fail('miss count should be 1');
    }
    
    cache.set('/test.js', { default: () => 'test' }, mockStats, 1);
    
    if(cache.get('/test.js', mockStats) === null) {
      cache.destroy();
      return fail('should be cache hit');
    }
    
    if(cache.stats.hits !== 1) {
      cache.destroy();
      return fail('hit count should be 1');
    }
    
    if(cache.getHitRate() !== 50) {
      cache.destroy();
      return fail('hit rate should be 50%');
    }
    
    const stats = cache.getStats();
    if(!stats.cache || !stats.stats || !stats.memory) {
      cache.destroy();
      return fail('stats structure invalid');
    }
    
    cache.destroy();
    pass('Statistics tracking verified');
  },

  'file watching invalidates cache on changes': async ({pass, fail, log}) => {
    let cache;
    let testFilePath;
    
    const tempDir = await createTempDir();
    
    cache = createTestCache({
      maxSize: 10,
      ttlMs: 60000,
      watchFiles: true
    });

    testFilePath = path.join(tempDir, 'watch-test.js');
    
    await writeFile(testFilePath, 'export default () => "v1";');
    const initialStats = await stat(testFilePath);
    
    const module = { default: () => 'v1' };
    cache.set(testFilePath, module, initialStats, 1);
    
    if(cache.get(testFilePath, initialStats) === null) {
      await unlink(testFilePath);
      cache.destroy();
      return fail('should be in cache initially');
    }
    
    await new Promise(resolve => setTimeout(resolve, 50));
    await writeFile(testFilePath, 'export default () => "v2";');
    
    await new Promise(resolve => setTimeout(resolve, 200));
    
    if(cache.get(testFilePath, initialStats) !== null) {
      await unlink(testFilePath);
      cache.destroy();
      return fail('should be invalidated after file change');
    }
    
    if(cache.stats.fileChanges === 0) {
      await unlink(testFilePath);
      cache.destroy();
      return fail('file change should be tracked');
    }
    
    // Clean up immediately
    await unlink(testFilePath);
    cache.destroy();
    
    // Give extra time for file watcher cleanup
    await new Promise(resolve => setTimeout(resolve, 100));
    
    pass('File watching verified');
  }
};
