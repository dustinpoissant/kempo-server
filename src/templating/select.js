import { extractAttrs } from './parse.js';

/*
  Element lookup by CSS selector, for patching one template onto another.

  Deliberately not a DOM parser. A real HTML parser performs tree construction — it relocates
  elements out of positions it considers invalid, inserts implied tags like <tbody>, and closes
  what it thinks is unclosed — and templates are not HTML: they are partial documents containing
  <location />, <fragment />, <if>, <foreach> and {{vars}}, any of which such a parser is entitled
  to rearrange. Round-tripping a template through one would silently rewrite it.

  So this only ever *locates* elements, recording where each begins and ends in the original text.
  Every edit is a splice of that text, which means anything not explicitly targeted comes through
  byte for byte — including markup this scanner did not understand.
*/

// Elements with no closing tag; anything else is expected to close
const VOID = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);

// Elements whose content is text, not markup — a '<' inside them starts nothing
const RAW_TEXT = new Set(['script','style','textarea','title']);

/*
  Walks the markup and returns a flat list of elements, each carrying the offsets of its own tags
  and its parent's index, which is all the structure selector matching needs.

  Unclosed and mismatched tags are tolerated: an element that never closes simply keeps its opening
  tag's extent. Templates are routinely fragments, and refusing to scan one would be worse than
  scanning it approximately.
*/
export const scanElements = html => {
  const elements = [];
  const open = [];
  let i = 0;

  while(i < html.length){
    const lt = html.indexOf('<', i);
    if(lt === -1) break;

    // Comments, CDATA and doctypes contain no elements
    if(html.startsWith('<!--', lt)){
      const end = html.indexOf('-->', lt);
      i = end === -1 ? html.length : end + 3;
      continue;
    }
    if(html.startsWith('<!', lt) || html.startsWith('<?', lt)){
      const end = html.indexOf('>', lt);
      i = end === -1 ? html.length : end + 1;
      continue;
    }

    const closing = html[lt + 1] === '/';
    const nameStart = lt + (closing ? 2 : 1);
    const nameMatch = /^[a-zA-Z][\w:-]*/.exec(html.slice(nameStart, nameStart + 64));
    if(!nameMatch){
      i = lt + 1; // a bare '<' in text
      continue;
    }
    const tag = nameMatch[0].toLowerCase();

    // Find the '>' that ends this tag, ignoring any inside quoted attribute values
    let j = nameStart + nameMatch[0].length;
    let quote = null;
    while(j < html.length){
      const ch = html[j];
      if(quote){
        if(ch === quote) quote = null;
      } else if(ch === '"' || ch === "'"){
        quote = ch;
      } else if(ch === '>'){
        break;
      }
      j++;
    }
    if(j >= html.length) break;

    const tagEnd = j + 1;

    if(closing){
      for(let k = open.length - 1; k >= 0; k--){
        if(elements[open[k]].tag === tag){
          elements[open[k]].innerEnd = lt;
          elements[open[k]].outerEnd = tagEnd;
          open.length = k;
          break;
        }
      }
      i = tagEnd;
      continue;
    }

    const attrText = html.slice(nameStart + nameMatch[0].length, j);
    const selfClosed = attrText.trimEnd().endsWith('/');

    const element = {
      tag,
      attrs: extractAttrs(attrText),
      attrStart: nameStart + nameMatch[0].length,
      attrEnd: j,
      selfClosed,
      outerStart: lt,
      innerStart: tagEnd,
      // Until a closing tag is seen an element encloses nothing, which is also the right answer
      // for void and self-closed elements and for one that never closes at all
      innerEnd: tagEnd,
      outerEnd: tagEnd,
      parent: open.length ? open[open.length - 1] : -1
    };
    elements.push(element);

    if(!selfClosed && !VOID.has(tag)){
      if(RAW_TEXT.has(tag)){
        // Skip the body wholesale: markup inside is text
        const close = html.toLowerCase().indexOf(`</${tag}`, tagEnd);
        if(close === -1){
          i = html.length;
        } else {
          const closeEnd = html.indexOf('>', close);
          element.innerEnd = close;
          element.outerEnd = closeEnd === -1 ? html.length : closeEnd + 1;
          i = element.outerEnd;
        }
        continue;
      }
      open.push(elements.length - 1);
    }

    i = tagEnd;
  }

  return elements;
};

/*
  Selector parsing.

  A documented subset rather than all of CSS: tag, #id, .class, [attr], [attr="value"], '*', and the
  descendant and child combinators. Enough to address anything a template author marked or named,
  and small enough to be predictable — a selector that quietly matches nothing is a bad failure, so
  anything unsupported throws at parse time instead.
*/
const parseCompound = text => {
  const compound = { tag: null, id: null, classes: [], attrs: [] };
  let rest = text;

  /*
    No ':' in a tag name here, though the scanner accepts one. It is what makes `a:hover` fail as
    unsupported syntax rather than parsing as a tag named "a:hover" that then matches nothing — same
    refusal either way, but one of them says why. Namespaced tags can still be reached via [attr].
  */
  const tagMatch = /^(\*|[a-zA-Z][\w-]*)/.exec(rest);
  if(tagMatch){
    if(tagMatch[1] !== '*') compound.tag = tagMatch[1].toLowerCase();
    rest = rest.slice(tagMatch[1].length);
  }

  while(rest.length){
    if(rest[0] === '#'){
      const m = /^#([\w:-]+)/.exec(rest);
      if(!m) throw new Error(`Invalid id in selector: ${text}`);
      compound.id = m[1];
      rest = rest.slice(m[0].length);
    } else if(rest[0] === '.'){
      const m = /^\.([\w:-]+)/.exec(rest);
      if(!m) throw new Error(`Invalid class in selector: ${text}`);
      compound.classes.push(m[1]);
      rest = rest.slice(m[0].length);
    } else if(rest[0] === '['){
      const m = /^\[\s*([\w:-]+)\s*(?:([~|^$*]?=)\s*(?:"([^"]*)"|'([^']*)'|([^\]\s]*))\s*)?\]/.exec(rest);
      if(!m) throw new Error(`Invalid attribute selector: ${text}`);
      compound.attrs.push({ name: m[1], op: m[2] || null, value: m[3] ?? m[4] ?? m[5] ?? null });
      rest = rest.slice(m[0].length);
    } else {
      throw new Error(`Unsupported selector syntax "${rest}" in: ${text}`);
    }
  }

  return compound;
};

export const parseSelector = selector => {
  const text = String(selector || '').trim();
  if(!text) throw new Error('Selector is required');

  const steps = [];
  const tokens = text.split(/\s*(>)\s*|\s+/).filter(t => t !== undefined && t !== '');
  let combinator = null;
  for(const token of tokens){
    if(token === '>'){
      combinator = 'child';
      continue;
    }
    steps.push({ compound: parseCompound(token), combinator: combinator || 'descendant' });
    combinator = null;
  }
  if(!steps.length) throw new Error(`Empty selector: ${text}`);
  steps[0].combinator = null;
  return steps;
};

const attrMatches = (value, { op, value: expected }) => {
  if(op === null) return value !== undefined;
  if(value === undefined) return false;
  switch(op){
    case '=': return value === expected;
    case '~=': return value.split(/\s+/).includes(expected);
    case '^=': return value.startsWith(expected);
    case '$=': return value.endsWith(expected);
    case '*=': return value.includes(expected);
    case '|=': return value === expected || value.startsWith(`${expected}-`);
    default: return false;
  }
};

const matchesCompound = (element, compound) => {
  if(compound.tag && element.tag !== compound.tag) return false;
  if(compound.id && element.attrs.id !== compound.id) return false;
  if(compound.classes.length){
    const classes = String(element.attrs.class || '').split(/\s+/);
    if(!compound.classes.every(c => classes.includes(c))) return false;
  }
  return compound.attrs.every(a => attrMatches(element.attrs[a.name], a));
};

/*
  Returns the indexes of every element matching the selector, in document order — the same "all
  matches" behaviour querySelectorAll has, so a patch targeting `h2` reaches every h2 rather than
  silently only the first.
*/
export const queryAll = (elements, selector) => {
  const steps = parseSelector(selector);
  const last = steps[steps.length - 1];
  const found = [];

  for(let i = 0; i < elements.length; i++){
    if(!matchesCompound(elements[i], last.compound)) continue;

    let cursor = i;
    let ok = true;
    for(let s = steps.length - 1; s > 0; s--){
      const need = steps[s - 1].compound;
      if(steps[s].combinator === 'child'){
        const parent = elements[cursor].parent;
        if(parent === -1 || !matchesCompound(elements[parent], need)){ ok = false; break; }
        cursor = parent;
      } else {
        let parent = elements[cursor].parent;
        let hit = false;
        while(parent !== -1){
          if(matchesCompound(elements[parent], need)){ hit = true; break; }
          parent = elements[parent].parent;
        }
        if(!hit){ ok = false; break; }
        cursor = parent;
      }
    }
    if(ok) found.push(i);
  }

  return found;
};
