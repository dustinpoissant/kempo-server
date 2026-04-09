import { readdir, readFile, writeFile, mkdir, copyFile } from 'fs/promises';
import { join, dirname } from 'path';
import { minify } from 'terser';
import { fileURLToPath } from 'url';
import { renderDir } from '../src/templating/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const srcDir = join(rootDir, 'src');
const utilsDir = join(rootDir, 'utils');
const distDir = join(rootDir, 'dist');

/*
  File Processing Helper
*/
const processJsFile = async (srcPath, distPath) => {
  const fileName = distPath.split(/[/\\]/).pop();
  console.log(`Minifying ${fileName}...`);
  
  // Read source file
  let sourceCode = await readFile(srcPath, 'utf8');
  
  // Check for and preserve shebang
  let shebang = '';
  if (sourceCode.startsWith('#!')) {
    const firstNewline = sourceCode.indexOf('\n');
    shebang = sourceCode.substring(0, firstNewline + 1);
    sourceCode = sourceCode.substring(firstNewline + 1);
  }
  
  // Minify with Terser
  const result = await minify(sourceCode, {
    module: true, // Enable ES module support
    format: {
      comments: false,
    },
    compress: {
      dead_code: true,
      drop_console: false,
      drop_debugger: true,
    },
    mangle: false, // Keep function names for better debugging
  });
  
  if (result.error) {
    throw new Error(`Minification failed for ${fileName}: ${result.error}`);
  }
  
  // Write minified file to dist with shebang if it existed
  const finalCode = shebang + result.code;
  await writeFile(distPath, finalCode);
  console.log(`✓ Built ${fileName}`);
};

/*
  Build Process
*/
const build = async () => {
  try {
    // Ensure dist directory exists
    await mkdir(distDir, { recursive: true });
    await mkdir(join(distDir, 'utils'), { recursive: true });
    
    console.log('Building JavaScript files...');
    
    // Process src directory
    const srcFiles = await readdir(srcDir);
    const srcJsFiles = srcFiles.filter(file => file.endsWith('.js'));
    
    for (const file of srcJsFiles) {
      await processJsFile(join(srcDir, file), join(distDir, file));
    }
    
    // Process utils directory
    const utilsFiles = await readdir(utilsDir);
    const utilsJsFiles = utilsFiles.filter(file => file.endsWith('.js'));
    
    for (const file of utilsJsFiles) {
      await processJsFile(join(utilsDir, file), join(distDir, 'utils', file));
    }
    
    // Process src/templating directory
    const templatingDir = join(srcDir, 'templating');
    await mkdir(join(distDir, 'templating'), { recursive: true });
    const templatingFiles = await readdir(templatingDir);
    const templatingJsFiles = templatingFiles.filter(file => file.endsWith('.js'));
    
    for (const file of templatingJsFiles) {
      await processJsFile(join(templatingDir, file), join(distDir, 'templating', file));
    }
    
    // Process render CLI script
    const scriptsDir = join(rootDir, 'scripts');
    await processJsFile(join(scriptsDir, 'render.js'), join(distDir, 'render.js'));
    
    // Render docs
    console.log('Rendering docs...');
    const docsSrcDir = join(rootDir, 'docs', 'src');
    const docsDistDir = join(rootDir, 'docs', 'dist');
    const docsCount = await renderDir(docsSrcDir, docsDistDir);
    console.log(`✓ Rendered ${docsCount} doc pages`);

    console.log('Build completed successfully!');
    
  } catch (error) {
    console.error('Build failed:', error.message);
    process.exit(1);
  }
};

build();
