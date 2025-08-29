#!/usr/bin/env node

/*
  Cache Monitor Utility
  Displays real-time cache statistics and memory usage
*/

import { spawn } from 'child_process';
import { pathToFileURL } from 'url';
import path from 'path';
import { fileURLToPath } from 'url';

const formatBytes = (bytes) => {
  const mb = bytes / 1024 / 1024;
  return `${mb.toFixed(2)}MB`;
};

const formatPercent = (value) => `${value.toFixed(1)}%`;

const clearScreen = () => process.stdout.write('\x1b[2J\x1b[0f');

const displayStats = (stats) => {
  clearScreen();
  console.log('='.repeat(60));
  console.log('📦 KEMPO SERVER - MODULE CACHE MONITOR');
  console.log('='.repeat(60));
  console.log();
  
  if (!stats) {
    console.log('❌ Cache not available or disabled');
    return;
  }
  
  const { cache, stats: cacheStats, memory, config } = stats;
  
  // Cache Status
  console.log('📊 CACHE STATUS');
  console.log('-'.repeat(30));
  console.log(`Entries:     ${cache.size}/${cache.maxSize} (${((cache.size/cache.maxSize)*100).toFixed(1)}%)`);
  console.log(`Memory:      ${cache.memoryUsageMB}/${cache.maxMemoryMB}MB (${((cache.memoryUsageMB/cache.maxMemoryMB)*100).toFixed(1)}%)`);
  console.log(`Watchers:    ${cache.watchersActive} active`);
  console.log();
  
  // Performance Stats
  console.log('⚡ PERFORMANCE');
  console.log('-'.repeat(30));
  const total = cacheStats.hits + cacheStats.misses;
  const hitRate = total === 0 ? 0 : (cacheStats.hits / total * 100);
  console.log(`Hit Rate:    ${hitRate.toFixed(1)}% (${cacheStats.hits} hits, ${cacheStats.misses} misses)`);
  console.log(`Evictions:   ${cacheStats.evictions}`);
  console.log(`File Changes: ${cacheStats.fileChanges}`);
  console.log();
  
  // Memory Info
  console.log('🧠 NODE.JS MEMORY');
  console.log('-'.repeat(30));
  console.log(`Heap Used:   ${memory.heapUsedMB}MB (${memory.heapUsagePercent}%)`);
  console.log(`Heap Total:  ${memory.heapTotalMB}MB`);
  console.log(`RSS:         ${memory.rssMB}MB`);
  console.log();
  
  // Configuration
  console.log('⚙️  CONFIGURATION');
  console.log('-'.repeat(30));
  console.log(`TTL:         ${Math.round(config.ttlMs / 1000)}s`);
  console.log(`Max Heap:    ${config.maxHeapUsagePercent}%`);
  console.log(`File Watch:  ${config.watchFiles ? '✅' : '❌'}`);
  console.log();
  
  console.log(`Last updated: ${new Date().toLocaleTimeString()}`);
  console.log('Press Ctrl+C to exit');
};

// Simulate getting stats from a running server
// In a real implementation, you'd expose an endpoint or use IPC
const getStatsFromServer = async () => {
  // This is a placeholder - in practice you'd either:
  // 1. Add an admin endpoint to your server that returns cache stats
  // 2. Use process communication to get stats from the running server
  // 3. Log stats to a file that this script reads
  
  // For demonstration, return mock stats
  return {
    cache: {
      size: Math.floor(Math.random() * 100),
      maxSize: 100,
      memoryUsageMB: Math.random() * 50,
      maxMemoryMB: 50,
      watchersActive: Math.floor(Math.random() * 50)
    },
    stats: {
      hits: Math.floor(Math.random() * 1000),
      misses: Math.floor(Math.random() * 200),
      evictions: Math.floor(Math.random() * 50),
      fileChanges: Math.floor(Math.random() * 10)
    },
    memory: {
      heapUsedMB: 45 + Math.random() * 20,
      heapTotalMB: 70 + Math.random() * 30,
      heapUsagePercent: 60 + Math.random() * 20,
      rssMB: 80 + Math.random() * 40
    },
    config: {
      ttlMs: 300000,
      maxHeapUsagePercent: 70,
      watchFiles: true
    }
  };
};

const main = async () => {
  console.log('Starting cache monitor...');
  
  setInterval(async () => {
    try {
      const stats = await getStatsFromServer();
      displayStats(stats);
    } catch (error) {
      console.error('Error getting stats:', error.message);
    }
  }, 2000); // Update every 2 seconds
};

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n\n👋 Cache monitor stopped');
  process.exit(0);
});

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
