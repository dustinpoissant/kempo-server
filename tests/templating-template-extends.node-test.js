import { renderPage, renderExternalPage } from '../src/templating/index.js';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { withTempDir } from './utils/temp-dir.js';

const setupFiles = async (dir, files) => {
  for(const [rel, content] of Object.entries(files)){
    const full = path.join(dir, rel);
    await mkdir(path.dirname(full), {recursive: true});
    await writeFile(full, content, 'utf8');
  }
};

const DEFAULT = '<html><body><nav>SITE NAV</nav><location /><footer>SITE FOOTER</footer></body></html>';

export default {
  'a template extends another and wraps the page body': async ({pass, fail}) => {
    await withTempDir(async rootDir => {
      await setupFiles(rootDir, {
        'default.template.html': DEFAULT,
        'article.template.html': '<template extends="default"><content><article>WRAP<location /></article></content></template>',
        'page.page.html': '<page template="article"><content>PAGE BODY</content></page>'
      });
      const html = await renderPage(path.join(rootDir, 'page.page.html'), rootDir);
      if(!html.includes('SITE NAV')) return fail(`parent chrome missing: ${html}`);
      if(!html.includes('SITE FOOTER')) return fail(`parent footer missing: ${html}`);
      if(!/<article>WRAP\s*PAGE BODY<\/article>/.test(html)) return fail(`page body not wrapped by the child: ${html}`);
      if(html.includes('<template')) return fail(`raw <template> wrapper leaked: ${html}`);
      if(html.includes('<location')) return fail(`unfilled <location> left behind: ${html}`);
      pass();
    });
  },

  'a change to the parent reaches the child with nothing regenerated': async ({pass, fail}) => {
    await withTempDir(async rootDir => {
      await setupFiles(rootDir, {
        'default.template.html': DEFAULT,
        'article.template.html': '<template extends="default"><content><article><location /></article></content></template>',
        'page.page.html': '<page template="article"><content>BODY</content></page>'
      });
      const before = await renderPage(path.join(rootDir, 'page.page.html'), rootDir);
      if(before.includes('EDITED FOOTER')) return fail('unexpected content before the edit');

      // Edit the parent on disk, exactly as a developer would — no API call, no hook, no rebuild
      await setupFiles(rootDir, {
        'default.template.html': DEFAULT.replace('SITE FOOTER', 'EDITED FOOTER')
      });
      const after = await renderPage(path.join(rootDir, 'page.page.html'), rootDir);
      if(!after.includes('EDITED FOOTER')) return fail(`parent edit did not reach the child template: ${after}`);
      if(!after.includes('BODY')) return fail(`page body lost after the edit: ${after}`);
      pass();
    });
  },

  'a child can fill several named locations of its parent': async ({pass, fail}) => {
    await withTempDir(async rootDir => {
      await setupFiles(rootDir, {
        'default.template.html': '<html><head><location name="head" /></head><body><location /><location name="scripts" /></body></html>',
        'article.template.html': '<template extends="default">' +
          '<content location="head"><meta name="kind" content="article"></content>' +
          '<content><article><location /></article></content>' +
          '<content location="scripts"><script src="/a.js"></script></content>' +
          '</template>',
        'page.page.html': '<page template="article"><content>BODY</content></page>'
      });
      const html = await renderPage(path.join(rootDir, 'page.page.html'), rootDir);
      if(!html.includes('content="article"')) return fail(`named head content missing: ${html}`);
      if(!html.includes('/a.js')) return fail(`named scripts content missing: ${html}`);
      if(!/<article>BODY<\/article>/.test(html)) return fail(`body not wrapped: ${html}`);
      pass();
    });
  },

  'extending chains more than one level deep': async ({pass, fail}) => {
    await withTempDir(async rootDir => {
      await setupFiles(rootDir, {
        'default.template.html': '<html><body>A<location />Z</body></html>',
        'mid.template.html': '<template extends="default"><content>B<location />Y</content></template>',
        'leaf.template.html': '<template extends="mid"><content>C<location />X</content></template>',
        'page.page.html': '<page template="leaf"><content>BODY</content></page>'
      });
      const html = await renderPage(path.join(rootDir, 'page.page.html'), rootDir);
      if(!html.includes('ABCBODYXYZ')) return fail(`nesting order wrong, expected ABCBODYXYZ: ${html}`);
      pass();
    });
  },

  'the page still chooses which location to fill': async ({pass, fail}) => {
    await withTempDir(async rootDir => {
      await setupFiles(rootDir, {
        'default.template.html': '<html><body><location name="main" /><aside><location name="side" /></aside></body></html>',
        'article.template.html': '<template extends="default"><content location="main"><article><location name="main" /></article></content></template>',
        'page.page.html': '<page template="article"><content location="main">MAIN BODY</content><content location="side">SIDE</content></page>'
      });
      const html = await renderPage(path.join(rootDir, 'page.page.html'), rootDir);
      if(!/<article>MAIN BODY<\/article>/.test(html)) return fail(`page main content not placed: ${html}`);
      if(!html.includes('SIDE')) return fail(`page side content not placed: ${html}`);
      pass();
    });
  },

  'a child template can pull fragments, including from extra dirs': async ({pass, fail}) => {
    await withTempDir(async rootDir => {
      await withTempDir(async pluginDir => {
        await setupFiles(rootDir, {
          'default.template.html': DEFAULT,
          'article.template.html': '<template extends="default"><content><article><fragment name="byline" /><location /></article></content></template>',
          'page.page.html': '<page template="article"><content>BODY</content></page>'
        });
        await setupFiles(pluginDir, {
          'byline.fragment.html': '<fragment><span>BYLINE</span></fragment>'
        });
        const html = await renderExternalPage(
          path.join(rootDir, 'page.page.html'), rootDir, rootDir, {}, {}, 10, [], [pluginDir]
        );
        if(!html.includes('BYLINE')) return fail(`fragment not resolved inside an extending template: ${html}`);
        if(!html.includes('BODY')) return fail(`page body missing: ${html}`);
        pass();
      });
    });
  },

  'global content still fills locations the parent declares': async ({pass, fail}) => {
    await withTempDir(async rootDir => {
      await setupFiles(rootDir, {
        'default.template.html': '<html><body><location name="banner" /><location /></body></html>',
        'site.global.html': '<content location="banner">GLOBAL BANNER</content>',
        'article.template.html': '<template extends="default"><content><article><location /></article></content></template>',
        'page.page.html': '<page template="article"><content>BODY</content></page>'
      });
      const html = await renderPage(path.join(rootDir, 'page.page.html'), rootDir);
      if(!html.includes('GLOBAL BANNER')) return fail(`global content lost through composition: ${html}`);
      pass();
    });
  },

  'vars resolve across the composed template': async ({pass, fail}) => {
    await withTempDir(async rootDir => {
      await setupFiles(rootDir, {
        'default.template.html': '<html><head><title>{{title}}</title></head><body><location /></body></html>',
        'article.template.html': '<template extends="default"><content><article data-t="{{title}}"><location /></article></content></template>',
        'page.page.html': '<page template="article" title="Hello"><content>BODY</content></page>'
      });
      const html = await renderPage(path.join(rootDir, 'page.page.html'), rootDir);
      if(!html.includes('<title>Hello</title>')) return fail(`parent var unresolved: ${html}`);
      if(!html.includes('data-t="Hello"')) return fail(`child var unresolved: ${html}`);
      pass();
    });
  },

  'a standalone template is unaffected': async ({pass, fail}) => {
    await withTempDir(async rootDir => {
      await setupFiles(rootDir, {
        'default.template.html': DEFAULT,
        'page.page.html': '<page><content>BODY</content></page>'
      });
      const html = await renderPage(path.join(rootDir, 'page.page.html'), rootDir);
      if(!html.includes('SITE NAV') || !html.includes('BODY')) return fail(`plain template render changed: ${html}`);
      pass();
    });
  },

  'extending a template that does not exist throws': async ({pass, fail}) => {
    await withTempDir(async rootDir => {
      await setupFiles(rootDir, {
        'default.template.html': DEFAULT,
        'article.template.html': '<template extends="nope"><content>X</content></template>',
        'page.page.html': '<page template="article"><content>BODY</content></page>'
      });
      try {
        await renderPage(path.join(rootDir, 'page.page.html'), rootDir);
        fail('should have thrown');
      } catch(e){
        if(!/Template not found: nope/.test(e.message)) return fail(`wrong error: ${e.message}`);
        pass();
      }
    });
  },

  'a template extending itself throws rather than looping': async ({pass, fail}) => {
    await withTempDir(async rootDir => {
      await setupFiles(rootDir, {
        'default.template.html': DEFAULT,
        'loop.template.html': '<template extends="loop"><content>X</content></template>',
        'page.page.html': '<page template="loop"><content>BODY</content></page>'
      });
      try {
        await renderPage(path.join(rootDir, 'page.page.html'), rootDir);
        fail('should have thrown');
      } catch(e){
        if(!/extends itself|depth exceeded/.test(e.message)) return fail(`wrong error: ${e.message}`);
        pass();
      }
    });
  },

  'a mutual extends cycle throws rather than looping': async ({pass, fail}) => {
    await withTempDir(async rootDir => {
      await setupFiles(rootDir, {
        'default.template.html': DEFAULT,
        'a.template.html': '<template extends="b"><content>A</content></template>',
        'b.template.html': '<template extends="a"><content>B</content></template>',
        'page.page.html': '<page template="a"><content>BODY</content></page>'
      });
      try {
        await renderPage(path.join(rootDir, 'page.page.html'), rootDir);
        fail('should have thrown');
      } catch(e){
        if(!/depth exceeded/.test(e.message)) return fail(`wrong error: ${e.message}`);
        pass();
      }
    });
  },

  'a <template> wrapper with no extends throws': async ({pass, fail}) => {
    await withTempDir(async rootDir => {
      await setupFiles(rootDir, {
        'default.template.html': DEFAULT,
        'article.template.html': '<template><content>X</content></template>',
        'page.page.html': '<page template="article"><content>BODY</content></page>'
      });
      try {
        await renderPage(path.join(rootDir, 'page.page.html'), rootDir);
        fail('should have thrown');
      } catch(e){
        if(!/no "extends"/.test(e.message)) return fail(`wrong error: ${e.message}`);
        pass();
      }
    });
  }
};
