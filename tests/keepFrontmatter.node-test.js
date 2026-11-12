import path from 'path';
import {readFile} from 'fs/promises';
import {withTempDir} from './utils/temp-dir.js';
import {write} from './utils/file-writer.js';
import {withSite as withServer} from './utils/with-site.js';
import {renderDir, withFrontmatter} from '../src/templating/index.js';

const template = '<html><body><location name="main" /></body></html>';
const expect = (condition, message) => {
  if(!condition) throw new Error(message);
};

const frontmatter = '<!--\n  owner: system\n  name: About\n  title: About\n-->';
const page = `${frontmatter}\n<page template="default" title="About"><content location="main"><h1>About Body</h1></content></page>`;

export default {
  'frontmatter is left out of a served page by default': async ({pass, fail}) => {
    try {
      await withServer({}, {'default.template.html': template, 'api/GET.page.html': page}, '/api', (r, body) => {
        expect(r.res.statusCode === 200, `expected 200, got ${r.res.statusCode}`);
        expect(body.includes('<h1>About Body</h1>'), `missing page content: ${body}`);
        expect(!body.includes('owner: system'), `frontmatter served by default: ${body}`);
        expect(!body.includes('<!--'), `comment served by default: ${body}`);
      });
      pass();
    } catch(e) {
      fail(e.message);
    }
  },

  'keepFrontmatter writes the frontmatter at the top of the response': async ({pass, fail}) => {
    try {
      await withServer({templating: {keepFrontmatter: true}}, {'default.template.html': template, 'api/GET.page.html': page}, '/api', (r, body) => {
        expect(r.res.statusCode === 200, `expected 200, got ${r.res.statusCode}`);
        expect(body.startsWith(frontmatter), `frontmatter not at top of response: ${body}`);
        expect(body.includes('<h1>About Body</h1>'), `missing page content: ${body}`);
        expect(!body.includes('<page'), `page tag leaked into response: ${body}`);
      });
      pass();
    } catch(e) {
      fail(e.message);
    }
  },

  'keepFrontmatter applies to SSR-rendered pages': async ({pass, fail}) => {
    try {
      const config = {templating: {ssr: true, ssrPriority: true, keepFrontmatter: true}};
      await withServer(config, {'default.template.html': template, 'about.page.html': page, 'about.html': '<p>static</p>'}, '/about', (r, body) => {
        expect(body.startsWith(frontmatter), `SSR response missing frontmatter: ${body}`);
        expect(body.includes('<h1>About Body</h1>'), `SSR response missing content: ${body}`);
      });
      pass();
    } catch(e) {
      fail(e.message);
    }
  },

  'keepFrontmatter applies to the CATCH 404 page': async ({pass, fail}) => {
    try {
      const catchPage = `${frontmatter}\n<page template="default" title="Missing"><content location="main"><h1>Nope</h1></content></page>`;
      await withServer({templating: {keepFrontmatter: true}}, {'default.template.html': template, 'CATCH.page.html': catchPage}, '/nowhere', (r, body) => {
        expect(r.res.statusCode === 404, `expected 404, got ${r.res.statusCode}`);
        expect(body.startsWith(frontmatter), `CATCH response missing frontmatter: ${body}`);
      });
      await withServer({}, {'default.template.html': template, 'CATCH.page.html': catchPage}, '/nowhere', (r, body) => {
        expect(!body.includes('owner: system'), `CATCH served frontmatter by default: ${body}`);
      });
      pass();
    } catch(e) {
      fail(e.message);
    }
  },

  'renderDir strips frontmatter unless keepFrontmatter is passed': async ({pass, fail}) => {
    try {
      await withTempDir(async dir => {
        const input = path.join(dir, 'input');
        await write(dir, 'input/default.template.html', template);
        await write(dir, 'input/about.page.html', page);
        await renderDir(input, path.join(dir, 'stripped'));
        await renderDir(input, path.join(dir, 'kept'), {}, {}, 10, true);
        const stripped = (await readFile(path.join(dir, 'stripped/about.html'), 'utf8'));
        const kept = (await readFile(path.join(dir, 'kept/about.html'), 'utf8'));
        expect(!stripped.includes('owner: system'), `preRender kept frontmatter by default: ${stripped}`);
        expect(kept.startsWith(frontmatter), `preRender missing kept frontmatter: ${kept}`);
      });
      pass();
    } catch(e) {
      fail(e.message);
    }
  },

  'withFrontmatter leaves html alone when there is no frontmatter': async ({pass, fail}) => {
    try {
      await withTempDir(async dir => {
        await write(dir, 'bare.page.html', '<page template="default"><content location="main">Hi</content></page>');
        const html = '<p>Hi</p>';
        const result = await withFrontmatter(path.join(dir, 'bare.page.html'), html, true);
        expect(result === html, `expected unchanged html, got: ${result}`);
      });
      pass();
    } catch(e) {
      fail(e.message);
    }
  }
};
