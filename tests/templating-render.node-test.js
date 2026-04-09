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
      if(!html.includes('<h1>Hello</h1>')) return fail(`missing content: ${html}`);
      if(!html.includes('<html>')) return fail(`missing template wrapper: ${html}`);
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
      if(!html.includes('<title>My Page</title>')) return fail(`title not resolved: ${html}`);
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
      if(!html.includes('MySite')) return fail(`global not resolved: ${html}`);
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
      if(!html.includes('Hi')) return fail(`state not resolved: ${html}`);
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
      if(!html.includes('<header>Site Header</header>')) return fail(`fragment not resolved: ${html}`);
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
      if(!shown.includes('visible')) return fail('should show when true');
      const hidden = await renderPage(path.join(dir, 'index.page.html'), dir, {show: false});
      if(hidden.includes('visible')) return fail('should hide when false');
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
      if(!html.includes('<li>a</li>')) return fail(`missing a: ${html}`);
      if(!html.includes('<li>b</li>')) return fail(`missing b: ${html}`);
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
      if(!html.includes('../../')) return fail(`pathToRoot wrong: ${html}`);
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
      if(!html.includes('default content')) return fail(`fallback not used: ${html}`);
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
        if(!e.message.includes('Template not found')) return fail(`wrong error: ${e.message}`);
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
      if(!html.includes('called')) return fail(`function not called: ${html}`);
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
      if(count !== 3) return fail(`expected 3, got ${count}`);
      const home = await readFile(path.join(outDir, 'index.html'), 'utf8');
      if(!home.includes('home')) return fail(`home content wrong: ${home}`);
      const about = await readFile(path.join(outDir, 'about.html'), 'utf8');
      if(!about.includes('about')) return fail(`about content wrong: ${about}`);
      const sub = await readFile(path.join(outDir, 'sub', 'index.html'), 'utf8');
      if(!sub.includes('sub')) return fail(`sub content wrong: ${sub}`);
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
      if(count !== 1) return fail(`expected 1, got ${count}`);
      const html = await readFile(path.join(dir, 'index.html'), 'utf8');
      if(!html.includes('content')) return fail(`content wrong: ${html}`);
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
      if(!html.includes(String(new Date().getFullYear()))) return fail(`year missing: ${html}`);
      pass();
    });
  }
};
