import path from 'path';
import { readFile } from 'fs/promises';
import { pathToFileURL } from 'url';
import defaultConfig from './defaultConfig.js';
import getFiles from './getFiles.js';
import findFile from './findFile.js';
import serveFile from './serveFile.js';
import MiddlewareRunner from './middlewareRunner.js';
import ModuleCache from './moduleCache.js';
import createRequestWrapper from './requestWrapper.js';
import createResponseWrapper from './responseWrapper.js';
import { 
  corsMiddleware, 
  compressionMiddleware, 
  rateLimitMiddleware, 
  securityMiddleware, 
  loggingMiddleware 
} from './builtinMiddleware.js';

export default async (flags, log) => {
  log('Initializing router', 3);
  const rootPath = path.isAbsolute(flags.root) ? flags.root : path.join(process.cwd(), flags.root);
  log(`Root path: ${rootPath}`, 3);
  
  let config = defaultConfig;
  try {
    // Use the provided config path or fallback to .config.json in rootPath
    const configFileName = flags.config || '.config.json';
    const configPath = path.isAbsolute(configFileName) 
      ? configFileName 
      : path.join(rootPath, configFileName);
    
    log(`Config file name: ${configFileName}`, 3);
    log(`Config path: ${configPath}`, 3);
    
    // Validate that config file is within the server root directory
    // Allow absolute paths (user explicitly specified location)
    if (!path.isAbsolute(configFileName)) {
      const relativeConfigPath = path.relative(rootPath, configPath);
      log(`Relative config path: ${relativeConfigPath}`, 4);
      log(`Starts with '..': ${relativeConfigPath.startsWith('..')}`, 4);
      if (relativeConfigPath.startsWith('..') || path.isAbsolute(relativeConfigPath)) {
        log(`Validation failed - throwing error`, 4);
        throw new Error(`Config file must be within the server root directory. Config path: ${configPath}, Root path: ${rootPath}`);
      }
      log(`Validation passed`, 4);
    } else {
      log(`Config file name is absolute, skipping validation`, 4);
    }
    
    log(`Loading config from: ${configPath}`, 3);
    const configContent = await readFile(configPath, 'utf8');
    const userConfig = JSON.parse(configContent);
    config = {
      ...defaultConfig,
      ...userConfig,
      // Deep merge nested objects
      allowedMimes: {
        ...defaultConfig.allowedMimes,
        ...(userConfig.allowedMimes || {})
      },
      middleware: {
        ...defaultConfig.middleware,
        ...(userConfig.middleware || {})
      },
      customRoutes: {
        ...defaultConfig.customRoutes,
        ...(userConfig.customRoutes || {})
      },
      cache: {
        ...defaultConfig.cache,
        ...(userConfig.cache || {})
      }
    };
    log('User config loaded and merged with defaults', 3);
  } catch (e){
    // Only fall back to default config for file reading/parsing errors
    // Let validation errors propagate up
    if (e.message.includes('Config file must be within the server root directory')) {
      throw e;
    }
    log('Using default config (no config file found)', 3);
  }
  
  /*
    Inject mandatory disallowed patterns
  */
  const dis = new Set(config.disallowedRegex);
  dis.add("^/\\..*");
  dis.add("\\.config$");
  dis.add("\\.git/"); 
  config.disallowedRegex = [...dis];
  log(`Config loaded with ${config.disallowedRegex.length} disallowed patterns`, 3);
  
  let files = await getFiles(rootPath, config, log);
  log(`Initial scan found ${files.length} files`, 2);
  
  // Initialize middleware runner
  const middlewareRunner = new MiddlewareRunner();
  
  // Load built-in middleware based on config
  if (config.middleware?.cors?.enabled) {
    middlewareRunner.use(corsMiddleware(config.middleware.cors));
    log('CORS middleware enabled', 3);
  }
  
  if (config.middleware?.compression?.enabled) {
    middlewareRunner.use(compressionMiddleware(config.middleware.compression));
    log('Compression middleware enabled', 3);
  }
  
  if (config.middleware?.rateLimit?.enabled) {
    middlewareRunner.use(rateLimitMiddleware(config.middleware.rateLimit));
    log('Rate limit middleware enabled', 3);
  }
  
  if (config.middleware?.security?.enabled) {
    middlewareRunner.use(securityMiddleware(config.middleware.security));
    log('Security middleware enabled', 3);
  }
  
  if (config.middleware?.logging?.enabled) {
    middlewareRunner.use(loggingMiddleware(config.middleware.logging, log));
    log('Logging middleware enabled', 3);
  }
  
  // Load custom middleware files
  if (config.middleware?.custom && config.middleware.custom.length > 0) {
    log(`Loading ${config.middleware.custom.length} custom middleware files`, 3);
    
    for (const middlewarePath of config.middleware.custom) {
      try {
        const resolvedPath = path.isAbsolute(middlewarePath) ? middlewarePath : path.resolve(rootPath, middlewarePath);
        const middlewareUrl = pathToFileURL(resolvedPath).href + `?t=${Date.now()}`;
        const middlewareModule = await import(middlewareUrl);
        const customMiddleware = middlewareModule.default;
        
        if (typeof customMiddleware === 'function') {
          middlewareRunner.use(customMiddleware(config.middleware));
          log(`Custom middleware loaded: ${middlewarePath}`, 3);
        } else {
          log(`Custom middleware error: ${middlewarePath} does not export a default function`, 1);
        }
      } catch (error) {
        log(`Custom middleware error for ${middlewarePath}: ${error.message}`, 1);
      }
    }
  }
  
  /*
    Initialize Module Cache
  */
  let moduleCache = null;
  if (config.cache?.enabled) {
    moduleCache = new ModuleCache(config.cache);
    log(`Module cache initialized: ${config.cache.maxSize} max modules, ` +
        `${config.cache.maxMemoryMB}MB limit, ${config.cache.ttlMs}ms TTL`, 2);
  }
  
  // Process custom routes - resolve paths and validate files exist
  const customRoutes = new Map();
  const wildcardRoutes = new Map();
  
  if (config.customRoutes && Object.keys(config.customRoutes).length > 0) {
    log(`Processing ${Object.keys(config.customRoutes).length} custom routes`, 3);
    for (const [urlPath, filePath] of Object.entries(config.customRoutes)) {
      // Check if this is a wildcard route
      if (urlPath.includes('*')) {
        // Resolve the file path relative to rootPath if relative, otherwise use absolute path
        const resolvedPath = path.isAbsolute(filePath) ? filePath : path.resolve(rootPath, filePath);
        // Store wildcard routes separately for pattern matching
        wildcardRoutes.set(urlPath, resolvedPath);
        log(`Wildcard route mapped: ${urlPath} -> ${resolvedPath}`, 3);
      } else {
        // Resolve the file path relative to rootPath if relative, otherwise use absolute path
        const resolvedPath = path.isAbsolute(filePath) ? filePath : path.resolve(rootPath, filePath);
        customRoutes.set(urlPath, resolvedPath);
        log(`Custom route mapped: ${urlPath} -> ${resolvedPath}`, 3);
      }
    }
  }
  
  // Helper function to match wildcard patterns
  const matchWildcardRoute = (requestPath, pattern) => {
    // Convert wildcard pattern to regex
    // IMPORTANT: Replace ** BEFORE * to avoid replacing both * in **
    const regexPattern = pattern
      .replace(/\*\*/g, '(.+)')     // Replace ** with capture group for multiple segments
      .replace(/\*/g, '([^/]+)');   // Replace * with capture group for single segment
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.exec(requestPath);
  };
  
  // Helper function to resolve wildcard file paths
  const resolveWildcardPath = (filePath, matches) => {
    let resolvedPath = filePath;
    let matchIndex = 1; // Start from matches[1] (first capture group)
    
    // Replace ** wildcards first
    while (resolvedPath.includes('**') && matchIndex < matches.length) {
      resolvedPath = resolvedPath.replace('**', matches[matchIndex]);
      matchIndex++;
    }
    
    // Replace any remaining * wildcards
    while (resolvedPath.includes('*') && matchIndex < matches.length) {
      resolvedPath = resolvedPath.replace('*', matches[matchIndex]);
      matchIndex++;
    }
    
    // If the path is already absolute, return it as-is
    // If it's relative, resolve it relative to rootPath
    return path.isAbsolute(resolvedPath) ? resolvedPath : path.resolve(rootPath, resolvedPath);
  };
  
  // Helper function to find matching wildcard route
  const findWildcardRoute = (requestPath) => {
    for (const [pattern, filePath] of wildcardRoutes) {
      const matches = matchWildcardRoute(requestPath, pattern);
      if (matches) {
        return { filePath, matches };
      }
    }
    return null;
  };

  // Track 404 attempts to avoid unnecessary rescans
  const rescanAttempts = new Map(); // path -> attempt count
  const dynamicNoRescanPaths = new Set(); // paths that have exceeded max attempts
  
  // Helper function to check if a path should skip rescanning
  const shouldSkipRescan = (requestPath) => {
    // Check static config patterns
    const matchesConfigPattern = config.noRescanPaths.some(pattern => {
      const regex = new RegExp(pattern);
      return regex.test(requestPath);
    });
    
    if (matchesConfigPattern) {
      log(`Skipping rescan for configured pattern: ${requestPath}`, 3);
      return true;
    }
    
    // Check dynamic blacklist
    if (dynamicNoRescanPaths.has(requestPath)) {
      log(`Skipping rescan for dynamically blacklisted path: ${requestPath}`, 3);
      return true;
    }
    
    return false;
  };
  
  // Helper function to track rescan attempts
  const trackRescanAttempt = (requestPath) => {
    const currentAttempts = rescanAttempts.get(requestPath) || 0;
    const newAttempts = currentAttempts + 1;
    rescanAttempts.set(requestPath, newAttempts);
    
    if (newAttempts > config.maxRescanAttempts) {
      dynamicNoRescanPaths.add(requestPath);
      log(`Path ${requestPath} added to dynamic blacklist after ${newAttempts} failed attempts`, 1);
    }
    
    log(`Rescan attempt ${newAttempts}/${config.maxRescanAttempts} for: ${requestPath}`, 3);
    return newAttempts;
  };
  
  const requestHandler = async (req, res) => {
    // Create enhanced request and response wrappers before middleware
    const enhancedRequest = createRequestWrapper(req, {});
    const enhancedResponse = createResponseWrapper(res);
    
    await middlewareRunner.run(enhancedRequest, enhancedResponse, async () => {
      const requestPath = enhancedRequest.url.split('?')[0];
      log(`${enhancedRequest.method} ${requestPath}`, 4);
      

      // Check custom routes first (allow outside rootPath)
      log(`customRoutes keys: ${Array.from(customRoutes.keys()).join(', ')}`, 4);
      // Normalize requestPath and keys for matching
      const normalizePath = p => {
        try {
          let np = decodeURIComponent(p);
          if (!np.startsWith('/')) np = '/' + np;
          if (np.length > 1 && np.endsWith('/')) np = np.slice(0, -1);
          return np;
        } catch (e) {
          log(`Warning: Failed to decode URI component "${p}": ${e.message}`, 1);
          // Return the original path if decoding fails
          let np = p;
          if (!np.startsWith('/')) np = '/' + np;
          if (np.length > 1 && np.endsWith('/')) np = np.slice(0, -1);
          return np;
        }
      };
      const normalizedRequestPath = normalizePath(requestPath);
      log(`Normalized requestPath: ${normalizedRequestPath}`, 4);
      let matchedKey = null;
      for (const key of customRoutes.keys()) {
        if (normalizePath(key) === normalizedRequestPath) {
          matchedKey = key;
          break;
        }
      }
      if (matchedKey) {
        const customFilePath = customRoutes.get(matchedKey);
        log(`Serving custom route: ${normalizedRequestPath} -> ${customFilePath}`, 3);
        try {
          const { stat } = await import('fs/promises');
          try {
            await stat(customFilePath);
            log(`Custom route file exists: ${customFilePath}`, 4);
          } catch (e) {
            log(`Custom route file does NOT exist: ${customFilePath}`, 1);
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Custom route file not found');
            return;
          }
          const fileExtension = path.extname(customFilePath).toLowerCase().slice(1);
          const mimeConfig = config.allowedMimes[fileExtension];
          let mimeType, encoding;
          if (typeof mimeConfig === 'string') {
            mimeType = mimeConfig;
            // Default to UTF-8 for text MIME types
            encoding = mimeType.startsWith('text/') ? 'utf8' : undefined;
          } else {
            mimeType = mimeConfig?.mime || 'application/octet-stream';
            encoding = mimeConfig?.encoding === 'utf8' ? 'utf8' : undefined;
          }
          const fileContent = await readFile(customFilePath, encoding);
          log(`Serving custom file as ${mimeType} (${fileContent.length} bytes)`, 2);
          // Add charset=utf-8 for text MIME types when using UTF-8 encoding
          const contentType = encoding === 'utf8' && mimeType.startsWith('text/') 
            ? `${mimeType}; charset=utf-8` 
            : mimeType;
          res.writeHead(200, { 'Content-Type': contentType });
          res.end(fileContent);
          return; // Successfully served custom route
        } catch (error) {
          log(`Error serving custom route ${normalizedRequestPath}: ${error.message}`, 1);
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Internal Server Error');
          return;
        }
      }

      // Check wildcard routes (allow outside rootPath)
      const wildcardMatch = findWildcardRoute(requestPath);
      if (wildcardMatch) {
        const resolvedFilePath = resolveWildcardPath(wildcardMatch.filePath, wildcardMatch.matches);
        log(`Serving wildcard route: ${requestPath} -> ${resolvedFilePath}`, 3);
        try {
          const fileExtension = path.extname(resolvedFilePath).toLowerCase().slice(1);
          const mimeConfig = config.allowedMimes[fileExtension];
          let mimeType, encoding;
          if (typeof mimeConfig === 'string') {
            mimeType = mimeConfig;
            // Default to UTF-8 for text MIME types
            encoding = mimeType.startsWith('text/') ? 'utf8' : undefined;
          } else {
            mimeType = mimeConfig?.mime || 'application/octet-stream';
            encoding = mimeConfig?.encoding === 'utf8' ? 'utf8' : undefined;
          }
          const fileContent = await readFile(resolvedFilePath, encoding);
          log(`Serving wildcard file as ${mimeType} (${fileContent.length} bytes)`, 4);
          // Add charset=utf-8 for text MIME types when using UTF-8 encoding
          const contentType = encoding === 'utf8' && mimeType.startsWith('text/') 
            ? `${mimeType}; charset=utf-8` 
            : mimeType;
          res.writeHead(200, { 'Content-Type': contentType });
          res.end(fileContent);
          return; // Successfully served wildcard route
        } catch (error) {
          // Check if it's a file not found error
          if (error.code === 'ENOENT') {
            log(`Wildcard route file not found: ${requestPath}`, 2);
            // Let it fall through to normal 404 handling
          } else {
            log(`Error serving wildcard route ${requestPath}: ${error.message}`, 1);
            enhancedResponse.writeHead(500, { 'Content-Type': 'text/plain' });
            enhancedResponse.end('Internal Server Error');
            return;
          }
        }
      }
      
      // Try to serve the file normally
      const served = await serveFile(files, rootPath, requestPath, req.method, config, req, res, log, moduleCache);
      
      // If not served and rescanning is enabled (maxRescanAttempts > 0), try rescanning (with blacklist check)
      if (!served && config.maxRescanAttempts > 0 && !shouldSkipRescan(requestPath)) {
        log('File not found, rescanning directory...', 1);
        files = await getFiles(rootPath, config, log);
        log(`Rescan found ${files.length} files`, 2);
        
        // Try to serve again after rescan
        const reserved = await serveFile(files, rootPath, requestPath, enhancedRequest.method, config, enhancedRequest, enhancedResponse, log, moduleCache);
        
        if (!reserved) {
          trackRescanAttempt(requestPath);
          log(`404 - File not found after rescan: ${requestPath}`, 1);
          enhancedResponse.writeHead(404, { 'Content-Type': 'text/plain' });
          enhancedResponse.end('Not Found');
        } else {
          // File was found after rescan, reset the attempt counter
          rescanAttempts.delete(requestPath);
        }
      } else if (!served) {
        if (shouldSkipRescan(requestPath)) {
          log(`404 - Skipped rescan for: ${requestPath}`, 2);
        } else {
          log(`404 - File not found: ${requestPath}`, 1);
        }
        enhancedResponse.writeHead(404, { 'Content-Type': 'text/plain' });
        enhancedResponse.end('Not Found');
      }
    });
  };

  // Return handler with cache instance for external access
  const handler = requestHandler;
  handler.moduleCache = moduleCache;
  handler.getStats = () => moduleCache?.getStats() || null;
  handler.logCacheStats = () => moduleCache?.logStats(log);
  handler.clearCache = () => moduleCache?.clear();
  
  return handler;
}