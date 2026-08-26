import { renderPage } from '../src/templating/index.js';
import { scanElements, queryAll, parseSelector } from '../src/templating/select.js';
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

// Deliberately marks nothing: every patch below targets markup the parent never offered up
const PARENT = '<html><head><title>{{title}}</title></head>'
  + '<body class="site"><nav id="main">NAV</nav><h1>{{title}}</h1><location /></body></html>';

const render = async (dir, child, pageAttrs = '') => {
  await setupFiles(dir, {
    'default.template.html': PARENT,
    'post.template.html': `<template extends="default">${child}</template>`,
    'post.page.html': `<page template="post" ${pageAttrs}><content>BODY</content></page>`
  });
  return renderPage(path.join(dir, 'post.page.html'), dir);
};

export default {
  'scanElements records nesting and offsets': ({pass, fail}) => {
    const els = scanElements('<div><p>hi</p><br></div>');
    const div = els.find(e => e.tag === 'div');
    const p = els.find(e => e.tag === 'p');
    const br = els.find(e => e.tag === 'br');
    if(!div || !p || !br) return fail(`missing elements: ${JSON.stringify(els.map(e => e.tag))}`);
    if(p.parent !== els.indexOf(div)) return fail('p should be a child of div');
    if(br.parent !== els.indexOf(div)) return fail('br should be a child of div');
    if('<div><p>hi</p><br></div>'.slice(p.innerStart, p.innerEnd) !== 'hi') return fail('p inner offsets wrong');
    pass();
  },

  'scanElements does not read markup inside script or style': ({pass, fail}) => {
    const els = scanElements('<body><script>var a = "<p>not real</p>";</script><p>real</p></body>');
    const ps = els.filter(e => e.tag === 'p');
    if(ps.length !== 1) return fail(`expected 1 real <p>, got ${ps.length}`);
    pass();
  },

  'scanElements ignores markup inside comments': ({pass, fail}) => {
    const els = scanElements('<div><!-- <p>ghost</p> --><p>real</p></div>');
    if(els.filter(e => e.tag === 'p').length !== 1) return fail('comment content was scanned');
    pass();
  },

  'scanElements is not confused by > inside an attribute': ({pass, fail}) => {
    const els = scanElements('<if condition="a > b"><p>x</p></if>');
    const ifEl = els.find(e => e.tag === 'if');
    if(!ifEl) return fail('if element not found');
    if(ifEl.attrs.condition !== 'a > b') return fail(`attribute mis-parsed: ${ifEl.attrs.condition}`);
    if(!els.some(e => e.tag === 'p' && e.parent === els.indexOf(ifEl))) return fail('nested p not found');
    pass();
  },

  'queryAll supports tag, id, class, attribute, descendant and child': ({pass, fail}) => {
    const html = '<body><nav id="main"><a class="x" href="/a">A</a></nav><div><a class="x">B</a></div></body>';
    const els = scanElements(html);
    const check = (sel, n) => {
      const got = queryAll(els, sel).length;
      if(got !== n) throw new Error(`${sel} matched ${got}, expected ${n}`);
    };
    try {
      check('a', 2);
      check('.x', 2);
      check('#main', 1);
      check('[href]', 1);
      check('[href="/a"]', 1);
      check('nav a', 1);
      check('body > div > a', 1);
      check('body > a', 0);
      check('*', 5);
      pass();
    } catch(e){ fail(e.message); }
  },

  'parseSelector rejects syntax it does not support': ({pass, fail}) => {
    try {
      parseSelector('a:hover');
      fail('should have thrown on an unsupported pseudo-class');
    } catch(e){
      if(!/Unsupported selector/.test(e.message)) return fail(`wrong error: ${e.message}`);
      pass();
    }
  },

  'replace swaps an element the parent never marked': async ({pass, fail}) => {
    await withTempDir(async dir => {
      const html = await render(dir, '<replace selector="title"><title>{{title}} — Blog</title></replace>', 'title="Hello"');
      if(!html.includes('<title>Hello — Blog</title>')) return fail(`title not replaced: ${html}`);
      pass();
    });
  },

  'inner replaces only an element\'s contents': async ({pass, fail}) => {
    await withTempDir(async dir => {
      const html = await render(dir, '<inner selector="#main">NEW NAV</inner>');
      if(!html.includes('<nav id="main">NEW NAV</nav>')) return fail(`inner not applied: ${html}`);
      pass();
    });
  },

  'before and after insert around an element': async ({pass, fail}) => {
    await withTempDir(async dir => {
      const html = await render(dir, '<before selector="h1">[B]</before><after selector="h1">[A]</after>', 'title="T"');
      if(!/\[B\]<h1>T<\/h1>\[A\]/.test(html)) return fail(`insertion misplaced: ${html}`);
      pass();
    });
  },

  'prepend and append insert inside an element': async ({pass, fail}) => {
    await withTempDir(async dir => {
      const html = await render(dir, '<prepend selector="#main">[P]</prepend><append selector="#main">[A]</append>');
      if(!/<nav id="main">\[P\]NAV\[A\]<\/nav>/.test(html)) return fail(`insertion misplaced: ${html}`);
      pass();
    });
  },

  'remove deletes an element': async ({pass, fail}) => {
    await withTempDir(async dir => {
      const html = await render(dir, '<remove selector="#main" />');
      if(html.includes('NAV')) return fail(`nav not removed: ${html}`);
      if(!html.includes('BODY')) return fail(`removed too much: ${html}`);
      pass();
    });
  },

  'attr sets attributes and merges classes without restating existing ones': async ({pass, fail}) => {
    await withTempDir(async dir => {
      const html = await render(dir, '<attr selector="body" add-class="has-article" data-kind="post" />');
      const body = html.match(/<body[^>]*>/)[0];
      if(!/class="site has-article"/.test(body)) return fail(`class not merged: ${body}`);
      if(!/data-kind="post"/.test(body)) return fail(`attribute not set: ${body}`);
      pass();
    });
  },

  'attr can remove a class': async ({pass, fail}) => {
    await withTempDir(async dir => {
      const html = await render(dir, '<attr selector="body" remove-class="site" add-class="post" />');
      const body = html.match(/<body[^>]*>/)[0];
      if(/site/.test(body)) return fail(`class not removed: ${body}`);
      if(!/class="post"/.test(body)) return fail(`class not added: ${body}`);
      pass();
    });
  },

  'attr keeps an element self-closing': async ({pass, fail}) => {
    await withTempDir(async dir => {
      await setupFiles(dir, {
        'default.template.html': '<body><my-el id="x" /><location /></body>',
        'post.template.html': '<template extends="default"><attr selector="#x" data-y="1" /></template>',
        'post.page.html': '<page template="post"><content>BODY</content></page>'
      });
      const html = await renderPage(path.join(dir, 'post.page.html'), dir);
      if(!/<my-el id="x" data-y="1" \/>/.test(html)) return fail(`self-closing slash lost: ${html}`);
      pass();
    });
  },

  'a patch applies to every match, not just the first': async ({pass, fail}) => {
    await withTempDir(async dir => {
      await setupFiles(dir, {
        'default.template.html': '<body><h2>A</h2><h2>B</h2><location /></body>',
        'post.template.html': '<template extends="default"><attr selector="h2" add-class="mark" /></template>',
        'post.page.html': '<page template="post"><content>BODY</content></page>'
      });
      const html = await renderPage(path.join(dir, 'post.page.html'), dir);
      if((html.match(/class="mark"/g) || []).length !== 2) return fail(`expected both h2 patched: ${html}`);
      pass();
    });
  },

  'a selector matching nothing fails loudly rather than silently': async ({pass, fail}) => {
    await withTempDir(async dir => {
      try {
        await render(dir, '<replace selector=".does-not-exist">x</replace>');
        fail('should have thrown — a silent no-op is the drift this feature exists to prevent');
      } catch(e){
        if(!/matched nothing/.test(e.message)) return fail(`wrong error: ${e.message}`);
        pass();
      }
    });
  },

  'patches and content blocks work together in one child': async ({pass, fail}) => {
    await withTempDir(async dir => {
      const html = await render(dir, '<attr selector="body" add-class="post" /><content><article><location /></article></content>');
      if(!/class="site post"/.test(html)) return fail(`patch not applied: ${html}`);
      if(!/<article>BODY<\/article>/.test(html)) return fail(`content block not applied: ${html}`);
      pass();
    });
  },

  'a patch can target markup the child itself inserted': async ({pass, fail}) => {
    await withTempDir(async dir => {
      const html = await render(dir, '<content><article id="a"><location /></article></content><attr selector="#a" data-ok="1" />');
      if(!/<article id="a" data-ok="1">/.test(html)) return fail(`patch did not see the child's own markup: ${html}`);
      pass();
    });
  },

  'patches compose down a chain of extends': async ({pass, fail}) => {
    await withTempDir(async dir => {
      await setupFiles(dir, {
        'default.template.html': '<body class="site"><location /></body>',
        'mid.template.html': '<template extends="default"><attr selector="body" add-class="mid" /></template>',
        'leaf.template.html': '<template extends="mid"><attr selector="body" add-class="leaf" /></template>',
        'post.page.html': '<page template="leaf"><content>BODY</content></page>'
      });
      const html = await renderPage(path.join(dir, 'post.page.html'), dir);
      if(!/class="site mid leaf"/.test(html)) return fail(`chain did not accumulate: ${html}`);
      pass();
    });
  },

  'the parent is untouched for pages that do not use the child': async ({pass, fail}) => {
    await withTempDir(async dir => {
      await setupFiles(dir, {
        'default.template.html': PARENT,
        'post.template.html': '<template extends="default"><remove selector="#main" /></template>',
        'plain.page.html': '<page title="Home"><content>BODY</content></page>'
      });
      const html = await renderPage(path.join(dir, 'plain.page.html'), dir);
      if(!html.includes('NAV')) return fail(`patch leaked into an unrelated page: ${html}`);
      pass();
    });
  },

  'markup the scanner does not understand survives a patch untouched': async ({pass, fail}) => {
    await withTempDir(async dir => {
      await setupFiles(dir, {
        'default.template.html': '<body><foreach in="items" as="i">{{i}}</foreach><if condition="a > b">Y</if><location /></body>',
        'post.template.html': '<template extends="default"><append selector="body">[X]</append></template>',
        'post.page.html': '<page template="post"><content>BODY</content></page>'
      });
      const html = await renderPage(path.join(dir, 'post.page.html'), dir, {}, {});
      // <foreach> with no matching var renders empty and <if> is evaluated, but neither may be mangled
      if(html.includes('<foreach')) return fail(`foreach left unprocessed: ${html}`);
      if(!html.includes('[X]')) return fail(`append missing: ${html}`);
      pass();
    });
  }
};
