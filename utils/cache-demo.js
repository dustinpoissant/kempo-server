#!/usr/bin/env node

/*
  Cache Demo Script
  Demonstrates the module cache functionality with real-time monitoring
*/

import path from 'path';
import { writeFile, unlink, mkdir, rm } from 'fs/promises';
import ModuleCache from '../src/moduleCache.js';

const createDemoFiles = async (demoDir) => {
  await mkdir(demoDir, { recursive: true });
  
  // Create some demo route files
  await writeFile(path.join(demoDir, 'users.js'), 
    'export default async (req, res) => res.json({ users: ["alice", "bob"] });'
  );
  
  await writeFile(path.join(demoDir, 'posts.js'), 
    'export default async (req, res) => res.json({ posts: ["post1", "post2"] });'
  );
  
  await writeFile(path.join(demoDir, 'auth.js'), 
    'export default async (req, res) => res.json({ authenticated: true });'
  );
  
  return [
    path.join(demoDir, 'users.js'),
    path.join(demoDir, 'posts.js'), 
    path.join(demoDir, 'auth.js')
  ];
};

const simulateFileAccess = async (cache, filePaths) => {
  const { stat } = await import('fs/promises');
  
  for(const filePath of filePaths) {
    const stats = await stat(filePath);
    
    // Try to get from cache first
    let module = cache.get(filePath, stats);
    
    if(!module) {
      // Simulate loading module
      const fileUrl = `file://${filePath}?t=${Date.now()}`;
      module = await import(fileUrl);
      cache.set(filePath, module, stats, stats.size / 1024);
    }
    
    console.log(`📁 ${path.basename(filePath)}: ${module ? '✅ cached' : '❌ loaded fresh'}`);
  }
};

const displayCacheStats = (cache) => {
  console.log('\n📊 Cache Statistics:');
  console.log('─'.repeat(40));
  
  const stats = cache.getStats();
  console.log(`Entries: ${stats.cache.size}/${stats.cache.maxSize}`);
  console.log(`Memory: ${stats.cache.memoryUsageMB}/${stats.cache.maxMemoryMB}MB`);
  console.log(`Hit Rate: ${cache.getHitRate()}%`);
  console.log(`Hits: ${stats.stats.hits}, Misses: ${stats.stats.misses}`);
  console.log(`File Changes: ${stats.stats.fileChanges}`);
  console.log(`Heap Usage: ${stats.memory.heapUsedMB}MB (${stats.memory.heapUsagePercent}%)`);
  
  if(stats.cache.size > 0) {
    console.log('\n📋 Cached Files:');
    const cachedFiles = cache.getCachedFiles();
    cachedFiles.forEach(file => {
      const ageSeconds = Math.round(file.age / 1000);
      console.log(`  • ${file.relativePath} (${file.sizeKB.toFixed(1)}KB, ${ageSeconds}s old)`);
    });
  }
  console.log();
};

const main = async () => {
  console.log('🚀 Kempo Server Module Cache Demo\n');
  
  // Create demo directory and files
  const demoDir = path.join(process.cwd(), 'demo-cache-test');
  console.log('📝 Creating demo files...');
  const filePaths = await createDemoFiles(demoDir);
  
  // Initialize cache with small limits for demo
  const cache = new ModuleCache({
    maxSize: 2,
    maxMemoryMB: 1,
    ttlMs: 5000, // 5 seconds
    watchFiles: true,
    enableMemoryMonitoring: true
  });
  
  console.log('✅ Cache initialized\n');
  
  try {
    // Round 1: Initial loads (cache misses)
    console.log('🔄 Round 1: Initial file access (expect cache misses)');
    await simulateFileAccess(cache, filePaths);
    displayCacheStats(cache);
    
    // Round 2: Immediate re-access (cache hits)
    console.log('🔄 Round 2: Immediate re-access (expect cache hits)');
    await simulateFileAccess(cache, [filePaths[0], filePaths[1]]);
    displayCacheStats(cache);
    
    // Round 3: Add third file (should evict oldest due to maxSize=2)
    console.log('🔄 Round 3: Access third file (expect LRU eviction)');
    await simulateFileAccess(cache, [filePaths[2]]);
    displayCacheStats(cache);
    
    // Round 4: Wait for TTL expiration
    console.log('⏱️  Waiting 6 seconds for TTL expiration...');
    await new Promise(resolve => setTimeout(resolve, 6000));
    
    console.log('🔄 Round 4: Access after TTL expiration (expect cache misses)');
    await simulateFileAccess(cache, [filePaths[1]]);
    displayCacheStats(cache);
    
    // Round 5: Demonstrate file watching
    console.log('📝 Round 5: Modifying file to test file watching...');
    await writeFile(filePaths[1], 
      'export default async (req, res) => res.json({ posts: ["updated post"] });'
    );
    
    // Wait for file watcher to detect change
    await new Promise(resolve => setTimeout(resolve, 200));
    
    console.log('🔄 Accessing modified file (expect cache invalidation)');
    await simulateFileAccess(cache, [filePaths[1]]);
    displayCacheStats(cache);
    
  } finally {
    // Cleanup
    console.log('🧹 Cleaning up...');
    cache.destroy();
    await rm(demoDir, { recursive: true });
    console.log('✅ Demo completed successfully!');
  }
};

if(import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
