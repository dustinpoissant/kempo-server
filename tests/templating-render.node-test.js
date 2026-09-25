import { renderPage, renderDir } from '../src/templating/index.js';
import { writeFile, mkdir, readFile } from 'fs/promises';
import path from 'path';
import { withTempDir } from './utils/temp-dir.js';

const setupFiles = async (dir, files) => {
  for(const [rel, content] of Object.entries(files)){
    const full = path.join(dir, rel);
    await mkdir(path.dirname(full), {recursive: true});
    await writeFile(full, content, 'utf8');
  }
};

export default {
  'renderPage basic template + page': async ({pass, fail}) => {
    await withTempDir(async dir => {
      await setupFiles(dir, {
        'default.template.html': '<html><body><location name="main" /></body></html>',
        'index.page.html': '<page template="default"><content location="main"><h1>Hello</h1></content></page>'
      });
      const html = await renderPage(path.join(dir, 'index.page.html'), dir);
      if(!html.includes('<h1>Hello</h1>')) throw new Error(`missing content: ${html}`);
      if(!html.includes('<html>')) throw new Error(`missing template wrapper: ${html}`);
      pass();
    });
  },
  'renderPage resolves variables': async ({pass, fail}) => {
    await withTempDir(async dir => {
      await setupFiles(dir, {
        'default.template.html': '<title>{{title}}</title><location name="main" />',
        'index.page.html': '<page template="default" title="My Page"><content location="main">body</content></page>'
      });
      const html = await renderPage(path.join(dir, 'index.page.html'), dir);
      if(!html.includes('<title>My Page</title>')) throw new Error(`title not resolved: ${html}`);
      pass();
    });
  },
  'renderPage resolves globals': async ({pass, fail}) => {
    await withTempDir(async dir => {
      await setupFiles(dir, {
        'default.template.html': '{{siteName}}<location name="main" />',
        'index.page.html': '<page template="default"><content location="main">x</content></page>'
      });
      const html = await renderPage(path.join(dir, 'index.page.html'), dir, {siteName: 'MySite'});
      if(!html.includes('MySite')) throw new Error(`global not resolved: ${html}`);
      pass();
    });
  },
  'renderPage resolves state': async ({pass, fail}) => {
    await withTempDir(async dir => {
      await setupFiles(dir, {
        'default.template.html': '{{greeting}}<location name="main" />',
        'index.page.html': '<page template="default"><content location="main">x</content></page>'
      });
      const html = await renderPage(path.join(dir, 'index.page.html'), dir, {}, {greeting: 'Hi'});
      if(!html.includes('Hi')) throw new Error(`state not resolved: ${html}`);
      pass();
    });
  },
  'renderPage resolves fragments': async ({pass, fail}) => {
    await withTempDir(async dir => {
      await setupFiles(dir, {
        'default.template.html': '<fragment name="header" /><location name="main" />',
        'header.fragment.html': '<header>Site Header</header>',
        'index.page.html': '<page template="default"><content location="main">body</content></page>'
      });
      const html = await renderPage(path.join(dir, 'index.page.html'), dir);
      if(!html.includes('<header>Site Header</header>')) throw new Error(`fragment not resolved: ${html}`);
      pass();
    });
  },
  'renderPage resolves if blocks': async ({pass, fail}) => {
    await withTempDir(async dir => {
      await setupFiles(dir, {
        'default.template.html': '<location name="main" />',
        'index.page.html': '<page template="default"><content location="main"><if condition="show">visible</if></content></page>'
      });
      const shown = await renderPage(path.join(dir, 'index.page.html'), dir, {show: true});
      if(!shown.includes('visible')) throw new Error('should show when true');
      const hidden = await renderPage(path.join(dir, 'index.page.html'), dir, {show: false});
      if(hidden.includes('visible')) throw new Error('should hide when false');
      pass();
    });
  },
  'renderPage resolves foreach blocks': async ({pass, fail}) => {
    await withTempDir(async dir => {
      await setupFiles(dir, {
        'default.template.html': '<location name="main" />',
        'index.page.html': '<page template="default"><content location="main"><foreach in="items" as="item"><li>{{item}}</li></foreach></content></page>'
      });
      const html = await renderPage(path.join(dir, 'index.page.html'), dir, {items: ['a', 'b']});
      if(!html.includes('<li>a</li>')) throw new Error(`missing a: ${html}`);
      if(!html.includes('<li>b</li>')) throw new Error(`missing b: ${html}`);
      pass();
    });
  },
  'renderPage calculates pathToRoot': async ({pass, fail}) => {
    await withTempDir(async dir => {
      await setupFiles(dir, {
        'default.template.html': '{{pathToRoot}}<location name="main" />',
        'sub/deep/index.page.html': '<page template="default"><content location="main">x</content></page>'
      });
      const html = await renderPage(path.join(dir, 'sub', 'deep', 'index.page.html'), dir);
      if(!html.includes('../../')) throw new Error(`pathToRoot wrong: ${html}`);
      pass();
    });
  },
  'renderPage location fallback when content block not provided': async ({pass, fail}) => {
    await withTempDir(async dir => {
      await setupFiles(dir, {
        'default.template.html': '<location name="main">default content</location>',
        'index.page.html': '<page template="default"></page>'
      });
      const html = await renderPage(path.join(dir, 'index.page.html'), dir);
      if(!html.includes('default content')) throw new Error(`fallback not used: ${html}`);
      pass();
    });
  },
  'renderPage throws on missing template': async ({pass, fail}) => {
    await withTempDir(async dir => {
      await setupFiles(dir, {
        'index.page.html': '<page template="missing"><content location="main">x</content></page>'
      });
      try {
        await renderPage(path.join(dir, 'index.page.html'), dir);
        fail('should have thrown');
      } catch(e){
        if(!e.message.includes('Template not found')) throw new Error(`wrong error: ${e.message}`);
        pass();
      }
    });
  },
  'renderPage function globals are called': async ({pass, fail}) => {
    await withTempDir(async dir => {
      await setupFiles(dir, {
        'default.template.html': '{{fn}}<location name="main" />',
        'index.page.html': '<page template="default"><content location="main">x</content></page>'
      });
      const html = await renderPage(path.join(dir, 'index.page.html'), dir, {fn: () => 'called'});
      if(!html.includes('called')) throw new Error(`function not called: ${html}`);
      pass();
    });
  },
  'renderDir renders all page files and returns count': async ({pass, fail}) => {
    await withTempDir(async dir => {
      await setupFiles(dir, {
        'default.template.html': '<location name="main" />',
        'index.page.html': '<page template="default"><content location="main">home</content></page>',
        'about.page.html': '<page template="default"><content location="main">about</content></page>',
        'sub/index.page.html': '<page template="default"><content location="main">sub</content></page>'
      });
      const outDir = path.join(dir, 'out');
      const count = await renderDir(dir, outDir);
      if(count !== 3) throw new Error(`expected 3, got ${count}`);
      const home = await readFile(path.join(outDir, 'index.html'), 'utf8');
      if(!home.includes('home')) throw new Error(`home content wrong: ${home}`);
      const about = await readFile(path.join(outDir, 'about.html'), 'utf8');
      if(!about.includes('about')) throw new Error(`about content wrong: ${about}`);
      const sub = await readFile(path.join(outDir, 'sub', 'index.html'), 'utf8');
      if(!sub.includes('sub')) throw new Error(`sub content wrong: ${sub}`);
      pass();
    });
  },
  'renderDir with same input and output overwrites in place': async ({pass, fail}) => {
    await withTempDir(async dir => {
      await setupFiles(dir, {
        'default.template.html': '<location name="main" />',
        'index.page.html': '<page template="default"><content location="main">content</content></page>'
      });
      const count = await renderDir(dir, dir);
      if(count !== 1) throw new Error(`expected 1, got ${count}`);
      const html = await readFile(path.join(dir, 'index.html'), 'utf8');
      if(!html.includes('content')) throw new Error(`content wrong: ${html}`);
      pass();
    });
  },
  'renderPage includes year built-in': async ({pass, fail}) => {
    await withTempDir(async dir => {
      await setupFiles(dir, {
        'default.template.html': '{{year}}<location name="main" />',
        'index.page.html': '<page template="default"><content location="main">x</content></page>'
      });
      const html = await renderPage(path.join(dir, 'index.page.html'), dir);
      if(!html.includes(String(new Date().getFullYear()))) throw new Error(`year missing: ${html}`);
      pass();
    });
  },
  'renderPage injects global content into template location': async ({pass, fail}) => {
    await withTempDir(async dir => {
      await setupFiles(dir, {
        'default.template.html': '<head><location name="head" /></head><body><location name="main" /></body>',
        'site.global.html': '<content location="head"><meta charset="utf-8"></content>',
        'index.page.html': '<page template="default"><content location="main">hello</content></page>'
      });
      const html = await renderPage(path.join(dir, 'index.page.html'), dir);
      if(!html.includes('<meta charset="utf-8">')) throw new Error(`global head missing: ${html}`);
      if(!html.includes('hello')) throw new Error(`page content missing: ${html}`);
      pass();
    });
  },
  'renderPage merges page and global content into same location': async ({pass, fail}) => {
    await withTempDir(async dir => {
      await setupFiles(dir, {
        'default.template.html': '<location name="scripts" />',
        'site.global.html': '<content location="scripts"><script src="analytics.js"></script></content>',
        'index.page.html': '<page template="default"><content location="scripts"><script src="page.js"></script></content></page>'
      });
      const html = await renderPage(path.join(dir, 'index.page.html'), dir);
      if(!html.includes('analytics.js')) throw new Error(`global script missing: ${html}`);
      if(!html.includes('page.js')) throw new Error(`page script missing: ${html}`);
      pass();
    });
  },
  'renderPage respects priority ordering — higher number first': async ({pass, fail}) => {
    await withTempDir(async dir => {
      await setupFiles(dir, {
        'default.template.html': '<location name="scripts" />',
        'site.global.html': '<content location="scripts" priority="10">FIRST</content><content location="scripts" priority="1">LAST</content>',
        'index.page.html': '<page template="default"></page>'
      });
      const html = await renderPage(path.join(dir, 'index.page.html'), dir);
      if(html.indexOf('FIRST') > html.indexOf('LAST')) throw new Error(`wrong order: ${html}`);
      pass();
    });
  },
  'renderPage page content priority beats global at same location': async ({pass, fail}) => {
    await withTempDir(async dir => {
      await setupFiles(dir, {
        'default.template.html': '<location name="scripts" />',
        'site.global.html': '<content location="scripts" priority="0">global</content>',
        'index.page.html': '<page template="default"><content location="scripts" priority="5">page</content></page>'
      });
      const html = await renderPage(path.join(dir, 'index.page.html'), dir);
      if(html.indexOf('page') > html.indexOf('global')) throw new Error(`page should come before global: ${html}`);
      pass();
    });
  },
  'renderPage fills locations inside page content from globals': async ({pass, fail}) => {
    await withTempDir(async dir => {
      await setupFiles(dir, {
        'default.template.html': '<location name="main" />',
        'site.global.html': '<content location="badge"><span class="badge">NEW</span></content>',
        'index.page.html': '<page template="default"><content location="main"><h1>Title</h1><location name="badge" /></content></page>'
      });
      const html = await renderPage(path.join(dir, 'index.page.html'), dir);
      if(!html.includes('<span class="badge">NEW</span>')) throw new Error(`badge missing: ${html}`);
      pass();
    });
  },
  'renderPage loads globals from subdirectories': async ({pass, fail}) => {
    await withTempDir(async dir => {
      await setupFiles(dir, {
        'default.template.html': '<location name="head" /><location name="main" />',
        'sub/site.global.html': '<content location="head">subglobal</content>',
        'index.page.html': '<page template="default"><content location="main">x</content></page>'
      });
      const html = await renderPage(path.join(dir, 'index.page.html'), dir);
      if(!html.includes('subglobal')) throw new Error(`subdir global missing: ${html}`);
      pass();
    });
  },
  'renderDir applies global content to all pages': async ({pass, fail}) => {
    await withTempDir(async dir => {
      await setupFiles(dir, {
        'default.template.html': '<location name="head" /><location name="main" />',
        'site.global.html': '<content location="head"><meta name="global"></content>',
        'index.page.html': '<page template="default"><content location="main">home</content></page>',
        'about.page.html': '<page template="default"><content location="main">about</content></page>'
      });
      const outDir = path.join(dir, 'out');
      await renderDir(dir, outDir);
      const home = await readFile(path.join(outDir, 'index.html'), 'utf8');
      const about = await readFile(path.join(outDir, 'about.html'), 'utf8');
      if(!home.includes('<meta name="global">')) throw new Error(`home missing global: ${home}`);
      if(!about.includes('<meta name="global">')) throw new Error(`about missing global: ${about}`);
      pass();
    });
  }
};
