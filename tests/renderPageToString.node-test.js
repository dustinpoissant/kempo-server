import { renderPageToString } from '../src/templating/index.js';
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

export default {
  'renderPageToString returns html string': async ({pass, fail}) => {
    await withTempDir(async dir => {
      await setupFiles(dir, {
        'default.template.html': '<html><body><location name="main" /></body></html>',
        'index.page.html': '<page><content location="main"><h1>Hello</h1></content></page>'
      });
      const html = await renderPageToString(path.join(dir, 'index.page.html'));
      if(typeof html !== 'string') return fail(`expected string, got ${typeof html}`);
      if(!html.includes('<h1>Hello</h1>')) return fail(`missing content: ${html}`);
      if(!html.includes('<html>')) return fail(`missing template: ${html}`);
      pass();
    });
  },

  'renderPageToString interpolates vars': async ({pass, fail}) => {
    await withTempDir(async dir => {
      await setupFiles(dir, {
        'default.template.html': '<location name="main" />',
        'welcome.page.html': '<page><content location="main">Hello {{userName}}</content></page>'
      });
      const html = await renderPageToString(path.join(dir, 'welcome.page.html'), {userName: 'Alice'});
      if(!html.includes('Hello Alice')) return fail(`var not interpolated: ${html}`);
      pass();
    });
  },

  'renderPageToString uses named template': async ({pass, fail}) => {
    await withTempDir(async dir => {
      await setupFiles(dir, {
        'email.template.html': '<email><location name="body" /></email>',
        'welcome.page.html': '<page template="email"><content location="body">Welcome!</content></page>'
      });
      const html = await renderPageToString(path.join(dir, 'welcome.page.html'));
      if(!html.includes('<email>')) return fail(`email template not used: ${html}`);
      if(!html.includes('Welcome!')) return fail(`content missing: ${html}`);
      pass();
    });
  },

  'renderPageToString injects fragments': async ({pass, fail}) => {
    await withTempDir(async dir => {
      await setupFiles(dir, {
        'email.template.html': '<fragment name="signature" /><location name="body" />',
        'signature.fragment.html': '<p>Best regards, Acme Corp</p>',
        'welcome.page.html': '<page template="email"><content location="body">Hi there</content></page>'
      });
      const html = await renderPageToString(path.join(dir, 'welcome.page.html'));
      if(!html.includes('Best regards, Acme Corp')) return fail(`fragment missing: ${html}`);
      if(!html.includes('Hi there')) return fail(`body missing: ${html}`);
      pass();
    });
  },

  'renderPageToString uses global content': async ({pass, fail}) => {
    await withTempDir(async dir => {
      await setupFiles(dir, {
        'email.template.html': '<location name="promo" /><location name="body" />',
        'promo.global.html': '<content location="promo"><b>Summer Sale!</b></content>',
        'welcome.page.html': '<page template="email"><content location="body">Welcome</content></page>'
      });
      const html = await renderPageToString(path.join(dir, 'welcome.page.html'));
      if(!html.includes('<b>Summer Sale!</b>')) return fail(`global promo missing: ${html}`);
      if(!html.includes('Welcome')) return fail(`body missing: ${html}`);
      pass();
    });
  },

  'renderPageToString processes if conditionals': async ({pass, fail}) => {
    await withTempDir(async dir => {
      await setupFiles(dir, {
        'default.template.html': '<location name="main" />',
        'reset.page.html': '<page><content location="main"><if condition="resetLink">Click {{resetLink}}</if></content></page>'
      });
      const withLink = await renderPageToString(path.join(dir, 'reset.page.html'), {resetLink: 'https://example.com/reset'});
      if(!withLink.includes('Click https://example.com/reset')) return fail(`link not rendered: ${withLink}`);
      const withoutLink = await renderPageToString(path.join(dir, 'reset.page.html'), {});
      if(withoutLink.includes('Click')) return fail(`should be hidden: ${withoutLink}`);
      pass();
    });
  },

  'renderPageToString processes foreach loops': async ({pass, fail}) => {
    await withTempDir(async dir => {
      await setupFiles(dir, {
        'default.template.html': '<location name="main" />',
        'order.page.html': '<page><content location="main"><foreach in="items" as="item"><li>{{item}}</li></foreach></content></page>'
      });
      const html = await renderPageToString(path.join(dir, 'order.page.html'), {items: ['Widget', 'Gadget']});
      if(!html.includes('<li>Widget</li>')) return fail(`Widget missing: ${html}`);
      if(!html.includes('<li>Gadget</li>')) return fail(`Gadget missing: ${html}`);
      pass();
    });
  },

  'renderPageToString accepts explicit rootDir': async ({pass, fail}) => {
    await withTempDir(async dir => {
      await setupFiles(dir, {
        'email.template.html': '<location name="body" />',
        'emails/welcome.page.html': '<page template="email"><content location="body">Hi</content></page>'
      });
      const pagePath = path.join(dir, 'emails', 'welcome.page.html');
      const html = await renderPageToString(pagePath, {}, dir);
      if(!html.includes('Hi')) return fail(`content missing with explicit rootDir: ${html}`);
      pass();
    });
  },

  'renderPageToString page attributes override vars': async ({pass, fail}) => {
    await withTempDir(async dir => {
      await setupFiles(dir, {
        'default.template.html': '<title>{{title}}</title><location name="main" />',
        'welcome.page.html': '<page title="Page Title"><content location="main">x</content></page>'
      });
      // page attributes take highest priority — they override vars with same key
      const html = await renderPageToString(path.join(dir, 'welcome.page.html'), {title: 'Var Title'});
      if(!html.includes('<title>Page Title</title>')) return fail(`page attr should win: ${html}`);
      pass();
    });
  },

  'renderPageToString throws on missing template': async ({pass, fail}) => {
    await withTempDir(async dir => {
      await setupFiles(dir, {
        'welcome.page.html': '<page template="email"><content location="body">hi</content></page>'
      });
      try {
        await renderPageToString(path.join(dir, 'welcome.page.html'));
        fail('should have thrown');
      } catch(e){
        if(!e.message.includes('Template not found')) return fail(`wrong error: ${e.message}`);
        pass();
      }
    });
  },

  'renderPageToString includes built-in year var': async ({pass, fail}) => {
    await withTempDir(async dir => {
      await setupFiles(dir, {
        'default.template.html': '{{year}}<location name="main" />',
        'index.page.html': '<page><content location="main">x</content></page>'
      });
      const html = await renderPageToString(path.join(dir, 'index.page.html'));
      if(!html.includes(String(new Date().getFullYear()))) return fail(`year missing: ${html}`);
      pass();
    });
  },

  'renderPageToString shared template across multiple pages': async ({pass, fail}) => {
    await withTempDir(async dir => {
      await setupFiles(dir, {
        'email.template.html': '<html><body><location name="body" /></body></html>',
        'welcome.page.html': '<page template="email"><content location="body">Welcome email</content></page>',
        'reset.page.html': '<page template="email"><content location="body">Reset email</content></page>'
      });
      const [welcome, reset] = await Promise.all([
        renderPageToString(path.join(dir, 'welcome.page.html')),
        renderPageToString(path.join(dir, 'reset.page.html'))
      ]);
      if(!welcome.includes('<html>') || !welcome.includes('Welcome email')) return fail(`welcome wrong: ${welcome}`);
      if(!reset.includes('<html>') || !reset.includes('Reset email')) return fail(`reset wrong: ${reset}`);
      pass();
    });
  }
};
