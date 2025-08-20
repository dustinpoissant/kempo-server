import http from 'http';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let server;
let port;

export const startServer = async (_port = 3000) => {
  if(!server){
    port = _port;
    server = http.createServer(async (req, res) => {
      const basePath = req.url.split('?')[0];
      
      /*
       * Route Handling
       */
      if(basePath === '/'){
        res.writeHead(200, { 'Content-Type': 'text/html' });
        const testHtmlPath = path.join(__dirname, '..', 'test.html');
        res.end(await readFile(testHtmlPath, 'utf8'));
      } else if(basePath === '/runTests.js'){
        res.writeHead(200, { 'Content-Type': 'application/javascript' });
        const filePath = path.join(__dirname, 'runTests.js');
        res.end(await readFile(filePath, 'utf8'));
      }
      // Serve essential.css like the GUI server does
      else if (basePath === '/essential.css') {
        try {
          const cssPath = path.join(__dirname, '../node_modules/essentialcss/dist/essential.min.css');
          const css = await readFile(cssPath, 'utf8');
          res.writeHead(200, { 'Content-Type': 'text/css' });
          res.end(css);
        } catch (error) {
          console.error(`Error serving essential.css:`, error);
          res.writeHead(404);
          res.end('Not found');
        }
      } else if(['/favicon.ico', '/.well-known/appspecific/com.chrome.devtools.json'].includes(basePath)){
        res.writeHead(404);
        res.end('');
      } else {
        /*
         * Static File Serving
         */
        try {
          // First try from project root, e.g. /gui/components/* works already
          const primaryPath = `.${basePath}`;
          let fileContent = await readFile(primaryPath);
          const extension = basePath.split('.').pop().toLowerCase();
          let contentType = 'text/plain';
          switch(extension){
            case 'html': contentType = 'text/html'; break;
            case 'css': contentType = 'text/css'; break;
            case 'js': contentType = 'application/javascript'; break;
            case 'json': contentType = 'application/json'; break;
            case 'png': contentType = 'image/png'; break;
            case 'jpg': case 'jpeg': contentType = 'image/jpeg'; break;
            case 'gif': contentType = 'image/gif'; break;
            case 'svg': contentType = 'image/svg+xml'; break;
            case 'map': contentType = 'application/json'; break;
          }
          res.writeHead(200, { 'Content-Type': contentType });
          res.end(fileContent);
        } catch (primaryErr) {
          // If requesting a sourcemap, quietly 404 without noisy logs
          if (basePath.endsWith('.map')) {
            res.writeHead(404);
            res.end('Not found');
            return;
          }
          // If not found, try resolving under gui/ for assets like /icons/*
          try {
            const rel = basePath.replace(/^\//, '');
            const relUnderGui = rel.startsWith('gui/') ? rel : path.join('gui', rel);
            const fallbackPath = path.join(__dirname, '..', relUnderGui);
            const fileContent = await readFile(fallbackPath);
            const extension = basePath.split('.').pop().toLowerCase();
            let contentType = 'text/plain';
            switch(extension){
              case 'html': contentType = 'text/html'; break;
              case 'css': contentType = 'text/css'; break;
              case 'js': contentType = 'application/javascript'; break;
              case 'json': contentType = 'application/json'; break;
              case 'png': contentType = 'image/png'; break;
              case 'jpg': case 'jpeg': contentType = 'image/jpeg'; break;
              case 'gif': contentType = 'image/gif'; break;
              case 'svg': contentType = 'image/svg+xml'; break;
              case 'map': contentType = 'application/json'; break;
            }
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(fileContent);
          } catch (fallbackErr) {
            res.writeHead(404);
            res.end('Not found');
          }
        }
      }
    });
    await new Promise((resolve, reject) => {
      server.listen(port, err => err ? reject(err) : resolve());
    });
  }
  return `http://localhost:${port}`;
};

export const stopServer = async () => {
  if(server){
  await new Promise(resolve => server.close(resolve));
    server = null;
  }
};
