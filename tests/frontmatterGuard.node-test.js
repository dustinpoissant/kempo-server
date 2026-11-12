import {withSite} from './utils/with-site.js';
import {withTestDir} from './utils/test-dir.js';
import {write} from './utils/file-writer.js';
import {log} from './utils/logging.js';
import {createMockReq} from './utils/mock-req.js';
import {createMockRes} from './utils/mock-res.js';
import serveStaticFile from '../src/serveStaticFile.js';
import defaultConfig from '../src/defaultConfig.js';
import {stripFrontmatter} from '../src/templating/frontmatter.js';

/*
  Kempo (the CMS) runs as custom middleware and writes its own responses, including the source of a `.page.html` it is
  asked for. Nothing kempo-server renders passes through it, so the guard around custom middleware is what keeps a
  page's frontmatter out of those responses.
*/
const expect = (condition, message) => {
  if(!condition) throw new Error(message);
};

const frontmatter = '<!--\n  owner: system\n  name: Source\n-->';
const source = `${frontmatter}\n<page template="default" title="Source">\n<content location="main"><h1>Source Body</h1></content>\n</page>\n`;
const withComment = '<!-- keep: me -->\n<p>hi</p>';

/*
  Each route writes the page source a different way: the way kempo's admin static branch does (writeHead with headers,
  then end), through the send helper, and in chunks, one of them splitting the comment.
*/
const middleware = `
import { readFile } from 'fs/promises';
import { join } from 'path';

export default ({ rootPath }) => async (req, res, next) => {
  const pathname = req.url.split('?')[0];
  const text = await readFile(join(rootPath, 'source.page.html'), 'utf8');
  if(pathname === '/raw/head.page.html'){
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': Buffer.byteLength(text) });
    res.end(text);
    return;
  }
  if(pathname === '/raw/send.page.html'){
    res.send(text);
    return;
  }
  if(pathname === '/raw/chunks.page.html'){
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.write(text.slice(0, 12));
    res.write(Buffer.from(text.slice(12)));
    res.end();
    return;
  }
  if(pathname === '/raw/flat.page.html'){
    res.writeHead(200, ['Content-Type', 'text/html; charset=utf-8', 'X-Form', 'flat']);
    res.end(text);
    return;
  }
  if(pathname === '/raw/pairs.page.html'){
    res.writeHead(200, [['Content-Type', 'text/html; charset=utf-8'], ['X-Form', 'pairs']]);
    res.end(text);
    return;
  }
  if(pathname === '/raw/other.html'){
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(${JSON.stringify(withComment)});
    return;
  }
  await next();
};
`;

const files = {'mw.mjs': middleware, 'source.page.html': source};
const config = extra => ({middleware: {custom: ['./mw.mjs']}, ...extra});

export default {
  'page source written by custom middleware loses its frontmatter, and Content-Length still matches': async ({pass, fail}) => {
    try {
      await withSite(config(), files, '/raw/head.page.html', (r, body) => {
        expect(r.res.statusCode === 200, `expected 200, got ${r.res.statusCode}`);
        expect(r.res.headers['content-type'].startsWith('text/html'), `content type lost: ${r.res.headers['content-type']}`);
        expect(!body.includes('owner: system') && !body.includes('<!--'), `frontmatter served: ${body}`);
        expect(body === stripFrontmatter(source), `unexpected body: ${JSON.stringify(body)}`);
        expect(Number(r.res.headers['content-length']) === r.body.length, `Content-Length ${r.res.headers['content-length']} for ${r.body.length} bytes`);
      });
      pass();
    } catch(e) {
      fail(e.message);
    }
  },

  'the send helper is guarded too': async ({pass, fail}) => {
    try {
      await withSite(config(), files, '/raw/send.page.html', (r, body) => {
        expect(body === stripFrontmatter(source), `unexpected body: ${JSON.stringify(body)}`);
      });
      pass();
    } catch(e) {
      fail(e.message);
    }
  },

  'a comment split across chunks is still stripped': async ({pass, fail}) => {
    try {
      await withSite(config(), files, '/raw/chunks.page.html', (r, body) => {
        expect(body === stripFrontmatter(source), `unexpected body: ${JSON.stringify(body)}`);
      });
      pass();
    } catch(e) {
      fail(e.message);
    }
  },

  'headers given to writeHead as a flat list or as pairs are kept': async ({pass, fail}) => {
    try {
      for(const form of ['flat', 'pairs']){
        await withSite(config(), files, `/raw/${form}.page.html`, (r, body) => {
          expect(r.res.headers['x-form'] === form, `${form}: header lost: ${r.res.headers['x-form']}`);
          expect(r.res.headers['content-type'].startsWith('text/html'), `${form}: content type lost`);
          expect(body === stripFrontmatter(source), `${form}: unexpected body: ${JSON.stringify(body)}`);
        });
      }
      pass();
    } catch(e) {
      fail(e.message);
    }
  },

  'keepFrontmatter leaves the source as the middleware wrote it': async ({pass, fail}) => {
    try {
      await withSite(config({templating: {keepFrontmatter: true}}), files, '/raw/head.page.html', (r, body) => {
        expect(body === source, `source was changed: ${JSON.stringify(body)}`);
        expect(Number(r.res.headers['content-length']) === r.body.length, 'Content-Length does not match');
      });
      pass();
    } catch(e) {
      fail(e.message);
    }
  },

  'a URL that is not a page source is not touched': async ({pass, fail}) => {
    try {
      await withSite(config(), files, '/raw/other.html', (r, body) => {
        expect(body === withComment, `body was changed: ${JSON.stringify(body)}`);
      });
      pass();
    } catch(e) {
      fail(e.message);
    }
  },

  'the guard steps aside once middleware calls next': async ({pass, fail}) => {
    try {
      const site = {
        ...files,
        'default.template.html': '<!-- site template -->\n<html><body><location name="main" /></body></html>',
        'about.page.html': '<page template="default"><content location="main"><h1>About</h1></content></page>'
      };
      await withSite(config(), site, '/about.page.html', (r, body) => {
        expect(r.res.statusCode === 200, `expected 200, got ${r.res.statusCode}`);
        expect(body.includes('<h1>About</h1>'), `page was not rendered: ${body}`);
        expect(body.startsWith('<!-- site template -->'), `rendered output was stripped: ${body}`);
      });
      pass();
    } catch(e) {
      fail(e.message);
    }
  },

  'serveStaticFile sends a page source without its frontmatter unless keepFrontmatter is set': async ({pass, fail}) => {
    try {
      await withTestDir(async dir => {
        const file = await write(dir, 'source.page.html', source);
        const plain = await write(dir, 'plain.html', withComment);

        const stripped = createMockRes();
        await serveStaticFile(file, createMockReq(), stripped, JSON.parse(JSON.stringify(defaultConfig)), log);
        expect(stripped.getBody().toString() === stripFrontmatter(source), `frontmatter served: ${stripped.getBody()}`);

        const kept = createMockRes();
        const keep = JSON.parse(JSON.stringify(defaultConfig));
        keep.templating.keepFrontmatter = true;
        await serveStaticFile(file, createMockReq(), kept, keep, log);
        expect(kept.getBody().toString() === source, `source was changed: ${kept.getBody()}`);

        const other = createMockRes();
        await serveStaticFile(plain, createMockReq(), other, JSON.parse(JSON.stringify(defaultConfig)), log);
        expect(other.getBody().toString() === withComment, `a plain html file was changed: ${other.getBody()}`);
      });
      pass();
    } catch(e) {
      fail(e.message);
    }
  },

  'stripFrontmatter removes a leading comment and the line break after it, and nothing else': async ({pass, fail}) => {
    try {
      expect(stripFrontmatter('<!--\n  a: 1\n-->\n<page></page>') === '<page></page>', 'comment and newline should go');
      expect(stripFrontmatter('<page><!-- not leading --></page>') === '<page><!-- not leading --></page>', 'a later comment must stay');
      expect(stripFrontmatter('<page></page>') === '<page></page>', 'text without frontmatter must stay');
      pass();
    } catch(e) {
      fail(e.message);
    }
  }
};
