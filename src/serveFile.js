import path from 'path';
import { readFile, stat } from 'fs/promises';
import { pathToFileURL } from 'url';
import findFile from './findFile.js';
import createRequestWrapper from './requestWrapper.js';
import createResponseWrapper from './responseWrapper.js';

export default async (files, rootPath, requestPath, method, config, req, res, log, moduleCache = null) => {
  log(`Attempting to serve: ${requestPath}`, 3);
  const [file, params] = await findFile(files, rootPath, requestPath, method, log);
  
  if (!file) {
    log(`No file found for: ${requestPath}`, 3);
    return false; // Could not find file
  }
  
  const fileName = path.basename(file);
  log(`Found file: ${file}`, 2);
  
  // Check if this is a route file that should be executed as a module
  if (config.routeFiles.includes(fileName)) {
    log(`Executing route file: ${fileName}`, 2);
    try {
      let module;
      
      if (moduleCache && config.cache?.enabled) {
        // Get file stats for cache validation
        const fileStats = await stat(file);
        
        // Try to get from cache first
        module = moduleCache.get(file, fileStats);
        
        if (!module) {
          // Cache miss - load module
          const fileUrl = pathToFileURL(file).href + `?t=${Date.now()}`;
          log(`Loading module from: ${fileUrl}`, 3);
          module = await import(fileUrl);
          
          // Estimate module size (rough approximation based on file size)
          const estimatedSizeKB = fileStats.size / 1024;
          moduleCache.set(file, module, fileStats, estimatedSizeKB);
          log(`Cached module: ${fileName} (${estimatedSizeKB.toFixed(1)}KB)`, 3);
        } else {
          log(`Using cached module: ${fileName}`, 3);
        }
      } else {
        // No caching - load fresh each time
        const fileUrl = pathToFileURL(file).href + `?t=${Date.now()}`;
        log(`Loading module from: ${fileUrl}`, 3);
        module = await import(fileUrl);
      }
      
      // Execute the default export function
      if (typeof module.default === 'function') {
        log(`Executing route function with params: ${JSON.stringify(params)}`, 3);
        
        // Create enhanced request and response wrappers
        const enhancedRequest = createRequestWrapper(req, params);
        const enhancedResponse = createResponseWrapper(res);
        
        // Make module cache accessible for admin endpoints
        if (moduleCache) {
          enhancedRequest._kempoCache = moduleCache;
        }
        
        await module.default(enhancedRequest, enhancedResponse);
        log(`Route executed successfully: ${fileName}`, 2);
        return true; // Successfully served
      } else {
        log(`Route file does not export a function: ${fileName}`, 0);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Route file does not export a function');
        return true; // Handled (even though it's an error)
      }
    } catch (error) {
      log(`Error loading route file ${fileName}: ${error.message}`, 0);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal Server Error');
      return true; // Handled (even though it's an error)
    }
  } else {
    // Serve the file content with appropriate MIME type and encoding
    log(`Serving static file: ${fileName}`, 2);
    try {
      const fileExtension = path.extname(file).toLowerCase().slice(1);
      const mimeConfig = config.allowedMimes[fileExtension];
      let mimeType, encoding;
      if (typeof mimeConfig === 'string') {
        mimeType = mimeConfig;
        encoding = undefined;
      } else {
        mimeType = mimeConfig?.mime || 'application/octet-stream';
        encoding = mimeConfig?.encoding === 'utf8' ? 'utf8' : undefined;
      }
      const fileContent = await readFile(file, encoding);
      log(`Serving ${file} as ${mimeType} (${fileContent.length} bytes)`, 2);
      res.writeHead(200, { 'Content-Type': mimeType });
      res.end(fileContent);
      return true; // Successfully served
    } catch (error) {
      log(`Error reading file ${file}: ${error.message}`, 0);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal Server Error');
      return true; // Handled (even though it's an error)
    }
  }
};
