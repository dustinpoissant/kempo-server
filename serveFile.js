import path from 'path';
import { readFile } from 'fs/promises';
import { pathToFileURL } from 'url';
import findFile from './findFile.js';
import createRequestWrapper from './requestWrapper.js';
import createResponseWrapper from './responseWrapper.js';

export default async (files, rootPath, requestPath, method, config, req, res, log) => {
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
      // Load the file as a module
      const fileUrl = pathToFileURL(file).href;
      log(`Loading module from: ${fileUrl}`, 3);
      const module = await import(fileUrl);
      
      // Execute the default export function
      if (typeof module.default === 'function') {
        log(`Executing route function with params: ${JSON.stringify(params)}`, 3);
        
        // Create enhanced request and response wrappers
        const enhancedRequest = createRequestWrapper(req, params);
        const enhancedResponse = createResponseWrapper(res);
        
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
    // Serve the file content with appropriate MIME type
    log(`Serving static file: ${fileName}`, 2);
    try {
      const fileContent = await readFile(file);
      const fileExtension = path.extname(file).toLowerCase().slice(1);
      const mimeType = config.allowedMimes[fileExtension] || 'application/octet-stream';
      
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
