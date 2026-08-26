import { renderExternalPage, renderPage } from '../src/templating/index.js';
import { fragmentPriority } from '../src/templating/parse.js';
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

const TEMPLATE = '<html><body><fragment name="nav">fallback</fragment></body></html>';

export default {
  'fragmentPriority reads the wrapper attribute': ({pass, fail}) => {
    const got = fragmentPriority('<fragment name="nav" priority="10"><nav>Hi</nav></fragment>');
    if(got !== 10) return fail(`expected 10, got ${got}`);
    pass();
  },

  'fragmentPriority defaults to 0 for an unwrapped fragment': ({pass, fail}) => {
    const got = fragmentPriority('<nav>Hi</nav>');
    if(got !== 0) return fail(`expected 0, got ${got}`);
    pass();
  },

  'fragmentPriority defaults to 0 for a wrapper with no priority': ({pass, fail}) => {
    const got = fragmentPriority('<fragment name="nav"><nav>Hi</nav></fragment>');
    if(got !== 0) return fail(`expected 0, got ${got}`);
    pass();
  },

  'fragmentPriority falls back to 0 for a non-numeric priority': ({pass, fail}) => {
    const got = fragmentPriority('<fragment name="nav" priority="high"><nav>Hi</nav></fragment>');
    if(got !== 0) return fail(`expected 0, got ${got}`);
    pass();
  },

  'fragmentPriority reads a negative priority': ({pass, fail}) => {
    const got = fragmentPriority('<fragment name="nav" priority="-5"><nav>Hi</nav></fragment>');
    if(got !== -5) return fail(`expected -5, got ${got}`);
    pass();
  },

  'extraFragmentDirs supplies a fragment the site does not have': async ({pass, fail}) => {
    await withTempDir(async rootDir => {
      await withTempDir(async pluginDir => {
        await setupFiles(rootDir, {
          'default.template.html': TEMPLATE,
          'page.page.html': '<page></page>'
        });
        await setupFiles(pluginDir, {
          'nav.fragment.html': '<fragment name="nav"><nav>From plugin</nav></fragment>'
        });
        const html = await renderExternalPage(
          path.join(rootDir, 'page.page.html'), rootDir, rootDir, {}, {}, 10, [], [pluginDir]
        );
        if(!html.includes('From plugin')) return fail(`plugin fragment missing: ${html}`);
        if(html.includes('fallback')) return fail(`fallback should not render: ${html}`);
        pass();
      });
    });
  },

  'a local fragment beats an extra dir fragment of equal priority': async ({pass, fail}) => {
    await withTempDir(async rootDir => {
      await withTempDir(async pluginDir => {
        await setupFiles(rootDir, {
          'default.template.html': TEMPLATE,
          'page.page.html': '<page></page>',
          'nav.fragment.html': '<nav>From site</nav>'
        });
        await setupFiles(pluginDir, {
          'nav.fragment.html': '<fragment name="nav"><nav>From plugin</nav></fragment>'
        });
        const html = await renderExternalPage(
          path.join(rootDir, 'page.page.html'), rootDir, rootDir, {}, {}, 10, [], [pluginDir]
        );
        if(!html.includes('From site')) return fail(`site fragment should win a tie: ${html}`);
        if(html.includes('From plugin')) return fail(`plugin should not win a tie: ${html}`);
        pass();
      });
    });
  },

  'a higher priority extra dir fragment overrides the local one': async ({pass, fail}) => {
    await withTempDir(async rootDir => {
      await withTempDir(async pluginDir => {
        await setupFiles(rootDir, {
          'default.template.html': TEMPLATE,
          'page.page.html': '<page></page>',
          'nav.fragment.html': '<nav>From site</nav>'
        });
        await setupFiles(pluginDir, {
          'nav.fragment.html': '<fragment name="nav" priority="10"><nav>From plugin</nav></fragment>'
        });
        const html = await renderExternalPage(
          path.join(rootDir, 'page.page.html'), rootDir, rootDir, {}, {}, 10, [], [pluginDir]
        );
        if(!html.includes('From plugin')) return fail(`higher priority should win: ${html}`);
        if(html.includes('From site')) return fail(`site fragment should be overridden: ${html}`);
        pass();
      });
    });
  },

  'a local fragment can outrank an extra dir with its own priority': async ({pass, fail}) => {
    await withTempDir(async rootDir => {
      await withTempDir(async pluginDir => {
        await setupFiles(rootDir, {
          'default.template.html': TEMPLATE,
          'page.page.html': '<page></page>',
          'nav.fragment.html': '<fragment name="nav" priority="20"><nav>From site</nav></fragment>'
        });
        await setupFiles(pluginDir, {
          'nav.fragment.html': '<fragment name="nav" priority="10"><nav>From plugin</nav></fragment>'
        });
        const html = await renderExternalPage(
          path.join(rootDir, 'page.page.html'), rootDir, rootDir, {}, {}, 10, [], [pluginDir]
        );
        if(!html.includes('From site')) return fail(`site should outrank the plugin: ${html}`);
        pass();
      });
    });
  },

  'the highest priority wins across several extra dirs': async ({pass, fail}) => {
    await withTempDir(async rootDir => {
      await withTempDir(async lowDir => {
        await withTempDir(async highDir => {
          await setupFiles(rootDir, {
            'default.template.html': TEMPLATE,
            'page.page.html': '<page></page>'
          });
          await setupFiles(lowDir, {
            'nav.fragment.html': '<fragment name="nav" priority="1"><nav>Low</nav></fragment>'
          });
          await setupFiles(highDir, {
            'nav.fragment.html': '<fragment name="nav" priority="99"><nav>High</nav></fragment>'
          });
          // High-priority dir listed last, so dir order cannot be what decides this
          const html = await renderExternalPage(
            path.join(rootDir, 'page.page.html'), rootDir, rootDir, {}, {}, 10, [], [lowDir, highDir]
          );
          if(!html.includes('High')) return fail(`highest priority should win: ${html}`);
          if(html.includes('Low')) return fail(`lower priority should lose: ${html}`);
          pass();
        });
      });
    });
  },

  'an earlier extra dir wins a tie against a later one': async ({pass, fail}) => {
    await withTempDir(async rootDir => {
      await withTempDir(async firstDir => {
        await withTempDir(async secondDir => {
          await setupFiles(rootDir, {
            'default.template.html': TEMPLATE,
            'page.page.html': '<page></page>'
          });
          await setupFiles(firstDir, {
            'nav.fragment.html': '<fragment name="nav"><nav>First</nav></fragment>'
          });
          await setupFiles(secondDir, {
            'nav.fragment.html': '<fragment name="nav"><nav>Second</nav></fragment>'
          });
          const html = await renderExternalPage(
            path.join(rootDir, 'page.page.html'), rootDir, rootDir, {}, {}, 10, [], [firstDir, secondDir]
          );
          if(!html.includes('First')) return fail(`earliest dir should win a tie: ${html}`);
          pass();
        });
      });
    });
  },

  'extra dir fragments are found in nested subdirectories': async ({pass, fail}) => {
    await withTempDir(async rootDir => {
      await withTempDir(async pluginDir => {
        await setupFiles(rootDir, {
          'default.template.html': TEMPLATE,
          'page.page.html': '<page></page>'
        });
        await setupFiles(pluginDir, {
          'deep/nested/nav.fragment.html': '<fragment name="nav"><nav>Nested</nav></fragment>'
        });
        const html = await renderExternalPage(
          path.join(rootDir, 'page.page.html'), rootDir, rootDir, {}, {}, 10, [], [pluginDir]
        );
        if(!html.includes('Nested')) return fail(`nested fragment not found: ${html}`);
        pass();
      });
    });
  },

  'an extra dir fragment may itself include another fragment': async ({pass, fail}) => {
    await withTempDir(async rootDir => {
      await withTempDir(async pluginDir => {
        await setupFiles(rootDir, {
          'default.template.html': TEMPLATE,
          'page.page.html': '<page></page>'
        });
        await setupFiles(pluginDir, {
          'nav.fragment.html': '<fragment name="nav"><nav><fragment name="brand" /></nav></fragment>',
          'brand.fragment.html': '<fragment name="brand"><b>Brand</b></fragment>'
        });
        const html = await renderExternalPage(
          path.join(rootDir, 'page.page.html'), rootDir, rootDir, {}, {}, 10, [], [pluginDir]
        );
        if(!html.includes('<b>Brand</b>')) return fail(`nested fragment include failed: ${html}`);
        pass();
      });
    });
  },

  'the inline fallback still renders when no source has the fragment': async ({pass, fail}) => {
    await withTempDir(async rootDir => {
      await withTempDir(async pluginDir => {
        await setupFiles(rootDir, {
          'default.template.html': TEMPLATE,
          'page.page.html': '<page></page>'
        });
        await setupFiles(pluginDir, {
          'other.fragment.html': '<fragment name="other">unrelated</fragment>'
        });
        const html = await renderExternalPage(
          path.join(rootDir, 'page.page.html'), rootDir, rootDir, {}, {}, 10, [], [pluginDir]
        );
        if(!html.includes('fallback')) return fail(`fallback missing: ${html}`);
        pass();
      });
    });
  },

  'extraFragmentDirs that do not exist are ignored': async ({pass, fail}) => {
    await withTempDir(async rootDir => {
      await setupFiles(rootDir, {
        'default.template.html': TEMPLATE,
        'page.page.html': '<page></page>',
        'nav.fragment.html': '<nav>From site</nav>'
      });
      const html = await renderExternalPage(
        path.join(rootDir, 'page.page.html'), rootDir, rootDir, {}, {}, 10, [],
        [path.join(rootDir, 'does-not-exist')]
      );
      if(!html.includes('From site')) return fail(`render broke on a missing extra dir: ${html}`);
      pass();
    });
  },

  'omitting extraFragmentDirs renders identically to before': async ({pass, fail}) => {
    await withTempDir(async rootDir => {
      // The walk-up shadowing behaviour has to survive untouched: a page in a subdirectory keeps
      // taking the nearest fragment, and a page at the root keeps taking the root one.
      await setupFiles(rootDir, {
        'default.template.html': TEMPLATE,
        'nav.fragment.html': '<nav>Root nav</nav>',
        'index.page.html': '<page></page>',
        'section/nav.fragment.html': '<nav>Section nav</nav>',
        'section/index.page.html': '<page></page>'
      });
      const rootHtml = await renderPage(path.join(rootDir, 'index.page.html'), rootDir);
      const sectionHtml = await renderPage(path.join(rootDir, 'section', 'index.page.html'), rootDir);
      if(!rootHtml.includes('Root nav')) return fail(`root page lost its fragment: ${rootHtml}`);
      if(!sectionHtml.includes('Section nav')) return fail(`nearest match no longer wins: ${sectionHtml}`);
      pass();
    });
  },

  'an extra dir does not defeat walk-up shadowing within the site': async ({pass, fail}) => {
    await withTempDir(async rootDir => {
      await withTempDir(async pluginDir => {
        await setupFiles(rootDir, {
          'default.template.html': TEMPLATE,
          'nav.fragment.html': '<nav>Root nav</nav>',
          'section/nav.fragment.html': '<nav>Section nav</nav>',
          'section/index.page.html': '<page></page>'
        });
        await setupFiles(pluginDir, {
          'nav.fragment.html': '<fragment name="nav"><nav>Plugin nav</nav></fragment>'
        });
        const html = await renderExternalPage(
          path.join(rootDir, 'section', 'index.page.html'),
          rootDir,
          path.join(rootDir, 'section'),
          {}, {}, 10, [], [pluginDir]
        );
        // The nearest local match still wins, and a priority-0 plugin still loses to it
        if(!html.includes('Section nav')) return fail(`walk-up result should still win: ${html}`);
        pass();
      });
    });
  },

  'extraGlobalDirs and extraFragmentDirs work together': async ({pass, fail}) => {
    await withTempDir(async rootDir => {
      await withTempDir(async pluginDir => {
        await setupFiles(rootDir, {
          'default.template.html': '<html><body><location name="slot" /><fragment name="badge" /></body></html>',
          'page.page.html': '<page></page>'
        });
        await setupFiles(pluginDir, {
          'push.global.html': '<content location="slot"><p>Pushed</p></content>',
          'badge.fragment.html': '<fragment name="badge"><span>Pulled</span></fragment>'
        });
        const html = await renderExternalPage(
          path.join(rootDir, 'page.page.html'), rootDir, rootDir, {}, {}, 10, [pluginDir], [pluginDir]
        );
        if(!html.includes('<p>Pushed</p>')) return fail(`global content missing: ${html}`);
        if(!html.includes('<span>Pulled</span>')) return fail(`fragment missing: ${html}`);
        pass();
      });
    });
  }
};
