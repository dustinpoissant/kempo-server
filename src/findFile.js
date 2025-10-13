import path from 'path';

export default (files, rootPath, requestPath, method, log) => {
  log(`Finding file for: ${method} ${requestPath}`, 3);
  
  // Normalize paths for comparison
  let normalizeRequestPath = requestPath.startsWith('/') ? requestPath.slice(1) : requestPath;
  // Remove trailing slash for directory path normalization (except for root)
  if (normalizeRequestPath.endsWith('/') && normalizeRequestPath.length > 0) {
    normalizeRequestPath = normalizeRequestPath.slice(0, -1);
  }
  const requestSegments = normalizeRequestPath ? normalizeRequestPath.split('/') : [];
  
  log(`Normalized request path: ${normalizeRequestPath}`, 4);
  log(`Request segments: [${requestSegments.join(', ')}]`, 4);
  
  // Helper function to check if a segment is dynamic (wrapped in brackets)
  const isDynamicSegment = (segment) => segment.startsWith('[') && segment.endsWith(']');
  
  // Helper function to extract parameter name from dynamic segment
  const getParamName = (segment) => segment.slice(1, -1);
  
  // Helper function to normalize file paths for comparison
  const getRelativePath = (filePath) => {
    const relative = path.relative(rootPath, filePath);
    return relative.replace(/\\/g, '/');
  };
  
  // Check for exact file match
  const exactMatch = files.find(file => {
    const relativePath = getRelativePath(file);
    return relativePath === normalizeRequestPath;
  });
  
  if (exactMatch) {
    log(`Found exact match: ${exactMatch}`, 2);
    return [exactMatch, {}];
  }
  
  // Look for directory index files if request ends with / or is empty
  const isDirectoryRequest = requestPath === '/' || requestPath.endsWith('/') || !path.extname(requestPath);
  
  if (isDirectoryRequest) {
    log(`Processing directory request`, 3);
    const dirPath = normalizeRequestPath || '';
    const methodUpper = method.toUpperCase();
    
    // Priority order: METHOD.js, METHOD.html, index.js, index.html
    const indexFiles = [
      `${methodUpper}.js`,
      `${methodUpper}.html`,
      'index.js',
      'index.html'
    ];
    
    log(`Looking for index files: [${indexFiles.join(', ')}]`, 3);
    
    for (const indexFile of indexFiles) {
      const indexPath = dirPath ? `${dirPath}/${indexFile}` : indexFile;
      const exactIndexMatch = files.find(file => {
        const relativePath = getRelativePath(file);
        return relativePath === indexPath;
      });
      
      if (exactIndexMatch) {
        log(`Found index file: ${exactIndexMatch}`, 2);
        return [exactIndexMatch, {}];
      }
    }
  }
  
  // Look for dynamic routes
  log(`Searching for dynamic routes...`, 3);
  const dynamicMatches = [];
  
  for (const file of files) {
    const relativePath = getRelativePath(file);
    const fileSegments = relativePath.split('/');
    const fileName = fileSegments[fileSegments.length - 1];
    const fileDirSegments = fileSegments.slice(0, -1);
    
    // Check if this could be a dynamic match
    if (fileDirSegments.length !== requestSegments.length) {
      continue;
    }
    
    const pathParams = {};
    let isMatch = true;
    
    // Compare each segment
    for (let i = 0; i < fileDirSegments.length; i++) {
      const fileSegment = fileDirSegments[i];
      const requestSegment = requestSegments[i];
      
      if (isDynamicSegment(fileSegment)) {
        // This is a dynamic segment, capture the parameter
        const paramName = getParamName(fileSegment);
        pathParams[paramName] = requestSegment;
        log(`Dynamic match: [${paramName}] = ${requestSegment}`, 4);
      } else if (fileSegment !== requestSegment) {
        // Static segment doesn't match
        isMatch = false;
        break;
      }
    }
    
    if (isMatch) {
      // Check if this is an exact file match or directory index
      if (!isDirectoryRequest) {
        // Direct file match
        log(`Found dynamic file match: ${file}`, 3);
        dynamicMatches.push({ file, pathParams, priority: 0 });
      } else {
        // Directory request - check for index files
        const methodUpper = method.toUpperCase();
        const indexFiles = [
          `${methodUpper}.js`,
          `${methodUpper}.html`,
          'index.js',
          'index.html'
        ];
        
        const priority = indexFiles.indexOf(fileName);
        if (priority !== -1) {
          log(`Found dynamic directory match: ${file} (priority: ${priority})`, 3);
          dynamicMatches.push({ file, pathParams, priority });
        }
      }
    }
  }
  
  // Sort by priority (lower number = higher priority) and return the best match
  if (dynamicMatches.length > 0) {
    dynamicMatches.sort((a, b) => a.priority - b.priority);
    const bestMatch = dynamicMatches[0];
    log(`Best dynamic match: ${bestMatch.file} with params: ${JSON.stringify(bestMatch.pathParams)}`, 2);
    return [bestMatch.file, bestMatch.pathParams];
  }
  
  // No match found
  log(`No file found for: ${requestPath}`, 3);
  return [false, {}];
}