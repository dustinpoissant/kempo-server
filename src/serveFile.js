import path from 'path';
import { readFile, stat } from 'fs/promises';
import { createReadStream } from 'fs';
import { pathToFileURL } from 'url';
import findFile from './findFile.js';
import createRequestWrapper, { readRawBody, parseBody } from './requestWrapper.js';
import createResponseWrapper from './responseWrapper.js';
import { renderPage } from './templating/index.js';

// Parses a `Range: bytes=...` header value against a known file size.
// Supports `start-end`, open-ended `start-`, and suffix `-N` (last N bytes)
// forms. Returns null for a missing/malformed/unsatisfiable range.
const parseRange = (rangeHeader, size) => {
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader || '');
  if(!match || (match[1] === '' && match[2] === '')) return null;
  let start = match[1] === '' ? undefined : parseInt(match[1], 10);
  let end = match[2] === '' ? undefined : parseInt(match[2], 10);
  if(start === undefined){
    start = Math.max(size - end, 0);
    end = size - 1;
  } else if(end === undefined || end >= size){
    end = size - 1;
  }
  if(isNaN(start) || isNaN(end) || start > end || start >= size) return null;
  return { start, end };
};

const trySSR = async (rootPath, requestPath, config, res, log) => {
  const htmlPath = requestPath.endsWith('/') ? requestPath + 'index' : requestPath;
  const pagePath = path.join(rootPath, htmlPath.replace(/\.html$/, '') + '.page.html');
  try {
    await stat(pagePath);
    const {globals, state, maxFragmentDepth} = config.templating;
    const html = await renderPage(pagePath, rootPath, globals, state, maxFragmentDepth);
    res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
    res.end(html);
    log(`SSR rendered: ${pagePath}`, 2);
    return true;
  } catch(e){
    log(`SSR error for ${requestPath}: ${e.message}`, 3);
    return false;
  }
};

export default async (files, rootPath, requestPath, method, config, req, res, log, moduleCache = null) => {
  log(`Attempting to serve: ${requestPath}`, 3);

  if(config.templating?.ssr && config.templating?.ssrPriority){
    if(await trySSR(rootPath, requestPath, config, res, log)) return true;
  }

  const [file, params] = await findFile(files, rootPath, requestPath, method, log);
  
  if (!file) {
    if(config.templating?.ssr){
      if(await trySSR(rootPath, requestPath, config, res, log)) return true;
      log(`SSR fallback not available for: ${requestPath}`, 3);
    }
    log(`No file found for: ${requestPath}`, 3);
    return false; // Could not find file
  }
  
  const fileName = path.basename(file);
  log(`Found file: ${file}`, 2);
  
  if(fileName.endsWith('.page.html')) {
    log(`Rendering page template: ${fileName}`, 2);
    try {
      const {globals, state, maxFragmentDepth} = config.templating;
      const html = await renderPage(file, rootPath, globals, state, maxFragmentDepth);
      res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
      res.end(html);
      return true;
    } catch(error) {
      log(`Error rendering page template ${fileName}: ${error.message}`, 0);
      res.writeHead(500, {'Content-Type': 'text/plain'});
      res.end('Internal Server Error');
      return true;
    }
  }

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

        // Populate body from buffered data
        const rawBody = await readRawBody(req);
        enhancedRequest._rawBody = rawBody;
        enhancedRequest.body = parseBody(rawBody, req.headers['content-type']);
        
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
        // Default to UTF-8 for text MIME types
        encoding = mimeType.startsWith('text/') ? 'utf8' : undefined;
      } else {
        mimeType = mimeConfig?.mime || 'application/octet-stream';
        encoding = mimeConfig?.encoding === 'utf8' ? 'utf8' : undefined;
      }
      // Add charset=utf-8 for text MIME types when using UTF-8 encoding
      const contentType = encoding === 'utf8' && mimeType.startsWith('text/')
        ? `${mimeType}; charset=utf-8`
        : mimeType;

      // Binary files (video/audio/etc.) support byte-range requests so
      // browsers can seek without downloading the whole file first. Text
      // files are small enough to keep serving in full.
      const rangeHeader = req.headers?.range;
      if(encoding === undefined && rangeHeader){
        const { size } = await stat(file);
        const range = parseRange(rangeHeader, size);
        if(!range){
          log(`Unsatisfiable range "${rangeHeader}" for ${file}`, 2);
          res.writeHead(416, { 'Content-Range': `bytes */${size}` });
          res.end();
          return true;
        }
        const { start, end } = range;
        log(`Serving ${file} range ${start}-${end}/${size}`, 2);
        res.writeHead(206, {
          'Content-Type': contentType,
          'Content-Range': `bytes ${start}-${end}/${size}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': end - start + 1
        });
        await new Promise((resolve, reject) => {
          const stream = createReadStream(file, { start, end });
          stream.on('data', (chunk) => res.write(chunk));
          stream.on('end', () => { res.end(); resolve(); });
          stream.on('error', reject);
        });
        return true;
      }

      const fileContent = await readFile(file, encoding);
      log(`Serving ${file} as ${mimeType} (${fileContent.length} bytes)`, 2);
      const headers = { 'Content-Type': contentType };
      if(encoding === undefined) headers['Accept-Ranges'] = 'bytes';
      res.writeHead(200, headers);
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
