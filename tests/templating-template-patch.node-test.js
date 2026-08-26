import { renderPage, renderExternalPage } from '../src/templating/index.js';
import { findById } from '../src/templating/patch.js';
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

// A plain template: HTML with a frontmatter comment, exactly as one is normally written
const TEMPLATE = '<!--\n  owner: system\n-->\n'
  + '<html><head><title>{{title}}</title></head>'
  + '<body class="site"><nav id="nav">NAV</nav><main id="main"><location /></main></body></html>';

const patch = body => `<!--\n  extends: default\n-->\n${body}`;

const render = async (dir, patchBody, pageAttrs = '') => {
  await setupFiles(dir, {
    'default.template.html': TEMPLATE,
    'post.template-patch.html': patch(patchBody),
    'post.page.html': `<page template="post" ${pageAttrs}><content>BODY</content></page>`
  });
  return renderPage(path.join(dir, 'post.page.html'), dir);
};

export default {
  'findById locates an element and where it ends': ({pass, fail}) => {
    const html = '<div><p id="x">hi</p></div>';
    const el = findById(html, 'x');
    if(!el) return fail('element not found');
    if(html.slice(el.innerStart, el.innerEnd) !== 'hi') return fail('inner offsets wrong');
    if(html.slice(el.outerStart, el.outerEnd) !== '<p id="x">hi</p>') return fail('outer offsets wrong');
    pass();
  },

  'findById counts depth rather than stopping at the first closing tag': ({pass, fail}) => {
    const html = '<div id="a">one<div>two</div>three</div>tail';
    const el = findById(html, 'a');
    if(!el) return fail('element not found');
    if(html.slice(el.innerStart, el.innerEnd) !== 'one<div>two</div>three'){
      return fail(`nested element cut short: ${html.slice(el.innerStart, el.innerEnd)}`);
    }
    pass();
  },

  'findById handles a self-closed element': ({pass, fail}) => {
    const html = '<body><my-el id="x" /><p>after</p></body>';
    const el = findById(html, 'x');
    if(!el) return fail('element not found');
    if(el.innerStart !== el.innerEnd) return fail('a self-closed element encloses nothing');
    if(html.slice(el.outerStart, el.outerEnd) !== '<my-el id="x" />') return fail('outer extent wrong');
    pass();
  },

  'findById ignores ids inside comments and scripts': ({pass, fail}) => {
    const commented = findById('<!-- <p id="x">ghost</p> --><p id="x">real</p>', 'x');
    if(!commented) return fail('no element found at all');
    if(commented.outerStart < 27) return fail('matched the commented-out element');

    const scripted = findById('<script>var s = \'<p id="y">ghost</p>\';</script><p id="y">real</p>', 'y');
    if(!scripted) return fail('no element found for the script case');
    if(scripted.outerStart < 46) return fail('matched inside the script body');
    pass();
  },

  'findById is not confused by > inside an attribute': ({pass, fail}) => {
    const html = '<if condition="a > b"><p id="x">hi</p></if>';
    const el = findById(html, 'x');
    if(!el) return fail('element not found past a > in an attribute value');
    if(html.slice(el.innerStart, el.innerEnd) !== 'hi') return fail('offsets wrong');
    pass();
  },

  'findById returns null for an id that is not there': ({pass, fail}) => {
    if(findById('<p id="a">x</p>', 'b') !== null) return fail('should not have matched');
    pass();
  },

  'a patch replaces an element by id': async ({pass, fail}) => {
    await withTempDir(async dir => {
      const html = await render(dir, '<replace id="main"><article id="post"><location /></article></replace>');
      if(!html.includes('<article id="post">BODY</article>')) return fail(`replacement missing: ${html}`);
      if(html.includes('<main')) return fail(`original element still present: ${html}`);
      if(!html.includes('NAV')) return fail(`unrelated markup was disturbed: ${html}`);
      pass();
    });
  },

  'a location inside the replacement still receives the page body': async ({pass, fail}) => {
    await withTempDir(async dir => {
      const html = await render(dir, '<replace id="main"><article>[<location />]</article></replace>');
      if(!html.includes('<article>[BODY]</article>')) return fail(`page body not placed: ${html}`);
      pass();
    });
  },

  'a patch is not applied to pages that do not name it': async ({pass, fail}) => {
    await withTempDir(async dir => {
      await setupFiles(dir, {
        'default.template.html': TEMPLATE,
        'post.template-patch.html': patch('<remove id="nav" />'),
        'plain.page.html': '<page title="Home"><content>BODY</content></page>'
      });
      const html = await renderPage(path.join(dir, 'plain.page.html'), dir);
      if(!html.includes('NAV')) return fail(`patch leaked into an unrelated page: ${html}`);
      pass();
    });
  },

  'inner, before, after, prepend, append and remove': async ({pass, fail}) => {
    await withTempDir(async dir => {
      const cases = {
        '<inner id="nav">NEW</inner>': '<nav id="nav">NEW</nav>',
        '<before id="nav">[B]</before>': '[B]<nav id="nav">',
        '<after id="nav">[A]</after>': '</nav>[A]',
        '<prepend id="nav">[P]</prepend>': '<nav id="nav">[P]NAV',
        '<append id="nav">[A]</append>': 'NAV[A]</nav>'
      };
      for(const [op, expected] of Object.entries(cases)){
        const html = await render(dir, op);
        if(!html.includes(expected)) return fail(`${op} produced no "${expected}": ${html}`);
      }
      const removed = await render(dir, '<remove id="nav" />');
      if(removed.includes('NAV')) return fail(`remove left the element: ${removed}`);
      if(!removed.includes('BODY')) return fail(`remove took too much: ${removed}`);
      pass();
    });
  },

  'attr sets attributes and merges classes without restating them': async ({pass, fail}) => {
    await withTempDir(async dir => {
      const html = await render(dir, '<attr id="main" add-class="has-article" data-kind="post" />');
      const main = html.match(/<main[^>]*>/)[0];
      if(!/class="has-article"/.test(main)) return fail(`class not added: ${main}`);
      if(!/data-kind="post"/.test(main)) return fail(`attribute not set: ${main}`);
      if(!/id="main"/.test(main)) return fail(`id was lost: ${main}`);
      pass();
    });
  },

  'attr can remove a class and keeps an element self-closing': async ({pass, fail}) => {
    await withTempDir(async dir => {
      await setupFiles(dir, {
        'default.template.html': '<body class="a"><my-el id="x" class="one two" /><location /></body>',
        'post.template-patch.html': patch('<attr id="x" remove-class="one" data-y="1" />'),
        'post.page.html': '<page template="post"><content>BODY</content></page>'
      });
      const html = await renderPage(path.join(dir, 'post.page.html'), dir);
      if(!/<my-el id="x" class="two" data-y="1" \/>/.test(html)) return fail(`self-closing element mangled: ${html}`);
      pass();
    });
  },

  'several operations apply in the order written': async ({pass, fail}) => {
    await withTempDir(async dir => {
      const html = await render(dir,
        '<replace id="main"><article id="post"><location /></article></replace>' +
        '<attr id="post" add-class="mark" />'
      );
      if(!/<article id="post" class="mark">/.test(html)) return fail(`later op could not target the earlier op's markup: ${html}`);
      pass();
    });
  },

  'a patch can also fill a location the template marked': async ({pass, fail}) => {
    await withTempDir(async dir => {
      await setupFiles(dir, {
        'default.template.html': '<body><location name="head-extra">DEFAULT</location><main id="main"><location /></main></body>',
        'post.template-patch.html': patch('<content location="head-extra">FROM PATCH</content><replace id="main"><article><location /></article></replace>'),
        'post.page.html': '<page template="post"><content>BODY</content></page>'
      });
      const html = await renderPage(path.join(dir, 'post.page.html'), dir);
      if(!html.includes('FROM PATCH')) return fail(`content block not applied: ${html}`);
      if(html.includes('DEFAULT')) return fail(`default content not overridden: ${html}`);
      if(!html.includes('<article>BODY</article>')) return fail(`patch op not applied: ${html}`);
      pass();
    });
  },

  'locations the patch leaves alone still reach the page and global content': async ({pass, fail}) => {
    await withTempDir(async dir => {
      await setupFiles(dir, {
        'default.template.html': '<body><location name="banner" /><location name="side" /><main id="main"><location /></main></body>',
        'site.global.html': '<content location="banner">GLOBAL</content>',
        'post.template-patch.html': patch('<replace id="main"><article><location /></article></replace>'),
        'post.page.html': '<page template="post"><content>BODY</content><content location="side">SIDE</content></page>'
      });
      const html = await renderPage(path.join(dir, 'post.page.html'), dir);
      if(!html.includes('GLOBAL')) return fail(`global content lost: ${html}`);
      if(!html.includes('SIDE')) return fail(`page's named content lost: ${html}`);
      pass();
    });
  },

  'patches chain: a patch may extend another patch': async ({pass, fail}) => {
    await withTempDir(async dir => {
      await setupFiles(dir, {
        'default.template.html': '<body class="site"><main id="main"><location /></main></body>',
        'mid.template-patch.html': '<!--\n  extends: default\n-->\n<attr id="main" add-class="mid" />',
        'leaf.template-patch.html': '<!--\n  extends: mid\n-->\n<attr id="main" add-class="leaf" />',
        'post.page.html': '<page template="leaf"><content>BODY</content></page>'
      });
      const html = await renderPage(path.join(dir, 'post.page.html'), dir);
      if(!/class="mid leaf"/.test(html)) return fail(`chain did not accumulate: ${html}`);
      pass();
    });
  },

  'an id the template does not have is skipped, not fatal': async ({pass, fail}) => {
    await withTempDir(async dir => {
      /*
        A patch and the template it patches ship on different release cycles. Core removing a
        section an extension still targets must not take the page down with it.
      */
      const html = await render(dir, '<replace id="nope">GONE</replace>');
      if(html.includes('GONE')) return fail(`a missing target should apply nothing: ${html}`);
      if(!html.includes('BODY')) return fail(`the page should still render: ${html}`);
      if(!html.includes('NAV')) return fail(`the template should be intact: ${html}`);
      pass();
    });
  },

  'the rest of a patch still applies when one operation is skipped': async ({pass, fail}) => {
    await withTempDir(async dir => {
      const html = await render(dir,
        '<replace id="nope">GONE</replace>' +
        '<replace id="main"><article id="post"><location /></article></replace>'
      );
      if(html.includes('GONE')) return fail(`skipped op leaked: ${html}`);
      if(!html.includes('<article id="post">BODY</article>')) return fail(`the applicable op did not run: ${html}`);
      pass();
    });
  },

  'a skipped operation is reported rather than passing in silence': async ({pass, fail}) => {
    const seen = [];
    const original = console.warn;
    console.warn = msg => seen.push(String(msg));
    try {
      await withTempDir(async dir => {
        // A unique id so the once-per-problem warning is not suppressed by an earlier test
        await render(dir, '<replace id="absent-in-this-test">x</replace>');
      });
    } finally {
      console.warn = original;
    }
    if(!seen.some(m => m.includes('absent-in-this-test'))){
      return fail(`nothing was logged; a patch that stops applying must not do so invisibly: ${JSON.stringify(seen)}`);
    }
    pass();
  },

  'an operation with no id is skipped too': async ({pass, fail}) => {
    await withTempDir(async dir => {
      const html = await render(dir, '<replace>GONE</replace>');
      if(html.includes('GONE')) return fail(`an op with no id should apply nothing: ${html}`);
      if(!html.includes('BODY')) return fail(`the page should still render: ${html}`);
      pass();
    });
  },

  'a patch with no extends in its frontmatter throws': async ({pass, fail}) => {
    await withTempDir(async dir => {
      await setupFiles(dir, {
        'default.template.html': TEMPLATE,
        'post.template-patch.html': '<!--\n  owner: someone\n-->\n<remove id="nav" />',
        'post.page.html': '<page template="post"><content>BODY</content></page>'
      });
      try {
        await renderPage(path.join(dir, 'post.page.html'), dir);
        fail('should have thrown');
      } catch(e){
        if(!/no "extends"/.test(e.message)) return fail(`wrong error: ${e.message}`);
        pass();
      }
    });
  },

  'a patch extending a template that does not exist throws': async ({pass, fail}) => {
    await withTempDir(async dir => {
      await setupFiles(dir, {
        'default.template.html': TEMPLATE,
        'post.template-patch.html': '<!--\n  extends: nope\n-->\n<remove id="nav" />',
        'post.page.html': '<page template="post"><content>BODY</content></page>'
      });
      try {
        await renderPage(path.join(dir, 'post.page.html'), dir);
        fail('should have thrown');
      } catch(e){
        if(!/Template not found: nope/.test(e.message)) return fail(`wrong error: ${e.message}`);
        pass();
      }
    });
  },

  'a patch extending itself throws rather than looping': async ({pass, fail}) => {
    await withTempDir(async dir => {
      await setupFiles(dir, {
        'default.template.html': TEMPLATE,
        'post.template-patch.html': '<!--\n  extends: post\n-->\n<remove id="nav" />',
        'post.page.html': '<page template="post"><content>BODY</content></page>'
      });
      try {
        await renderPage(path.join(dir, 'post.page.html'), dir);
        fail('should have thrown');
      } catch(e){
        if(!/extends itself|depth exceeded/.test(e.message)) return fail(`wrong error: ${e.message}`);
        pass();
      }
    });
  },

  'a cycle between two patches throws rather than looping': async ({pass, fail}) => {
    await withTempDir(async dir => {
      await setupFiles(dir, {
        'default.template.html': TEMPLATE,
        'a.template-patch.html': '<!--\n  extends: b\n-->\n<remove id="nav" />',
        'b.template-patch.html': '<!--\n  extends: a\n-->\n<remove id="nav" />',
        'post.page.html': '<page template="a"><content>BODY</content></page>'
      });
      try {
        await renderPage(path.join(dir, 'post.page.html'), dir);
        fail('should have thrown');
      } catch(e){
        if(!/depth exceeded/.test(e.message)) return fail(`wrong error: ${e.message}`);
        pass();
      }
    });
  },

  'a real template wins over a patch of the same name': async ({pass, fail}) => {
    await withTempDir(async dir => {
      await setupFiles(dir, {
        'default.template.html': TEMPLATE,
        'post.template.html': '<body>REAL TEMPLATE<location /></body>',
        'post.template-patch.html': patch('<remove id="nav" />'),
        'post.page.html': '<page template="post"><content>BODY</content></page>'
      });
      const html = await renderPage(path.join(dir, 'post.page.html'), dir);
      if(!html.includes('REAL TEMPLATE')) return fail(`the template should take precedence: ${html}`);
      pass();
    });
  },

  'a patched template still resolves fragments, including from extra dirs': async ({pass, fail}) => {
    await withTempDir(async dir => {
      await withTempDir(async pluginDir => {
        await setupFiles(dir, {
          'default.template.html': TEMPLATE,
          'post.template-patch.html': patch('<replace id="main"><article><fragment name="byline" /><location /></article></replace>'),
          'post.page.html': '<page template="post"><content>BODY</content></page>'
        });
        await setupFiles(pluginDir, { 'byline.fragment.html': '<fragment><span>BYLINE</span></fragment>' });
        const html = await renderExternalPage(
          path.join(dir, 'post.page.html'), dir, dir, {}, {}, 10, [], [pluginDir]
        );
        if(!html.includes('BYLINE')) return fail(`fragment not resolved inside a patched template: ${html}`);
        pass();
      });
    });
  },

  'vars resolve across a patched template': async ({pass, fail}) => {
    await withTempDir(async dir => {
      const html = await render(dir, '<replace id="main"><article data-t="{{title}}"><location /></article></replace>', 'title="Hello"');
      if(!html.includes('<title>Hello</title>')) return fail(`template var unresolved: ${html}`);
      if(!html.includes('data-t="Hello"')) return fail(`patch var unresolved: ${html}`);
      pass();
    });
  },

  'markup the scanner does not understand survives untouched': async ({pass, fail}) => {
    await withTempDir(async dir => {
      await setupFiles(dir, {
        'default.template.html': '<body><if condition="1 === 1">KEPT</if><main id="main"><location /></main></body>',
        'post.template-patch.html': patch('<append id="main">[X]</append>'),
        'post.page.html': '<page template="post"><content>BODY</content></page>'
      });
      const html = await renderPage(path.join(dir, 'post.page.html'), dir);
      if(!html.includes('KEPT')) return fail(`conditional content lost: ${html}`);
      if(html.includes('<if')) return fail(`if left unprocessed: ${html}`);
      if(!html.includes('[X]')) return fail(`append missing: ${html}`);
      pass();
    });
  }
};
