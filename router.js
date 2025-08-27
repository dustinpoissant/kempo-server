import path from 'path';
import { readFile } from 'fs/promises';
import { pathToFileURL } from 'url';
import defaultConfig from './defaultConfig.js';
import getFiles from './getFiles.js';
import findFile from './findFile.js';
import serveFile from './serveFile.js';
import MiddlewareRunner from './middlewareRunner.js';
import { 
  corsMiddleware, 
  compressionMiddleware, 
  rateLimitMiddleware, 
  securityMiddleware, 
  loggingMiddleware 
} from './builtinMiddleware.js';

export default async (flags, log) => {
  log('Initializing router', 2);
  const rootPath = path.join(process.cwd(), flags.root);
  log(`Root path: ${rootPath}`, 2);
  
  let config = defaultConfig;
  try {
    // Use the provided config path or fallback to .config.json in rootPath
    const configFileName = flags.config || '.config.json';
    const configPath = path.isAbsolute(configFileName) 
      ? configFileName 
      : path.join(rootPath, configFileName);
    log(`Loading config from: ${configPath}`, 2);
    const configContent = await readFile(configPath, 'utf8');
    const userConfig = JSON.parse(configContent);
    config = {
      ...defaultConfig,
      ...userConfig,
      // Deep merge nested objects
      allowedMimes: {
        ...defaultConfig.allowedMimes,
        ...userConfig.allowedMimes
      },
      middleware: {
        ...defaultConfig.middleware,
        ...userConfig.middleware
      },
      customRoutes: {
        ...defaultConfig.customRoutes,
        ...userConfig.customRoutes
      }
    };
    log('User config loaded and merged with defaults', 2);
  } catch (e){
    log('Using default config (no config file found)', 2);
  }
  
  /*
    Inject mandatory disallowed patterns
  */
  const dis = new Set(config.disallowedRegex);
  dis.add("^/\\..*");
  dis.add("\\.config$");
  dis.add("\\.git/"); 
  config.disallowedRegex = [...dis];
  log(`Config loaded with ${config.disallowedRegex.length} disallowed patterns`, 2);
  
  let files = await getFiles(rootPath, config, log);
  log(`Initial scan found ${files.length} files`, 1);
  
  // Initialize middleware runner
  const middlewareRunner = new MiddlewareRunner();
  
  // Load built-in middleware based on config
  if (config.middleware?.cors?.enabled) {
    middlewareRunner.use(corsMiddleware(config.middleware.cors));
    log('CORS middleware enabled', 2);
  }
  
  if (config.middleware?.compression?.enabled) {
    middlewareRunner.use(compressionMiddleware(config.middleware.compression));
    log('Compression middleware enabled', 2);
  }
  
  if (config.middleware?.rateLimit?.enabled) {
    middlewareRunner.use(rateLimitMiddleware(config.middleware.rateLimit));
    log('Rate limit middleware enabled', 2);
  }
  
  if (config.middleware?.security?.enabled) {
    middlewareRunner.use(securityMiddleware(config.middleware.security));
    log('Security middleware enabled', 2);
  }
  
  if (config.middleware?.logging?.enabled) {
    middlewareRunner.use(loggingMiddleware(config.middleware.logging, log));
    log('Logging middleware enabled', 2);
  }
  
  // Load custom middleware files
  if (config.middleware?.custom && config.middleware.custom.length > 0) {
    log(`Loading ${config.middleware.custom.length} custom middleware files`, 2);
    
    for (const middlewarePath of config.middleware.custom) {
      try {
        const resolvedPath = path.resolve(middlewarePath);
        const middlewareModule = await import(pathToFileURL(resolvedPath));
        const customMiddleware = middlewareModule.default;
        
        if (typeof customMiddleware === 'function') {
          middlewareRunner.use(customMiddleware(config.middleware));
          log(`Custom middleware loaded: ${middlewarePath}`, 2);
        } else {
          log(`Custom middleware error: ${middlewarePath} does not export a default function`, 1);
        }
      } catch (error) {
        log(`Custom middleware error for ${middlewarePath}: ${error.message}`, 1);
      }
    }
  }
  
  // Process custom routes - resolve paths and validate files exist
  const customRoutes = new Map();
  const wildcardRoutes = new Map();
  
  if (config.customRoutes && Object.keys(config.customRoutes).length > 0) {
    log(`Processing ${Object.keys(config.customRoutes).length} custom routes`, 2);
    
    for (const [urlPath, filePath] of Object.entries(config.customRoutes)) {
      try {
        // Check if this is a wildcard route
        if (urlPath.includes('*')) {
          // Store wildcard routes separately for pattern matching
          wildcardRoutes.set(urlPath, filePath);
          log(`Wildcard route mapped: ${urlPath} -> ${filePath}`, 2);
        } else {
          // Resolve the file path relative to the current working directory
          const resolvedPath = path.resolve(filePath);
          
          // Check if the file exists (we'll do this async)
          const { stat } = await import('fs/promises');
          await stat(resolvedPath);
          
          customRoutes.set(urlPath, resolvedPath);
          log(`Custom route mapped: ${urlPath} -> ${resolvedPath}`, 2);
        }
      } catch (error) {
        log(`Custom route error for ${urlPath} -> ${filePath}: ${error.message}`, 1);
      }
    }
  }
  
  // Helper function to match wildcard patterns
  const matchWildcardRoute = (requestPath, pattern) => {
    // Convert wildcard pattern to regex
    const regexPattern = pattern
      .replace(/\*/g, '([^/]+)')  // Replace * with capture group for single segment
      .replace(/\*\*/g, '(.+)');  // Replace ** with capture group for multiple segments
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.exec(requestPath);
  };
  
  // Helper function to resolve wildcard file paths
  const resolveWildcardPath = (filePath, matches) => {
    let resolvedPath = filePath;
    
    // Replace wildcards with captured values
    for (let i = 1; i < matches.length; i++) {
      resolvedPath = resolvedPath.replace('*', matches[i]);
    }
    
    return path.resolve(resolvedPath);
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
    
    if (newAttempts >= config.maxRescanAttempts) {
      dynamicNoRescanPaths.add(requestPath);
      log(`Path ${requestPath} added to dynamic blacklist after ${newAttempts} failed attempts`, 1);
    }
    
    log(`Rescan attempt ${newAttempts}/${config.maxRescanAttempts} for: ${requestPath}`, 2);
    return newAttempts;
  };
  
  return async (req, res) => {
    await middlewareRunner.run(req, res, async () => {
      const requestPath = req.url.split('?')[0];
      log(`${req.method} ${requestPath}`, 0);
      
      // Check custom routes first
      if (customRoutes.has(requestPath)) {
        const customFilePath = customRoutes.get(requestPath);
        log(`Serving custom route: ${requestPath} -> ${customFilePath}`, 2);
        
        try {
          const fileContent = await readFile(customFilePath);
          const fileExtension = path.extname(customFilePath).toLowerCase().slice(1);
          const mimeType = config.allowedMimes[fileExtension] || 'application/octet-stream';
          
          log(`Serving custom file as ${mimeType} (${fileContent.length} bytes)`, 2);
          res.writeHead(200, { 'Content-Type': mimeType });
          res.end(fileContent);
          return; // Successfully served custom route
        } catch (error) {
          log(`Error serving custom route ${requestPath}: ${error.message}`, 0);
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Internal Server Error');
          return;
        }
      }
      
      // Check wildcard routes
      const wildcardMatch = findWildcardRoute(requestPath);
      if (wildcardMatch) {
        const resolvedFilePath = resolveWildcardPath(wildcardMatch.filePath, wildcardMatch.matches);
        log(`Serving wildcard route: ${requestPath} -> ${resolvedFilePath}`, 2);
        
        try {
          const fileContent = await readFile(resolvedFilePath);
          const fileExtension = path.extname(resolvedFilePath).toLowerCase().slice(1);
          const mimeType = config.allowedMimes[fileExtension] || 'application/octet-stream';
          
          log(`Serving wildcard file as ${mimeType} (${fileContent.length} bytes)`, 2);
          res.writeHead(200, { 'Content-Type': mimeType });
          res.end(fileContent);
          return; // Successfully served wildcard route
        } catch (error) {
          log(`Error serving wildcard route ${requestPath}: ${error.message}`, 0);
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Internal Server Error');
          return;
        }
      }
      
      // Try to serve the file normally
      const served = await serveFile(files, rootPath, requestPath, req.method, config, req, res, log);
      
      // If not served and scan flag is enabled, try rescanning once (with blacklist check)
      if (!served && flags.scan && !shouldSkipRescan(requestPath)) {
        trackRescanAttempt(requestPath);
        log('File not found, rescanning directory...', 1);
        files = await getFiles(rootPath, config, log);
        log(`Rescan found ${files.length} files`, 2);
        
        // Try to serve again after rescan
        const reserved = await serveFile(files, rootPath, requestPath, req.method, config, req, res, log);
        
        if (!reserved) {
          log(`404 - File not found after rescan: ${requestPath}`, 1);
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not Found');
        }
      } else if (!served) {
        if (shouldSkipRescan(requestPath)) {
          log(`404 - Skipped rescan for: ${requestPath}`, 2);
        } else {
          log(`404 - File not found: ${requestPath}`, 1);
        }
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      }
    });
  }
}