import path from 'path';
import { readFile, stat } from 'fs/promises';
import { createReadStream } from 'fs';

// Parses a `Range: bytes=...` header value against a known file size.
// Supports `start-end`, open-ended `start-`, and suffix `-N` (last N bytes)
// forms. Returns null for a missing/malformed/unsatisfiable range.
export const parseRange = (rangeHeader, size) => {
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

// Serves a file from disk with the correct MIME type, honoring `Range`
// requests for binary content (required for browsers to seek inside
// audio/video). Shared by serveFile.js (static files found via the normal
// file scan) and router.js's custom/wildcard route handling, which both
// need identical behavior here.
export default async (filePath, req, res, config, log) => {
  const fileExtension = path.extname(filePath).toLowerCase().slice(1);
  const mimeConfig = config.allowedMimes[fileExtension];
  let mimeType, encoding;
  if(typeof mimeConfig === 'string') {
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
  const rangeHeader = req?.headers?.range;
  if(encoding === undefined && rangeHeader){
    const { size } = await stat(filePath);
    const range = parseRange(rangeHeader, size);
    if(!range){
      log(`Unsatisfiable range "${rangeHeader}" for ${filePath}`, 2);
      res.writeHead(416, { 'Content-Range': `bytes */${size}` });
      res.end();
      return;
    }
    const { start, end } = range;
    log(`Serving ${filePath} range ${start}-${end}/${size}`, 2);
    res.writeHead(206, {
      'Content-Type': contentType,
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': end - start + 1
    });
    await new Promise((resolve, reject) => {
      const stream = createReadStream(filePath, { start, end });
      stream.on('data', (chunk) => res.write(chunk));
      stream.on('end', () => { res.end(); resolve(); });
      stream.on('error', reject);
    });
    return;
  }

  const fileContent = await readFile(filePath, encoding);
  log(`Serving ${filePath} as ${mimeType} (${fileContent.length} bytes)`, 2);
  const headers = { 'Content-Type': contentType };
  if(encoding === undefined) headers['Accept-Ranges'] = 'bytes';
  res.writeHead(200, headers);
  res.end(fileContent);
};
