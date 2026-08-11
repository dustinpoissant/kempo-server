import { renderExternalPage } from '../src/templating/index.js';
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
  'renderExternalPage renders page outside rootDir using rootDir templates': async ({pass, fail}) => {
    await withTempDir(async rootDir => {
      await withTempDir(async externalDir => {
        await setupFiles(rootDir, {
          'default.template.html': '<html><body><location name="main" /></body></html>'
        });
        await setupFiles(externalDir, {
          'admin.page.html': '<page><content location="main"><h1>Admin</h1></content></page>'
        });
        const html = await renderExternalPage(
          path.join(externalDir, 'admin.page.html'),
          rootDir,
          rootDir
        );
        if(!html.includes('<h1>Admin</h1>')) return fail(`page content missing: ${html}`);
        if(!html.includes('<html>')) return fail(`template not used: ${html}`);
        pass();
      });
    });
  },

  'renderExternalPage resolveDir controls template walk-up': async ({pass, fail}) => {
    await withTempDir(async rootDir => {
      await withTempDir(async externalDir => {
        // template is only in rootDir/admin/ — resolveDir points there
        await setupFiles(rootDir, {
          'admin/admin.template.html': '<admin><location name="body" /></admin>'
        });
        await setupFiles(externalDir, {
          'page.page.html': '<page template="admin"><content location="body">content</content></page>'
        });
        const html = await renderExternalPage(
          path.join(externalDir, 'page.page.html'),
          rootDir,
          path.join(rootDir, 'admin')
        );
        if(!html.includes('<admin>')) return fail(`admin template not resolved: ${html}`);
        if(!html.includes('content')) return fail(`body missing: ${html}`);
        pass();
      });
    });
  },

  'renderExternalPage resolveDir controls fragment resolution': async ({pass, fail}) => {
    await withTempDir(async rootDir => {
      await withTempDir(async externalDir => {
        await setupFiles(rootDir, {
          'default.template.html': '<fragment name="sig" /><location name="main" />',
          'sig.fragment.html': '<p>Signature</p>'
        });
        await setupFiles(externalDir, {
          'page.page.html': '<page><content location="main">body</content></page>'
        });
        const html = await renderExternalPage(
          path.join(externalDir, 'page.page.html'),
          rootDir,
          rootDir
        );
        if(!html.includes('<p>Signature</p>')) return fail(`fragment missing: ${html}`);
        pass();
      });
    });
  },

  'renderExternalPage pathToRoot reflects resolveDir depth not page file location': async ({pass, fail}) => {
    await withTempDir(async rootDir => {
      await withTempDir(async externalDir => {
        await setupFiles(rootDir, {
          'default.template.html': '{{pathToRoot}}<location name="main" />'
        });
        await setupFiles(externalDir, {
          // page lives outside rootDir — its actual location is irrelevant
          'deep/nested/page.page.html': '<page><content location="main">x</content></page>'
        });
        // resolveDir is rootDir/section/ — depth 1
        await mkdir(path.join(rootDir, 'section'), {recursive: true});
        const html = await renderExternalPage(
          path.join(externalDir, 'deep', 'nested', 'page.page.html'),
          rootDir,
          path.join(rootDir, 'section')
        );
        if(!html.includes('../')) return fail(`pathToRoot should reflect resolveDir depth: ${html}`);
        // rootDir itself gives depth 0 — resolveDir one level deep gives '../'
        pass();
      });
    });
  },

  'renderExternalPage uses global content from rootDir': async ({pass, fail}) => {
    await withTempDir(async rootDir => {
      await withTempDir(async externalDir => {
        await setupFiles(rootDir, {
          'default.template.html': '<location name="banner" /><location name="main" />',
          'site.global.html': '<content location="banner"><b>Global Banner</b></content>'
        });
        await setupFiles(externalDir, {
          'page.page.html': '<page><content location="main">body</content></page>'
        });
        const html = await renderExternalPage(
          path.join(externalDir, 'page.page.html'),
          rootDir,
          rootDir
        );
        if(!html.includes('<b>Global Banner</b>')) return fail(`global missing: ${html}`);
        pass();
      });
    });
  },

  'renderExternalPage interpolates vars': async ({pass, fail}) => {
    await withTempDir(async rootDir => {
      await withTempDir(async externalDir => {
        await setupFiles(rootDir, {
          'default.template.html': '<location name="main" />'
        });
        await setupFiles(externalDir, {
          'page.page.html': '<page><content location="main">Hello {{name}}</content></page>'
        });
        const html = await renderExternalPage(
          path.join(externalDir, 'page.page.html'),
          rootDir,
          rootDir,
          {},
          {name: 'World'}
        );
        if(!html.includes('Hello World')) return fail(`var not interpolated: ${html}`);
        pass();
      });
    });
  },

  'renderExternalPage processes if conditionals': async ({pass, fail}) => {
    await withTempDir(async rootDir => {
      await withTempDir(async externalDir => {
        await setupFiles(rootDir, {
          'default.template.html': '<location name="main" />'
        });
        await setupFiles(externalDir, {
          'page.page.html': '<page><content location="main"><if condition="show">visible</if></content></page>'
        });
        const shown = await renderExternalPage(
          path.join(externalDir, 'page.page.html'),
          rootDir,
          rootDir,
          {},
          {show: true}
        );
        if(!shown.includes('visible')) return fail(`should show: ${shown}`);
        const hidden = await renderExternalPage(
          path.join(externalDir, 'page.page.html'),
          rootDir,
          rootDir,
          {},
          {show: false}
        );
        if(hidden.includes('visible')) return fail(`should hide: ${hidden}`);
        pass();
      });
    });
  },

  'renderExternalPage throws on missing template': async ({pass, fail}) => {
    await withTempDir(async rootDir => {
      await withTempDir(async externalDir => {
        await setupFiles(externalDir, {
          'page.page.html': '<page template="missing"><content location="main">x</content></page>'
        });
        try {
          await renderExternalPage(
            path.join(externalDir, 'page.page.html'),
            rootDir,
            rootDir
          );
          fail('should have thrown');
        } catch(e){
          if(!e.message.includes('Template not found')) return fail(`wrong error: ${e.message}`);
          pass();
        }
      });
    });
  },

  'renderExternalPage identical output to renderPage for page inside rootDir': async ({pass, fail}) => {
    await withTempDir(async rootDir => {
      await withTempDir(async externalDir => {
        const template = '<html><body><location name="main" /></body></html>';
        const pageContent = '<page><content location="main"><p>same</p></content></page>';
        await setupFiles(rootDir, {'default.template.html': template});
        await setupFiles(externalDir, {'page.page.html': pageContent});
        // Copy page content into rootDir so renderPage can serve as reference
        await setupFiles(rootDir, {'page.page.html': pageContent});

        const { renderPage } = await import('../src/templating/index.js');
        const reference = await renderPage(path.join(rootDir, 'page.page.html'), rootDir);
        const result = await renderExternalPage(
          path.join(externalDir, 'page.page.html'),
          rootDir,
          rootDir
        );
        if(result !== reference) return fail(`output differs:\nexpected: ${reference}\ngot: ${result}`);
        pass();
      });
    });
  },

  'renderExternalPage picks up globals from extraGlobalDirs': async ({pass, fail}) => {
    await withTempDir(async rootDir => {
      await withTempDir(async pluginDir => {
        await setupFiles(rootDir, {
          'default.template.html': '<html><body><location name="nav" /><location name="main" /></body></html>'
        });
        await setupFiles(pluginDir, {
          'nav.global.html': '<content name="plugin-nav" location="nav"><a href="/plugin">Plugin</a></content>',
          'page.page.html': '<page><content location="main"><h1>Page</h1></content></page>'
        });
        const html = await renderExternalPage(
          path.join(pluginDir, 'page.page.html'),
          rootDir,
          rootDir,
          {},
          {},
          10,
          [pluginDir]
        );
        if(!html.includes('href="/plugin"')) return fail(`extra global dir content missing: ${html}`);
        if(!html.includes('<h1>Page</h1>')) return fail(`page content missing: ${html}`);
        pass();
      });
    });
  },

  'renderExternalPage merges rootDir globals with extraGlobalDirs globals': async ({pass, fail}) => {
    await withTempDir(async rootDir => {
      await withTempDir(async pluginDir => {
        await setupFiles(rootDir, {
          'default.template.html': '<html><body><location name="nav" /></body></html>',
          'core.global.html': '<content name="core-nav" location="nav"><a href="/home">Home</a></content>'
        });
        await setupFiles(pluginDir, {
          'nav.global.html': '<content name="plugin-nav" location="nav"><a href="/plugin">Plugin</a></content>',
          'page.page.html': '<page></page>'
        });
        const html = await renderExternalPage(
          path.join(pluginDir, 'page.page.html'),
          rootDir,
          rootDir,
          {},
          {},
          10,
          [pluginDir]
        );
        if(!html.includes('href="/home"')) return fail(`rootDir global missing: ${html}`);
        if(!html.includes('href="/plugin"')) return fail(`extra global dir content missing: ${html}`);
        pass();
      });
    });
  },

  'renderExternalPage ignores extraGlobalDirs that do not exist': async ({pass, fail}) => {
    await withTempDir(async rootDir => {
      await withTempDir(async externalDir => {
        await setupFiles(rootDir, {
          'default.template.html': '<html><body><location name="main" /></body></html>'
        });
        await setupFiles(externalDir, {
          'page.page.html': '<page><content location="main"><h1>Page</h1></content></page>'
        });
        const html = await renderExternalPage(
          path.join(externalDir, 'page.page.html'),
          rootDir,
          rootDir,
          {},
          {},
          10,
          [path.join(externalDir, 'does-not-exist')]
        );
        if(!html.includes('<h1>Page</h1>')) return fail(`render failed on missing extra dir: ${html}`);
        pass();
      });
    });
  }
};
