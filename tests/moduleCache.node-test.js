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
export const beforeAll = async (log) => {
  log('Setting up module cache test environment...');
};

export const afterAll = async (log) => {
  log('Starting cleanup of module cache test environment...');
  
  log(`Found ${activeCaches.length} active caches to destroy`);
  // Destroy all active caches to clean up timers and watchers
  for(let i = 0; i < activeCaches.length; i++) {
    log(`Destroying cache ${i + 1}/${activeCaches.length}`);
    activeCaches[i].destroy();
  }
  activeCaches.length = 0;
  log('All caches destroyed');
  
  // Give file watchers extra time to fully close
  log('Waiting for file watchers to close...');
  await new Promise(resolve => setTimeout(resolve, 500));
  log('File watcher wait complete');
  
  const tempDir = path.join(process.cwd(), 'tests', 'temp-cache-test');
  log('Cleaning up temp directory...');
  await cleanupTempDir(tempDir);
  log('Module cache test cleanup complete');
};

/*
  Module Cache Tests
*/
export default {
  'basic LRU functionality works correctly': async ({pass, fail, log}) => {
    try {
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
      if(cache.cache.size !== 1) throw new Error('size should be 1');

      cache.set('/test2.js', { default: () => 'test2' }, mockStats2, 1);
      if(cache.cache.size !== 2) throw new Error('size should be 2');

      cache.set('/test3.js', { default: () => 'test3' }, mockStats3, 1);
      if(cache.cache.size !== 2) throw new Error('size should still be 2');
      if(cache.get('/test1.js', mockStats1) !== null) throw new Error('oldest should be evicted');

      cache.destroy();
      log('✓ LRU eviction working correctly');
      pass('LRU functionality verified');
    } catch(e){ 
      cache?.destroy(); 
      fail(e.message); 
    }
  },

  'TTL expiration invalidates entries': async ({pass, fail, log}) => {
    try {
      const cache = createTestCache({
        maxSize: 10,
        ttlMs: 50,
        watchFiles: false
      });

      const mockStats = { mtime: new Date('2023-01-01') };
      cache.set('/test.js', { default: () => 'test' }, mockStats, 1);
      
      if(cache.get('/test.js', mockStats) === null) throw new Error('should be available immediately');
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if(cache.get('/test.js', mockStats) !== null) throw new Error('should be expired');
      
      cache.destroy();
      log('✓ TTL expiration working');
      pass('TTL expiration verified');
    } catch(e){ 
      cache?.destroy(); 
      fail(e.message); 
    }
  },

  'file modification invalidates cache entry': async ({pass, fail, log}) => {
    try {
      const cache = createTestCache({
        maxSize: 10,
        ttlMs: 60000,
        watchFiles: false
      });

      const oldStats = { mtime: new Date('2023-01-01') };
      const newStats = { mtime: new Date('2023-01-02') };
      
      cache.set('/test.js', { default: () => 'test' }, oldStats, 1);
      
      if(cache.get('/test.js', oldStats) === null) throw new Error('should be available with old stats');
      if(cache.get('/test.js', newStats) !== null) throw new Error('should be invalidated with newer stats');
      
      cache.destroy();
      log('✓ File modification detection working');
      pass('File modification invalidation verified');
    } catch(e){ 
      cache?.destroy(); 
      fail(e.message); 
    }
  },

  'memory limit enforcement evicts oldest entries': async ({pass, fail, log}) => {
    try {
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
      
      if(cache.get('/test1.js', mockStats) !== null) throw new Error('first entry should be evicted due to memory limit');
      if(cache.get('/test2.js', mockStats) === null) throw new Error('second entry should still be cached');
      if(cache.get('/test3.js', mockStats) === null) throw new Error('third entry should still be cached');
      
      cache.destroy();
      log('✓ Memory limit enforcement working');
      pass('Memory limit enforcement verified');
    } catch(e){ 
      cache?.destroy(); 
      fail(e.message); 
    }
  },

  'statistics tracking works correctly': async ({pass, fail, log}) => {
    try {
      const cache = createTestCache({
        maxSize: 10,
        watchFiles: false
      });

      const mockStats = { mtime: new Date('2023-01-01') };
      
      if(cache.get('/test.js', mockStats) !== null) throw new Error('should be cache miss');
      if(cache.stats.misses !== 1) throw new Error('miss count should be 1');
      
      cache.set('/test.js', { default: () => 'test' }, mockStats, 1);
      if(cache.get('/test.js', mockStats) === null) throw new Error('should be cache hit');
      if(cache.stats.hits !== 1) throw new Error('hit count should be 1');
      
      if(cache.getHitRate() !== 50) throw new Error('hit rate should be 50%');
      
      const stats = cache.getStats();
      if(!stats.cache || !stats.stats || !stats.memory) throw new Error('stats structure invalid');
      
      cache.destroy();
      log('✓ Statistics tracking accurate');
      pass('Statistics tracking verified');
    } catch(e){ 
      cache?.destroy(); 
      fail(e.message); 
    }
  },

  'file watching invalidates cache on changes': async ({pass, fail, log}) => {
    let cache;
    let testFilePath;
    try {
      log('Starting file watching test...');
      const tempDir = await createTempDir();
      log('Created temp directory');
      
      cache = createTestCache({
        maxSize: 10,
        ttlMs: 60000,
        watchFiles: true
      });
      log('Created cache with file watching enabled');

      testFilePath = path.join(tempDir, 'watch-test.js');
      
      await writeFile(testFilePath, 'export default () => "v1";');
      log('Wrote initial test file');
      const initialStats = await stat(testFilePath);
      
      const module = { default: () => 'v1' };
      cache.set(testFilePath, module, initialStats, 1);
      log('Set initial cache entry');
      
      if(cache.get(testFilePath, initialStats) === null) throw new Error('should be in cache initially');
      log('Verified initial cache entry exists');
      
      await new Promise(resolve => setTimeout(resolve, 50));
      await writeFile(testFilePath, 'export default () => "v2";');
      log('Modified test file');
      
      await new Promise(resolve => setTimeout(resolve, 200));
      log('Waited for file watcher to detect changes');
      
      if(cache.get(testFilePath, initialStats) !== null) throw new Error('should be invalidated after file change');
      if(cache.stats.fileChanges === 0) throw new Error('file change should be tracked');
      log('Verified cache invalidation worked');
      
      // Clean up immediately
      await unlink(testFilePath);
      log('Deleted test file');
      cache.destroy();
      log('Destroyed cache');
      cache = null; // Ensure it's not destroyed again in catch
      
      // Give extra time for file watcher cleanup
      await new Promise(resolve => setTimeout(resolve, 100));
      log('File watching test cleanup complete');
      
      log('✓ File watching invalidation working');
      pass('File watching verified');
    } catch(e){ 
      log(`Error in file watching test: ${e.message}`);
      if (testFilePath) {
        try { await unlink(testFilePath); log('Cleaned up test file after error'); } catch {}
      }
      cache?.destroy(); 
      log('Destroyed cache after error');
      fail(e.message); 
    }
  }
};
