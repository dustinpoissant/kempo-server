/*
  Clear Cache Admin Endpoint
*/

export default async (req, res) => {
  // Find the router instance to access moduleCache
  const moduleCache = req.moduleCache || req._kempoCache;
  
  if (!moduleCache) {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      error: 'Cache not available',
      message: 'Module cache is not enabled or accessible'
    }));
    return;
  }

  // Clear cache
  const sizeBefore = moduleCache.cache.size;
  moduleCache.clear();
  
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    message: 'Cache cleared successfully',
    entriesCleared: sizeBefore,
    timestamp: new Date().toISOString()
  }));
};
