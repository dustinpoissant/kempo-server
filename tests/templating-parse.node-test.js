import {
  extractAttrs,
  extractContentBlocks,
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
    if(result.template !== 'default') return fail('template wrong');
    if(result.title !== 'Hello') return fail('title wrong');
    pass();
  },
  'extractAttrs parses single-quoted attributes': ({pass, fail}) => {
    const result = extractAttrs("name='test'");
    if(result.name !== 'test') return fail('name wrong');
    pass();
  },
  'extractContentBlocks extracts named blocks': ({pass, fail}) => {
    const xml = '<content location="main">Hello</content><content location="sidebar">World</content>';
    const blocks = extractContentBlocks(xml);
    if(blocks.main !== 'Hello') return fail('main wrong');
    if(blocks.sidebar !== 'World') return fail('sidebar wrong');
    pass();
  },
  'replaceLocations fills named locations': ({pass, fail}) => {
    const html = '<location name="main" />';
    const result = replaceLocations(html, {main: '<p>Hi</p>'});
    if(result !== '<p>Hi</p>') return fail(`got: ${result}`);
    pass();
  },
  'replaceLocations uses fallback content': ({pass, fail}) => {
    const html = '<location name="main">fallback</location>';
    const result = replaceLocations(html, {});
    if(result !== 'fallback') return fail(`got: ${result}`);
    pass();
  },
  'replaceLocations uses content over fallback': ({pass, fail}) => {
    const html = '<location name="main">fallback</location>';
    const result = replaceLocations(html, {main: 'real'});
    if(result !== 'real') return fail(`got: ${result}`);
    pass();
  },
  'stripFragmentWrapper removes wrapping fragment tag': ({pass, fail}) => {
    const result = stripFragmentWrapper('<fragment name="nav"><nav>Hi</nav></fragment>');
    if(result !== '<nav>Hi</nav>') return fail(`got: ${result}`);
    pass();
  },
  'stripFragmentWrapper returns content unchanged if no wrapper': ({pass, fail}) => {
    const result = stripFragmentWrapper('<nav>Hi</nav>');
    if(result !== '<nav>Hi</nav>') return fail(`got: ${result}`);
    pass();
  },
  'resolvePath navigates dot path': ({pass, fail}) => {
    const result = resolvePath({a: {b: {c: 42}}}, 'a.b.c');
    if(result !== 42) return fail(`got: ${result}`);
    pass();
  },
  'resolvePath returns undefined for missing path': ({pass, fail}) => {
    const result = resolvePath({a: 1}, 'b.c');
    if(result !== undefined) return fail(`got: ${result}`);
    pass();
  },
  'resolveVars replaces simple variables': ({pass, fail}) => {
    const result = resolveVars('Hello {{name}}!', {name: 'World'});
    if(result !== 'Hello World!') return fail(`got: ${result}`);
    pass();
  },
  'resolveVars replaces dot-path variables': ({pass, fail}) => {
    const result = resolveVars('{{user.name}}', {user: {name: 'Bob'}});
    if(result !== 'Bob') return fail(`got: ${result}`);
    pass();
  },
  'resolveVars calls function values': ({pass, fail}) => {
    const result = resolveVars('{{fn}}', {fn: () => 'called'});
    if(result !== 'called') return fail(`got: ${result}`);
    pass();
  },
  'resolveVars replaces missing vars with empty string': ({pass, fail}) => {
    const result = resolveVars('{{missing}}', {});
    if(result !== '') return fail(`got: ${result}`);
    pass();
  },
  'resolveIfs keeps content when condition is true': ({pass, fail}) => {
    const result = resolveIfs('<if condition="show">visible</if>', {show: true});
    if(result !== 'visible') return fail(`got: ${result}`);
    pass();
  },
  'resolveIfs removes content when condition is false': ({pass, fail}) => {
    const result = resolveIfs('<if condition="show">visible</if>', {show: false});
    if(result !== '') return fail(`got: ${result}`);
    pass();
  },
  'resolveIfs handles comparison operators': ({pass, fail}) => {
    const result = resolveIfs('<if condition="count > 5">big</if>', {count: 10});
    if(result !== 'big') return fail(`got: ${result}`);
    pass();
  },
  'resolveIfs handles nested ifs': ({pass, fail}) => {
    const html = '<if condition="a"><if condition="b">inner</if></if>';
    const result = resolveIfs(html, {a: true, b: true});
    if(result !== 'inner') return fail(`got: ${result}`);
    pass();
  },
  'resolveForeach iterates arrays': ({pass, fail}) => {
    const html = '<foreach in="items" as="item">{{item}},</foreach>';
    const result = resolveForeach(html, {items: ['a', 'b', 'c']});
    if(result !== 'a,b,c,') return fail(`got: ${result}`);
    pass();
  },
  'resolveForeach handles empty array': ({pass, fail}) => {
    const html = '<foreach in="items" as="item">{{item}}</foreach>';
    const result = resolveForeach(html, {items: []});
    if(result !== '') return fail(`got: ${result}`);
    pass();
  },
  'resolveForeach handles missing var': ({pass, fail}) => {
    const html = '<foreach in="nope" as="item">{{item}}</foreach>';
    const result = resolveForeach(html, {});
    if(result !== '') return fail(`got: ${result}`);
    pass();
  },
  'resolveForeach handles object items with dot paths': ({pass, fail}) => {
    const html = '<foreach in="users" as="u">{{u.name}}</foreach>';
    const result = resolveForeach(html, {users: [{name: 'Alice'}, {name: 'Bob'}]});
    if(result !== 'AliceBob') return fail(`got: ${result}`);
    pass();
  },
  'resolveFragmentTags inlines fragment content': ({pass, fail}) => {
    const html = '<fragment name="nav" />';
    const finder = name => name === 'nav' ? '<nav>Link</nav>' : null;
    const result = resolveFragmentTags(html, finder, 0, 10);
    if(result !== '<nav>Link</nav>') return fail(`got: ${result}`);
    pass();
  },
  'resolveFragmentTags uses fallback when fragment not found': ({pass, fail}) => {
    const html = '<fragment name="missing">fallback</fragment>';
    const finder = () => null;
    const result = resolveFragmentTags(html, finder, 0, 10);
    if(result !== 'fallback') return fail(`got: ${result}`);
    pass();
  },
  'resolveFragmentTags throws on max depth': ({pass, fail}) => {
    const html = '<fragment name="loop" />';
    const finder = () => '<fragment name="loop" />';
    try {
      resolveFragmentTags(html, finder, 0, 3);
      fail('should have thrown');
    } catch(e){
      if(!e.message.includes('depth exceeded')) return fail(`wrong error: ${e.message}`);
      pass();
    }
  },
  'evalCondition: truthy identifier': ({pass, fail}) => {
    if(!evalCondition('active', {active: true})) return fail('should be true');
    pass();
  },
  'evalCondition: falsy identifier': ({pass, fail}) => {
    if(evalCondition('active', {active: false})) return fail('should be false');
    pass();
  },
  'evalCondition: string equality': ({pass, fail}) => {
    if(!evalCondition('env === "prod"', {env: 'prod'})) return fail('should be true');
    pass();
  },
  'evalCondition: string inequality': ({pass, fail}) => {
    if(!evalCondition('env !== "dev"', {env: 'prod'})) return fail('should be true');
    pass();
  },
  'evalCondition: numeric comparison': ({pass, fail}) => {
    if(!evalCondition('count >= 10', {count: 10})) return fail('should be true');
    if(evalCondition('count > 10', {count: 10})) return fail('should be false');
    pass();
  },
  'evalCondition: logical AND': ({pass, fail}) => {
    if(!evalCondition('a && b', {a: true, b: true})) return fail('should be true');
    if(evalCondition('a && b', {a: true, b: false})) return fail('should be false');
    pass();
  },
  'evalCondition: logical OR': ({pass, fail}) => {
    if(!evalCondition('a || b', {a: false, b: true})) return fail('should be true');
    if(evalCondition('a || b', {a: false, b: false})) return fail('should be false');
    pass();
  },
  'evalCondition: NOT operator': ({pass, fail}) => {
    if(!evalCondition('!hidden', {hidden: false})) return fail('should be true');
    if(evalCondition('!hidden', {hidden: true})) return fail('should be false');
    pass();
  },
  'evalCondition: parenthesized expression': ({pass, fail}) => {
    if(!evalCondition('(a || b) && c', {a: false, b: true, c: true})) return fail('should be true');
    if(evalCondition('(a || b) && c', {a: false, b: true, c: false})) return fail('should be false');
    pass();
  },
  'evalCondition: dot-path variable': ({pass, fail}) => {
    if(!evalCondition('user.admin', {user: {admin: true}})) return fail('should be true');
    pass();
  },
  'evalCondition: boolean literals': ({pass, fail}) => {
    if(!evalCondition('true', {})) return fail('true should be true');
    if(evalCondition('false', {})) return fail('false should be false');
    pass();
  },
  'extractContentBlocks defaults location to default': ({pass, fail}) => {
    const blocks = extractContentBlocks('<content>Hello</content>');
    if(blocks.default !== 'Hello') return fail(`got: ${blocks.default}`);
    pass();
  },
  'extractContentBlocks concatenates multiple contents to same location': ({pass, fail}) => {
    const xml = '<content location="main">A</content><content location="main">B</content>';
    const blocks = extractContentBlocks(xml);
    if(blocks.main !== 'AB') return fail(`got: ${blocks.main}`);
    pass();
  },
  'extractContentBlocks concatenates default contents': ({pass, fail}) => {
    const xml = '<content>A</content><content>B</content>';
    const blocks = extractContentBlocks(xml);
    if(blocks.default !== 'AB') return fail(`got: ${blocks.default}`);
    pass();
  },
  'replaceLocations defaults nameless location to default': ({pass, fail}) => {
    const result = replaceLocations('<location />', {default: 'Hi'});
    if(result !== 'Hi') return fail(`got: ${result}`);
    pass();
  },
  'replaceLocations defaults nameless block location to default': ({pass, fail}) => {
    const result = replaceLocations('<location>fallback</location>', {default: 'Hi'});
    if(result !== 'Hi') return fail(`got: ${result}`);
    pass();
  },
  'replaceLocations uses fallback for nameless location': ({pass, fail}) => {
    const result = replaceLocations('<location>fallback</location>', {});
    if(result !== 'fallback') return fail(`got: ${result}`);
    pass();
  }
};
