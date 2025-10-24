import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

let hasBuilt = false;

export default function ensureBuild() {
  if (hasBuilt) return;
  
  const distIndex = path.join(process.cwd(), 'dist/index.js');
  if (!fs.existsSync(distIndex)) {
    try {
      execSync('npm run build', { stdio: 'pipe' });
      console.log('✓ Build completed successfully');
    } catch (error) {
      console.error('✗ Build failed:', error.message);
      throw error;
    }
  }
  
  hasBuilt = true;
}