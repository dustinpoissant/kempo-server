/*
  Attribute Extraction
*/
const extractAttrs = tagString => {
  const attrs = {};
  const re = /(\w[\w-]*)=(?:"([^"]*)"|'([^']*)')/g;
  let match;
  while((match = re.exec(tagString)) !== null){
    attrs[match[1]] = match[2] ?? match[3];
  }
  return attrs;
};

/*
  Content Block Extraction
*/
const extractContentBlocks = xml => {
  const blocks = {};
  const re = /<content((?:[^>"']|"[^"]*"|'[^']*')*)>([\s\S]*?)<\/content>/g;
  let match;
  while((match = re.exec(xml)) !== null){
    const attrs = extractAttrs(match[1] || '');
    const name = attrs.location || 'default';
    const priority = parseInt(attrs.priority || '0', 10);
    if(!blocks[name]) blocks[name] = [];
    blocks[name].push({html: match[2], priority});
  }
  return blocks;
};

/*
  Content Block Merging
*/
const mergeContentBlocks = (...maps) => {
  const merged = {};
  for(const map of maps){
    for(const [name, entries] of Object.entries(map)){
      if(!merged[name]) merged[name] = [];
      merged[name].push(...entries);
    }
  }
  return merged;
};

/*
  Location Replacement
*/
const resolveLocation = (entries) => {
  if(!entries?.length) return null;
  return [...entries].sort((a, b) => b.priority - a.priority).map(e => e.html).join('');
};

/*
  `keepUnmatched` decides what happens to a <location> nothing has filled.

  Rendering a page is the last word, so an unfilled slot collapses to its fallback (or nothing) and
  never reaches the browser. Composing one template onto another is not the last word: the slots a
  child does not fill still belong to whoever comes next — the page, and global content — so they
  have to survive untouched rather than being consumed by the pass that happened to run first.
*/
const replaceLocations = (html, contentMap, keepUnmatched = false) =>
  html.replace(/<location((?:[^>"']|"[^"]*"|'[^']*')*?)(?:\s*\/>|>([\s\S]*?)<\/location>)/g, (match, attrStr, fallback) => {
    const resolved = resolveLocation(contentMap[extractAttrs(attrStr).name || 'default']);
    if(resolved !== null) return resolved;
    return keepUnmatched ? match : (fallback ?? '');
  });

/*
  Fragment Wrapper Parsing

  A fragment file may wrap its markup in a <fragment> root element carrying metadata. The wrapper is
  optional — a file of bare markup is a perfectly good fragment — so everything read from it has to
  degrade to a sensible default rather than being required.
*/
const FRAGMENT_WRAPPER = /^\s*<fragment((?:[^>"']|"[^"]*"|'[^']*')*)>([\s\S]*)<\/fragment>\s*$/;

const stripFragmentWrapper = xml => {
  const match = xml.match(FRAGMENT_WRAPPER);
  return match ? match[2] : xml;
};

/*
  A fragment's `priority` decides which file wins when more than one source offers a fragment of the
  same name — see findFragmentFile in ./index.js. Read from the wrapper only: an unwrapped file, a
  wrapper with no priority, and a priority that is not a number all mean 0, the same as every
  fragment written before this attribute existed.
*/
const fragmentPriority = xml => {
  const match = xml.match(FRAGMENT_WRAPPER);
  if(!match) return 0;
  const priority = parseInt(extractAttrs(match[1]).priority || '0', 10);
  return Number.isNaN(priority) ? 0 : priority;
};

/*
  Dot-Path Resolution
*/
const resolvePath = (obj, dotPath) =>
  dotPath.split('.').reduce((cur, key) => cur?.[key], obj);

/*
  Variable Resolution
*/
const resolveVars = (html, vars) =>
  html.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
    const trimmed = key.trim();
    const val = resolvePath(vars, trimmed);
    if(typeof val === 'function') return val();
    return val ?? '';
  });

/*
  If-Block Resolution
*/
const resolveIfs = (html, vars) => {
  const re = /<if((?:[^>"']|"[^"]*"|'[^']*')*)>([\s\S]*?)<\/if>/g;
  let result = html;
  let prev;
  do {
    prev = result;
    result = result.replace(re, (_, attrStr, inner) =>
      evalCondition(extractAttrs(attrStr).condition || '', vars) ? inner : ''
    );
  } while(result !== prev);
  return result;
};

/*
  Foreach-Block Resolution
*/
const resolveForeach = (html, vars) => {
  const re = /<foreach((?:[^>"']|"[^"]*"|'[^']*')*)>([\s\S]*?)<\/foreach>/g;
  let result = html;
  let prev;
  do {
    prev = result;
    result = result.replace(re, (_, attrStr, inner) => {
      const attrs = extractAttrs(attrStr);
      const arr = resolvePath(vars, (attrs['in'] || '').trim());
      if(!Array.isArray(arr)) return '';
      return arr.map(item => {
        const scopedVars = {...vars, [attrs.as]: item};
        return resolveVars(inner, scopedVars);
      }).join('');
    });
  } while(result !== prev);
  return result;
};

/*
  Fragment Tag Resolution
*/
const resolveFragmentTags = (html, findFragmentFile, depth, maxDepth) => {
  if(depth > maxDepth) throw new Error(`Fragment depth exceeded maximum of ${maxDepth}`);
  const re = /<fragment((?:[^>"']|"[^"]*"|'[^']*')*?)(?:\s*\/>|>([\s\S]*?)<\/fragment>)/g;
  return html.replace(re, (_, attrStr, fallback) => {
    const name = extractAttrs(attrStr || '').name;
    const content = findFragmentFile(name);
    if(content === null) return fallback ?? '';
    const stripped = stripFragmentWrapper(content);
    return resolveFragmentTags(stripped, findFragmentFile, depth + 1, maxDepth);
  });
};

/*
  Condition Evaluator — Mini Expression Parser
*/
const TOKEN_TYPES = {
  NUMBER: 'NUMBER',
  STRING: 'STRING',
  BOOLEAN: 'BOOLEAN',
  IDENTIFIER: 'IDENTIFIER',
  OPERATOR: 'OPERATOR',
  NOT: 'NOT',
  LPAREN: 'LPAREN',
  RPAREN: 'RPAREN'
};

const tokenize = expr => {
  const tokens = [];
  let i = 0;
  while(i < expr.length){
    if(/\s/.test(expr[i])){
      i++;
      continue;
    }
    if(expr[i] === '('){
      tokens.push({type: TOKEN_TYPES.LPAREN});
      i++;
      continue;
    }
    if(expr[i] === ')'){
      tokens.push({type: TOKEN_TYPES.RPAREN});
      i++;
      continue;
    }
    if(expr[i] === '!' && expr[i + 1] !== '='){
      tokens.push({type: TOKEN_TYPES.NOT});
      i++;
      continue;
    }
    const opMatch = expr.slice(i).match(/^(===|!==|>=|<=|&&|\|\||>|<)/);
    if(opMatch){
      tokens.push({type: TOKEN_TYPES.OPERATOR, value: opMatch[1]});
      i += opMatch[1].length;
      continue;
    }
    if(expr[i] === '"' || expr[i] === "'"){
      const quote = expr[i];
      let str = '';
      i++;
      while(i < expr.length && expr[i] !== quote){
        str += expr[i];
        i++;
      }
      if(i >= expr.length) throw new Error(`Unterminated string in condition: ${expr}`);
      i++;
      tokens.push({type: TOKEN_TYPES.STRING, value: str});
      continue;
    }
    const numMatch = expr.slice(i).match(/^(\d+(\.\d+)?)/);
    if(numMatch){
      tokens.push({type: TOKEN_TYPES.NUMBER, value: Number(numMatch[1])});
      i += numMatch[1].length;
      continue;
    }
    const idMatch = expr.slice(i).match(/^([a-zA-Z_$][\w$.]*)/);
    if(idMatch){
      const id = idMatch[1];
      if(id === 'true' || id === 'false'){
        tokens.push({type: TOKEN_TYPES.BOOLEAN, value: id === 'true'});
      } else {
        tokens.push({type: TOKEN_TYPES.IDENTIFIER, value: id});
      }
      i += id.length;
      continue;
    }
    throw new Error(`Unexpected character '${expr[i]}' in condition: ${expr}`);
  }
  return tokens;
};

const parse = (tokens, vars) => {
  let pos = 0;

  const peek = () => tokens[pos];
  const advance = () => tokens[pos++];

  const parsePrimary = () => {
    const tok = peek();
    if(!tok) throw new Error('Unexpected end of expression');
    if(tok.type === TOKEN_TYPES.NOT){
      advance();
      return !parsePrimary();
    }
    if(tok.type === TOKEN_TYPES.LPAREN){
      advance();
      const val = parseOr();
      if(!peek() || peek().type !== TOKEN_TYPES.RPAREN){
        throw new Error('Missing closing parenthesis');
      }
      advance();
      return val;
    }
    if(tok.type === TOKEN_TYPES.NUMBER || tok.type === TOKEN_TYPES.STRING || tok.type === TOKEN_TYPES.BOOLEAN){
      advance();
      return tok.value;
    }
    if(tok.type === TOKEN_TYPES.IDENTIFIER){
      advance();
      return resolvePath(vars, tok.value);
    }
    throw new Error(`Unexpected token: ${JSON.stringify(tok)}`);
  };

  const parseComparison = () => {
    let left = parsePrimary();
    while(peek() && peek().type === TOKEN_TYPES.OPERATOR && ['===', '!==', '>', '<', '>=', '<='].includes(peek().value)){
      const op = advance().value;
      const right = parsePrimary();
      switch(op){
        case '===': left = left === right; break;
        case '!==': left = left !== right; break;
        case '>': left = left > right; break;
        case '<': left = left < right; break;
        case '>=': left = left >= right; break;
        case '<=': left = left <= right; break;
      }
    }
    return left;
  };

  const parseAnd = () => {
    let left = parseComparison();
    while(peek() && peek().type === TOKEN_TYPES.OPERATOR && peek().value === '&&'){
      advance();
      const right = parseComparison();
      left = left && right;
    }
    return left;
  };

  const parseOr = () => {
    let left = parseAnd();
    while(peek() && peek().type === TOKEN_TYPES.OPERATOR && peek().value === '||'){
      advance();
      const right = parseAnd();
      left = left || right;
    }
    return left;
  };

  const result = parseOr();
  if(pos < tokens.length) throw new Error(`Unexpected token after expression: ${JSON.stringify(tokens[pos])}`);
  return result;
};

const evalCondition = (expression, vars) => {
  const tokens = tokenize(expression);
  return !!parse(tokens, vars);
};

export {
  extractAttrs,
  extractContentBlocks,
  mergeContentBlocks,
  replaceLocations,
  stripFragmentWrapper,
  fragmentPriority,
  resolveVars,
  resolveIfs,
  resolveForeach,
  resolveFragmentTags,
  evalCondition,
  resolvePath
};
