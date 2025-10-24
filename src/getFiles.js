import { readdir, stat } from 'fs/promises';
import path from 'path';

export default async (root, config, log) => {
  log(`Starting directory scan from: ${root}`, 2);
  const paths = [];
  
  // Get file extension from path
  const getExtension = (filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    return ext.startsWith('.') ? ext.slice(1) : ext;
  };
  
  // Check if path matches any disallowed regex patterns
  const isDisallowed = (filePath) => {
    const relativePath = path.relative(root, filePath).replace(/\\/g, '/');
    const urlPath = '/' + relativePath;
    
    const disallowed = config.disallowedRegex.some(pattern => {
      const regex = new RegExp(pattern);
      return regex.test(urlPath) || regex.test(relativePath);
    });
    
    if (disallowed) {
      log(`Skipping disallowed file: ${relativePath}`, 4);
    }
    
    return disallowed;
  };
  
  // Check if file extension is in allowed MIME types
  const isAllowedMimeType = (filePath) => {
    const ext = getExtension(filePath);
    const allowed = config.allowedMimes.hasOwnProperty(ext);
    // If you ever need the MIME type, use config.allowedMimes[ext]?.mime
    if (!allowed) {
      log(`Skipping file with disallowed extension: ${path.relative(root, filePath)} (.${ext})`, 4);
    }
    return allowed;
  };
  
  // Recursive function to scan directories
  const scanDirectory = async (currentPath) => {
    try {
      const entries = await readdir(currentPath);
      log(`Scanning directory: ${path.relative(root, currentPath)} (${entries.length} entries)`, 3);
      
      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry);
        const stats = await stat(fullPath);
        
        if (stats.isDirectory()) {
          // Recursively scan subdirectories
          await scanDirectory(fullPath);
        } else if (stats.isFile()) {
          // Check if file should be included
          if (isAllowedMimeType(fullPath) && !isDisallowed(fullPath)) {
            paths.push(fullPath);
            log(`Added file: ${path.relative(root, fullPath)}`, 4);
          }
        }
      }
    } catch (error) {
      // Skip directories/files that can't be accessed
      log(`Could not access directory: ${currentPath} - ${error.message}`, 1);
    }
  };
  
  await scanDirectory(root);
  log(`Directory scan complete. Found ${paths.length} files`, 2);
  return paths;
}