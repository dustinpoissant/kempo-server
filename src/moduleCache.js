import { watch } from 'fs';
import path from 'path';

/*
  Hybrid Module Cache System
  Combines LRU, time-based expiration, and memory monitoring
*/
export default class ModuleCache {
  constructor(config = {}) {
    this.cache = new Map();
    this.watchers = new Map();
    
    // Configuration
    this.maxSize = config.maxSize || 100;
    this.maxMemoryMB = config.maxMemoryMB || 50;
    this.ttlMs = config.ttlMs || 300000; // 5 minutes default
    this.maxHeapUsagePercent = config.maxHeapUsagePercent || 70;
    this.memoryCheckInterval = config.memoryCheckInterval || 30000; // 30 seconds
    this.watchFiles = config.watchFiles !== false; // Default to true
    
    // State tracking
    this.currentMemoryMB = 0;
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      fileChanges: 0
    };
    
    // Start memory monitoring
    if (config.enableMemoryMonitoring !== false) {
      this.startMemoryMonitoring();
    }
  }

  /*
    Lifecycle Management
  */
  startMemoryMonitoring() {
    this.memoryTimer = setInterval(() => {
      const usage = process.memoryUsage();
      const heapPercent = (usage.heapUsed / usage.heapTotal) * 100;
      
      if (heapPercent > this.maxHeapUsagePercent) {
        const clearedCount = this.clearExpiredEntries();
        this.stats.evictions += clearedCount;
        
        // If still over limit, clear oldest entries
        while (this.cache.size > 0 && heapPercent > this.maxHeapUsagePercent) {
          this.evictOldest();
        }
      }
    }, this.memoryCheckInterval);
  }

  destroy() {
    if (this.memoryTimer) {
      clearInterval(this.memoryTimer);
    }
    
    // Clean up file watchers
    for (const watcher of this.watchers.values()) {
      watcher.close();
    }
    this.watchers.clear();
    this.cache.clear();
  }

  /*
    Cache Operations
  */
  get(filePath, stats) {
    const entry = this.cache.get(filePath);
    if (!entry) {
      this.stats.misses++;
      return null;
    }
    
    const now = Date.now();
    
    // Check if expired by time
    if (now - entry.timestamp > this.ttlMs) {
      this.delete(filePath);
      this.stats.misses++;
      return null;
    }
    
    // Check if file was modified
    if (entry.mtime < stats.mtime) {
      this.delete(filePath);
      this.stats.misses++;
      return null;
    }
    
    // Move to end (most recently used)
    this.cache.delete(filePath);
    this.cache.set(filePath, entry);
    
    this.stats.hits++;
    return entry.module;
  }

  set(filePath, module, stats, estimatedSizeKB = 1) {
    // Evict entries if we'd exceed limits
    const sizeInMB = estimatedSizeKB / 1024;
    
    while (
      this.cache.size >= this.maxSize || 
      this.currentMemoryMB + sizeInMB > this.maxMemoryMB
    ) {
      this.evictOldest();
    }
    
    // Create cache entry
    const entry = {
      module,
      mtime: stats.mtime,
      timestamp: Date.now(),
      sizeKB: estimatedSizeKB,
      filePath
    };
    
    this.cache.set(filePath, entry);
    this.currentMemoryMB += sizeInMB;
    
    // Set up file watcher if enabled
    if (this.watchFiles) {
      this.setupFileWatcher(filePath);
    }
  }

  delete(filePath) {
    const entry = this.cache.get(filePath);
    if (entry) {
      this.cache.delete(filePath);
      this.currentMemoryMB -= entry.sizeKB / 1024;
      
      // Remove file watcher
      const watcher = this.watchers.get(filePath);
      if (watcher) {
        watcher.close();
        this.watchers.delete(filePath);
      }
      
      return true;
    }
    return false;
  }

  clear() {
    const size = this.cache.size;
    this.cache.clear();
    this.currentMemoryMB = 0;
    
    // Clean up all watchers
    for (const watcher of this.watchers.values()) {
      watcher.close();
    }
    this.watchers.clear();
    
    this.stats.evictions += size;
  }

  /*
    Cache Management
  */
  evictOldest() {
    if (this.cache.size === 0) return;
    
    const [oldestKey, oldestEntry] = this.cache.entries().next().value;
    this.delete(oldestKey);
    this.stats.evictions++;
  }

  clearExpiredEntries() {
    const now = Date.now();
    let clearedCount = 0;
    
    for (const [filePath, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttlMs) {
        this.delete(filePath);
        clearedCount++;
      }
    }
    
    return clearedCount;
  }

  /*
    File Watching
  */
  setupFileWatcher(filePath) {
    // Don't create duplicate watchers
    if (this.watchers.has(filePath)) return;
    
    try {
      const watcher = watch(filePath, (eventType) => {
        if (eventType === 'change') {
          this.delete(filePath);
          this.stats.fileChanges++;
        }
      });
      
      // Handle watcher errors gracefully
      watcher.on('error', (error) => {
        // File might have been deleted or moved
        this.delete(filePath);
      });
      
      this.watchers.set(filePath, watcher);
    } catch (error) {
      // File watching failed, but cache can still work
      console.warn(`Could not watch file ${filePath}: ${error.message}`);
    }
  }

  /*
    Utilities and Stats
  */
  getStats() {
    const memoryUsage = process.memoryUsage();
    
    return {
      cache: {
        size: this.cache.size,
        maxSize: this.maxSize,
        memoryUsageMB: Math.round(this.currentMemoryMB * 100) / 100,
        maxMemoryMB: this.maxMemoryMB,
        watchersActive: this.watchers.size
      },
      stats: { ...this.stats },
      memory: {
        heapUsedMB: Math.round(memoryUsage.heapUsed / 1024 / 1024 * 100) / 100,
        heapTotalMB: Math.round(memoryUsage.heapTotal / 1024 / 1024 * 100) / 100,
        heapUsagePercent: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100),
        rssMB: Math.round(memoryUsage.rss / 1024 / 1024 * 100) / 100
      },
      config: {
        ttlMs: this.ttlMs,
        maxHeapUsagePercent: this.maxHeapUsagePercent,
        watchFiles: this.watchFiles
      }
    };
  }

  getHitRate() {
    const total = this.stats.hits + this.stats.misses;
    return total === 0 ? 0 : Math.round((this.stats.hits / total) * 100);
  }

  /*
    Development Helpers
  */
  logStats(log) {
    const stats = this.getStats();
    log(`Cache Stats: ${stats.cache.size}/${stats.cache.maxSize} entries, ` +
        `${stats.cache.memoryUsageMB}/${stats.cache.maxMemoryMB}MB, ` +
        `${this.getHitRate()}% hit rate`, 2);
  }

  // For debugging - list all cached files
  getCachedFiles() {
    return Array.from(this.cache.keys()).map(filePath => ({
      path: filePath,
      relativePath: path.relative(process.cwd(), filePath),
      age: Date.now() - this.cache.get(filePath).timestamp,
      sizeKB: this.cache.get(filePath).sizeKB
    }));
  }
}
