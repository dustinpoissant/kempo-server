/*
  Cache Administration Endpoint
  GET /_admin/cache - Returns cache statistics as JSON
  DELETE /_admin/cache - Clears the entire cache
*/

export default async (req, res) => {
  // Find the router instance to access moduleCache
  // This is a bit of a hack - in practice you'd pass this through middleware
  const moduleCache = req.moduleCache || req._kempoCache;
  
  if (!moduleCache) {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      error: 'Cache not available',
      message: 'Module cache is not enabled or accessible'
    }));
    return;
  }

  if (req.method === 'GET') {
    // Return cache statistics
    const stats = moduleCache.getStats();
    const cachedFiles = moduleCache.getCachedFiles();
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ...stats,
      cachedFiles: cachedFiles.map(file => ({
        ...file,
        ageSeconds: Math.round(file.age / 1000)
      }))
    }, null, 2));
    
  } else if (req.method === 'DELETE') {
    // Clear cache
    const sizeBefore = moduleCache.cache.size;
    moduleCache.clear();
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      message: 'Cache cleared successfully',
      entriesCleared: sizeBefore
    }));
    
  } else {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'Method not allowed',
      allowed: ['GET', 'DELETE']
    }));
  }
};
