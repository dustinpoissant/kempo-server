import {
  extractAttrs,
  extractContentBlocks,
  mergeContentBlocks,
  replaceLocations,
  stripFragmentWrapper,
  resolveVars,
  resolveIfs,
  resolveForeach,
  resolveFragmentTags,
  evalCondition,
  resolvePath
} from '../src/templating/parse.js';

export default {
  'extractAttrs parses double-quoted attributes': ({pass, fail}) => {
    const result = extractAttrs('template="default" title="Hello"');
    if(result.template !== 'default') throw new Error('template wrong');
    if(result.title !== 'Hello') throw new Error('title wrong');
    pass();
  },
  'extractAttrs parses single-quoted attributes': ({pass, fail}) => {
    const result = extractAttrs("name='test'");
    if(result.name !== 'test') throw new Error('name wrong');
    pass();
  },
  'extractContentBlocks extracts named blocks': ({pass, fail}) => {
    const xml = '<content location="main">Hello</content><content location="sidebar">World</content>';
    const blocks = extractContentBlocks(xml);
    if(!Array.isArray(blocks.main) || blocks.main[0].html !== 'Hello') throw new Error('main wrong');
    if(!Array.isArray(blocks.sidebar) || blocks.sidebar[0].html !== 'World') throw new Error('sidebar wrong');
    pass();
  },
  'extractContentBlocks captures priority': ({pass, fail}) => {
    const xml = '<content location="main" priority="5">hi</content>';
    const blocks = extractContentBlocks(xml);
    if(blocks.main[0].priority !== 5) throw new Error(`priority wrong: ${blocks.main[0].priority}`);
    pass();
  },
  'extractContentBlocks defaults priority to 0': ({pass, fail}) => {
    const xml = '<content location="main">hi</content>';
    const blocks = extractContentBlocks(xml);
    if(blocks.main[0].priority !== 0) throw new Error(`priority wrong: ${blocks.main[0].priority}`);
    pass();
  },
  'mergeContentBlocks combines maps': ({pass, fail}) => {
    const a = {main: [{html: 'A', priority: 0}]};
    const b = {main: [{html: 'B', priority: 0}], sidebar: [{html: 'S', priority: 0}]};
    const merged = mergeContentBlocks(a, b);
    if(merged.main.length !== 2) throw new Error(`main length wrong: ${merged.main.length}`);
    if(!merged.sidebar) throw new Error('sidebar missing');
    pass();
  },
  'replaceLocations fills named locations': ({pass, fail}) => {
    const html = '<location name="main" />';
    const result = replaceLocations(html, {main: [{html: '<p>Hi</p>', priority: 0}]});
    if(result !== '<p>Hi</p>') throw new Error(`got: ${result}`);
    pass();
  },
  'replaceLocations uses fallback content': ({pass, fail}) => {
    const html = '<location name="main">fallback</location>';
    const result = replaceLocations(html, {});
    if(result !== 'fallback') throw new Error(`got: ${result}`);
    pass();
  },
  'replaceLocations uses content over fallback': ({pass, fail}) => {
    const html = '<location name="main">fallback</location>';
    const result = replaceLocations(html, {main: [{html: 'real', priority: 0}]});
    if(result !== 'real') throw new Error(`got: ${result}`);
    pass();
  },
  'replaceLocations orders by priority descending': ({pass, fail}) => {
    const html = '<location name="scripts" />';
    const entries = [
      {html: 'low', priority: 1},
      {html: 'high', priority: 10},
      {html: 'mid', priority: 5}
    ];
    const result = replaceLocations(html, {scripts: entries});
    if(result !== 'highmidlow') throw new Error(`got: ${result}`);
    pass();
  },
  'stripFragmentWrapper removes wrapping fragment tag': ({pass, fail}) => {
    const result = stripFragmentWrapper('<fragment name="nav"><nav>Hi</nav></fragment>');
    if(result !== '<nav>Hi</nav>') throw new Error(`got: ${result}`);
    pass();
  },
  'stripFragmentWrapper returns content unchanged if no wrapper': ({pass, fail}) => {
    const result = stripFragmentWrapper('<nav>Hi</nav>');
    if(result !== '<nav>Hi</nav>') throw new Error(`got: ${result}`);
    pass();
  },
  'resolvePath navigates dot path': ({pass, fail}) => {
    const result = resolvePath({a: {b: {c: 42}}}, 'a.b.c');
    if(result !== 42) throw new Error(`got: ${result}`);
    pass();
  },
  'resolvePath returns undefined for missing path': ({pass, fail}) => {
    const result = resolvePath({a: 1}, 'b.c');
    if(result !== undefined) throw new Error(`got: ${result}`);
    pass();
  },
  'resolveVars replaces simple variables': ({pass, fail}) => {
    const result = resolveVars('Hello {{name}}!', {name: 'World'});
    if(result !== 'Hello World!') throw new Error(`got: ${result}`);
    pass();
  },
  'resolveVars replaces dot-path variables': ({pass, fail}) => {
    const result = resolveVars('{{user.name}}', {user: {name: 'Bob'}});
    if(result !== 'Bob') throw new Error(`got: ${result}`);
    pass();
  },
  'resolveVars calls function values': ({pass, fail}) => {
    const result = resolveVars('{{fn}}', {fn: () => 'called'});
    if(result !== 'called') throw new Error(`got: ${result}`);
    pass();
  },
  'resolveVars replaces missing vars with empty string': ({pass, fail}) => {
    const result = resolveVars('{{missing}}', {});
    if(result !== '') throw new Error(`got: ${result}`);
    pass();
  },
  'resolveIfs keeps content when condition is true': ({pass, fail}) => {
    const result = resolveIfs('<if condition="show">visible</if>', {show: true});
    if(result !== 'visible') throw new Error(`got: ${result}`);
    pass();
  },
  'resolveIfs removes content when condition is false': ({pass, fail}) => {
    const result = resolveIfs('<if condition="show">visible</if>', {show: false});
    if(result !== '') throw new Error(`got: ${result}`);
    pass();
  },
  'resolveIfs handles comparison operators': ({pass, fail}) => {
    const result = resolveIfs('<if condition="count > 5">big</if>', {count: 10});
    if(result !== 'big') throw new Error(`got: ${result}`);
    pass();
  },
  'resolveIfs handles nested ifs': ({pass, fail}) => {
    const html = '<if condition="a"><if condition="b">inner</if></if>';
    const result = resolveIfs(html, {a: true, b: true});
    if(result !== 'inner') throw new Error(`got: ${result}`);
    pass();
  },
  'resolveForeach iterates arrays': ({pass, fail}) => {
    const html = '<foreach in="items" as="item">{{item}},</foreach>';
    const result = resolveForeach(html, {items: ['a', 'b', 'c']});
    if(result !== 'a,b,c,') throw new Error(`got: ${result}`);
    pass();
  },
  'resolveForeach handles empty array': ({pass, fail}) => {
    const html = '<foreach in="items" as="item">{{item}}</foreach>';
    const result = resolveForeach(html, {items: []});
    if(result !== '') throw new Error(`got: ${result}`);
    pass();
  },
  'resolveForeach handles missing var': ({pass, fail}) => {
    const html = '<foreach in="nope" as="item">{{item}}</foreach>';
    const result = resolveForeach(html, {});
    if(result !== '') throw new Error(`got: ${result}`);
    pass();
  },
  'resolveForeach handles object items with dot paths': ({pass, fail}) => {
    const html = '<foreach in="users" as="u">{{u.name}}</foreach>';
    const result = resolveForeach(html, {users: [{name: 'Alice'}, {name: 'Bob'}]});
    if(result !== 'AliceBob') throw new Error(`got: ${result}`);
    pass();
  },
  'resolveFragmentTags inlines fragment content': ({pass, fail}) => {
    const html = '<fragment name="nav" />';
    const finder = name => name === 'nav' ? '<nav>Link</nav>' : null;
    const result = resolveFragmentTags(html, finder, 0, 10);
    if(result !== '<nav>Link</nav>') throw new Error(`got: ${result}`);
    pass();
  },
  'resolveFragmentTags uses fallback when fragment not found': ({pass, fail}) => {
    const html = '<fragment name="missing">fallback</fragment>';
    const finder = () => null;
    const result = resolveFragmentTags(html, finder, 0, 10);
    if(result !== 'fallback') throw new Error(`got: ${result}`);
    pass();
  },
  'resolveFragmentTags throws on max depth': ({pass, fail}) => {
    const html = '<fragment name="loop" />';
    const finder = () => '<fragment name="loop" />';
    try {
      resolveFragmentTags(html, finder, 0, 3);
      fail('should have thrown');
    } catch(e){
      if(!e.message.includes('depth exceeded')) throw new Error(`wrong error: ${e.message}`);
      pass();
    }
  },
  'evalCondition: truthy identifier': ({pass, fail}) => {
    if(!evalCondition('active', {active: true})) throw new Error('should be true');
    pass();
  },
  'evalCondition: falsy identifier': ({pass, fail}) => {
    if(evalCondition('active', {active: false})) throw new Error('should be false');
    pass();
  },
  'evalCondition: string equality': ({pass, fail}) => {
    if(!evalCondition('env === "prod"', {env: 'prod'})) throw new Error('should be true');
    pass();
  },
  'evalCondition: string inequality': ({pass, fail}) => {
    if(!evalCondition('env !== "dev"', {env: 'prod'})) throw new Error('should be true');
    pass();
  },
  'evalCondition: numeric comparison': ({pass, fail}) => {
    if(!evalCondition('count >= 10', {count: 10})) throw new Error('should be true');
    if(evalCondition('count > 10', {count: 10})) throw new Error('should be false');
    pass();
  },
  'evalCondition: logical AND': ({pass, fail}) => {
    if(!evalCondition('a && b', {a: true, b: true})) throw new Error('should be true');
    if(evalCondition('a && b', {a: true, b: false})) throw new Error('should be false');
    pass();
  },
  'evalCondition: logical OR': ({pass, fail}) => {
    if(!evalCondition('a || b', {a: false, b: true})) throw new Error('should be true');
    if(evalCondition('a || b', {a: false, b: false})) throw new Error('should be false');
    pass();
  },
  'evalCondition: NOT operator': ({pass, fail}) => {
    if(!evalCondition('!hidden', {hidden: false})) throw new Error('should be true');
    if(evalCondition('!hidden', {hidden: true})) throw new Error('should be false');
    pass();
  },
  'evalCondition: parenthesized expression': ({pass, fail}) => {
    if(!evalCondition('(a || b) && c', {a: false, b: true, c: true})) throw new Error('should be true');
    if(evalCondition('(a || b) && c', {a: false, b: true, c: false})) throw new Error('should be false');
    pass();
  },
  'evalCondition: dot-path variable': ({pass, fail}) => {
    if(!evalCondition('user.admin', {user: {admin: true}})) throw new Error('should be true');
    pass();
  },
  'evalCondition: boolean literals': ({pass, fail}) => {
    if(!evalCondition('true', {})) throw new Error('true should be true');
    if(evalCondition('false', {})) throw new Error('false should be false');
    pass();
  },
  'extractContentBlocks defaults location to default': ({pass, fail}) => {
    const blocks = extractContentBlocks('<content>Hello</content>');
    if(!Array.isArray(blocks.default) || blocks.default[0].html !== 'Hello') throw new Error(`got: ${JSON.stringify(blocks.default)}`);
    pass();
  },
  'extractContentBlocks concatenates multiple contents to same location': ({pass, fail}) => {
    const xml = '<content location="main">A</content><content location="main">B</content>';
    const blocks = extractContentBlocks(xml);
    if(blocks.main.length !== 2) throw new Error(`expected 2 entries, got: ${JSON.stringify(blocks.main)}`);
    if(blocks.main[0].html !== 'A' || blocks.main[1].html !== 'B') throw new Error(`got: ${JSON.stringify(blocks.main)}`);
    pass();
  },
  'extractContentBlocks concatenates default contents': ({pass, fail}) => {
    const xml = '<content>A</content><content>B</content>';
    const blocks = extractContentBlocks(xml);
    if(blocks.default.length !== 2) throw new Error(`expected 2 entries, got: ${JSON.stringify(blocks.default)}`);
    if(blocks.default[0].html !== 'A' || blocks.default[1].html !== 'B') throw new Error(`got: ${JSON.stringify(blocks.default)}`);
    pass();
  },
  'replaceLocations defaults nameless location to default': ({pass, fail}) => {
    const result = replaceLocations('<location />', {default: [{html: 'Hi', priority: 0}]});
    if(result !== 'Hi') throw new Error(`got: ${result}`);
    pass();
  },
  'replaceLocations defaults nameless block location to default': ({pass, fail}) => {
    const result = replaceLocations('<location>fallback</location>', {default: [{html: 'Hi', priority: 0}]});
    if(result !== 'Hi') throw new Error(`got: ${result}`);
    pass();
  },
  'replaceLocations uses fallback for nameless location': ({pass, fail}) => {
    const result = replaceLocations('<location>fallback</location>', {});
    if(result !== 'fallback') throw new Error(`got: ${result}`);
    pass();
  },
  'replaceLocations handles custom attributes on self-closing location': ({pass, fail}) => {
    const result = replaceLocations('<location name="main" label="Main Content" />', {main: [{html: '<p>Hi</p>', priority: 0}]});
    if(result !== '<p>Hi</p>') throw new Error(`got: ${result}`);
    pass();
  },
  'replaceLocations handles custom attributes on block location': ({pass, fail}) => {
    const result = replaceLocations('<location name="sidebar" label="Sidebar" editable="true">fallback</location>', {sidebar: [{html: 'real', priority: 0}]});
    if(result !== 'real') throw new Error(`got: ${result}`);
    pass();
  },
  'replaceLocations handles custom attributes with fallback': ({pass, fail}) => {
    const result = replaceLocations('<location name="missing" label="Test">fallback</location>', {});
    if(result !== 'fallback') throw new Error(`got: ${result}`);
    pass();
  },
  'replaceLocations handles custom attributes on nameless location': ({pass, fail}) => {
    const result = replaceLocations('<location label="Default" />', {default: [{html: 'content', priority: 0}]});
    if(result !== 'content') throw new Error(`got: ${result}`);
    pass();
  },
  'resolveFragmentTags handles custom attributes on fragment': ({pass, fail}) => {
    const html = '<fragment name="nav" label="Navigation" />';
    const finder = name => name === 'nav' ? '<nav>Link</nav>' : null;
    const result = resolveFragmentTags(html, finder, 0, 10);
    if(result !== '<nav>Link</nav>') throw new Error(`got: ${result}`);
    pass();
  },
  'resolveFragmentTags handles custom attributes with fallback': ({pass, fail}) => {
    const html = '<fragment name="missing" label="Test">fallback</fragment>';
    const finder = () => null;
    const result = resolveFragmentTags(html, finder, 0, 10);
    if(result !== 'fallback') throw new Error(`got: ${result}`);
    pass();
  },
  'resolveFragmentTags handles excessive whitespace': ({pass, fail}) => {
    const html = '<fragment      name="nav" />';
    const finder = name => name === 'nav' ? '<nav>Link</nav>' : null;
    const result = resolveFragmentTags(html, finder, 0, 10);
    if(result !== '<nav>Link</nav>') throw new Error(`got: ${result}`);
    pass();
  },
  'replaceLocations handles excessive whitespace on self-closing': ({pass, fail}) => {
    const result = replaceLocations('<location      name="main"      />', {main: [{html: 'hi', priority: 0}]});
    if(result !== 'hi') throw new Error(`got: ${result}`);
    pass();
  },
  'replaceLocations handles excessive whitespace on block location': ({pass, fail}) => {
    const result = replaceLocations('<location      name="main"      >fallback</location>', {main: [{html: 'hi', priority: 0}]});
    if(result !== 'hi') throw new Error(`got: ${result}`);
    pass();
  },
  'resolveIfs handles extra attributes before condition': ({pass, fail}) => {
    const result = resolveIfs('<if label="test" condition="show">visible</if>', {show: true});
    if(result !== 'visible') throw new Error(`got: ${result}`);
    pass();
  },
  'resolveIfs handles extra attributes after condition': ({pass, fail}) => {
    const result = resolveIfs('<if condition="show" label="test">visible</if>', {show: false});
    if(result !== '') throw new Error(`got: ${result}`);
    pass();
  },
  'resolveForeach handles reversed attribute order': ({pass, fail}) => {
    const result = resolveForeach('<foreach as="item" in="items">{{item}},</foreach>', {items: ['a', 'b']});
    if(result !== 'a,b,') throw new Error(`got: ${result}`);
    pass();
  },
  'resolveForeach handles extra attributes': ({pass, fail}) => {
    const result = resolveForeach('<foreach in="items" as="item" label="List">{{item}}</foreach>', {items: ['x', 'y']});
    if(result !== 'xy') throw new Error(`got: ${result}`);
    pass();
  },
  'extractContentBlocks handles excessive whitespace': ({pass, fail}) => {
    const blocks = extractContentBlocks('<content      location="main"      >Hello</content>');
    if(!Array.isArray(blocks.main) || blocks.main[0].html !== 'Hello') throw new Error(`got: ${JSON.stringify(blocks.main)}`);
    pass();
  },
  'extractContentBlocks handles extra custom attributes': ({pass, fail}) => {
    const blocks = extractContentBlocks('<content location="main" label="Main" editable="true">Hello</content>');
    if(!Array.isArray(blocks.main) || blocks.main[0].html !== 'Hello') throw new Error(`got: ${JSON.stringify(blocks.main)}`);
    pass();
  }
};
