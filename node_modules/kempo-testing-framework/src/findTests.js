import fs from 'fs/promises';
import path from 'path';

const findFiles = async (testDirs, filter = '') => {
  const results = [];
  
  for (const dir of testDirs) {
    try {
      await fs.access(dir);
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isFile() && 
            entry.name.endsWith('test.js') &&
            entry.name.includes(filter)) {
          const entryPath = path.join(dir, entry.name);
          // Normalize path to always use forward slashes for consistency across platforms
          const relativePath = path.relative(process.cwd(), entryPath).replace(/\\/g, '/');
          results.push(relativePath);
        }
      }
    } catch (error) {
      // Directory doesn't exist, skip it
    }
  }
  return results;
};

export default async (suiteFilter, testFilter, browser = true, node = true) => {
  const testDirectories = ['tests', 'test']; // Only look in these directories
  const files = await findFiles(testDirectories, suiteFilter);
  
  const nodeTests = files.filter(file => (file.endsWith('.test.js') || file.endsWith('.node-test.js')) && node);
  const browserTests = files.filter(file => (file.endsWith('.test.js') || file.endsWith('.browser-test.js')) && browser);
  
  return {
    nodeTests,
    browserTests
  };
};
