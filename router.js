import path from 'path';
import { readFile } from 'fs/promises';
import { pathToFileURL } from 'url';
import defaultConfig from './defaultConfig.js';
import getFiles from './getFiles.js';
import findFile from './findFile.js';
import serveFile from './serveFile.js';

export default async (flags, log) => {
  log('Initializing router', 2);
  const rootPath = path.join(process.cwd(), flags.root);
  log(`Root path: ${rootPath}`, 2);
  
  let config = defaultConfig;
  try {
    const configPath = path.join(rootPath, '.config.json');
    log(`Loading config from: ${configPath}`, 2);
    const configContent = await readFile(configPath, 'utf8');
    const userConfig = JSON.parse(configContent);
    config = {
      ...defaultConfig,
      ...userConfig
    };
    log('User config loaded and merged with defaults', 2);
  } catch (e){
    log('Using default config (no .config.json found)', 2);
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
  
  // Process custom routes - resolve paths and validate files exist
  const customRoutes = new Map();
  if (config.customRoutes && Object.keys(config.customRoutes).length > 0) {
    log(`Processing ${Object.keys(config.customRoutes).length} custom routes`, 2);
    
    for (const [urlPath, filePath] of Object.entries(config.customRoutes)) {
      try {
        // Resolve the file path relative to the current working directory
        const resolvedPath = path.resolve(filePath);
        
        // Check if the file exists (we'll do this async)
        const { stat } = await import('fs/promises');
        await stat(resolvedPath);
        
        customRoutes.set(urlPath, resolvedPath);
        log(`Custom route mapped: ${urlPath} -> ${resolvedPath}`, 2);
      } catch (error) {
        log(`Custom route error for ${urlPath} -> ${filePath}: ${error.message}`, 1);
      }
    }
  }
  
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
  }
}