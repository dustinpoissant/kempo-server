import fs from 'fs/promises';
import path from 'path';

export const ensureDir = async dirPath => {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    if(error.code !== 'EEXIST') {
      throw error;
    }
  }
};

export const copyDir = async (src, dest) => {
  await ensureDir(dest);
  const entries = await fs.readdir(src, { withFileTypes: true });
  
  for(const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if(entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
};

export const emptyDir = async dirPath => {
  try {
    const entries = await fs.readdir(dirPath);
    await Promise.all(entries.map(entry => 
      fs.rm(path.join(dirPath, entry), { recursive: true, force: true })
    ));
  } catch (error) {
    if(error.code !== 'ENOENT') {
      throw error;
    }
  }
};
