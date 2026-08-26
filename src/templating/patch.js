import { extractAttrs } from './parse.js';

/*
  Template patches: a *.template-patch.html file describing changes to another template, rather than
  being a template itself.

  A patch exists so that a template can build on one it does not own. Copying the original instead
  is the thing this replaces: a copy is a snapshot, and it stops matching the original the moment
  that original is edited — silently, with nothing to signal the drift, and with no event to hang an
  invalidation off when the edit is somebody opening the file in an editor.

  Targeting is by `id`, one element at a time, on purpose. Matching by selector would mean either a
  real HTML parser — which performs tree construction and would rearrange a template, since a
  template is not HTML but a partial document full of <location />, <fragment />, <if>, <foreach>
  and {{vars}} — or a selector engine of our own. An id is unambiguous, needs neither, and forces
  the template being patched to have deliberately named the thing it is offering up.
*/

// No closing tag to look for
const VOID = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);

// Content is text, not markup: a '<' inside these starts nothing
const RAW_TEXT = new Set(['script','style','textarea','title']);

/*
  Every tag in the markup, in order, skipping comments, doctypes, and the bodies of raw-text
  elements. Not a parse — just enough to know where each tag begins and ends, so that edits can be
  spliced into the original text and everything untouched survives exactly as written.
*/
const scanTags = html => {
  const tags = [];
  let i = 0;

  while(i < html.length){
    const lt = html.indexOf('<', i);
    if(lt === -1) break;

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
    const nameMatch = /^[a-zA-Z][\w-]*/.exec(html.slice(nameStart, nameStart + 64));
    if(!nameMatch){
      i = lt + 1; // a bare '<' in text
      continue;
    }

    // The '>' that ends this tag, ignoring any inside a quoted attribute value
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

    const attrText = html.slice(nameStart + nameMatch[0].length, j);
    const tag = nameMatch[0].toLowerCase();
    const selfClosed = attrText.trimEnd().endsWith('/');

    tags.push({
      tag,
      closing,
      selfClosed,
      attrText,
      start: lt,
      end: j + 1,
      attrStart: nameStart + nameMatch[0].length,
      attrEnd: j
    });

    if(!closing && !selfClosed && RAW_TEXT.has(tag)){
      const close = html.toLowerCase().indexOf(`</${tag}`, j + 1);
      i = close === -1 ? html.length : close;
      continue;
    }

    i = j + 1;
  }

  return tags;
};

/*
  Locates the element carrying `id`, and where it ends.

  Depth counting rather than a regex for the closing tag: `<div id="main">` may well contain further
  divs, and a regex would stop at the first `</div>` it saw, cutting the element short in a way that
  produces broken markup rather than an error.
*/
export const findById = (html, id) => {
  const tags = scanTags(html);

  let index = -1;
  let attrs = null;
  for(let i = 0; i < tags.length; i++){
    if(tags[i].closing) continue;
    const candidate = extractAttrs(tags[i].attrText);
    if(candidate.id === id){
      index = i;
      attrs = candidate;
      break;
    }
  }
  if(index === -1) return null;

  const open = tags[index];
  const found = {
    tag: open.tag,
    attrs,
    selfClosed: open.selfClosed,
    attrStart: open.attrStart,
    attrEnd: open.attrEnd,
    outerStart: open.start,
    innerStart: open.end,
    innerEnd: open.end,
    outerEnd: open.end
  };

  if(open.selfClosed || VOID.has(open.tag)) return found;

  let depth = 1;
  for(let i = index + 1; i < tags.length; i++){
    const tag = tags[i];
    if(tag.tag !== open.tag) continue;
    if(tag.closing){
      depth--;
      if(depth === 0){
        found.innerEnd = tag.start;
        found.outerEnd = tag.end;
        return found;
      }
    } else if(!tag.selfClosed && !VOID.has(tag.tag)){
      depth++;
    }
  }

  // Never closed — treat it as enclosing nothing rather than swallowing the rest of the document
  return found;
};

const OPS = ['replace', 'inner', 'before', 'after', 'prepend', 'append', 'attr', 'remove'];

const OP_PATTERN = new RegExp(
  `<(${OPS.join('|')})((?:[^>"']|"[^"]*"|'[^']*')*?)(?:\\s*/>|>([\\s\\S]*?)</\\1>)`,
  'g'
);

export const extractPatchOps = xml => {
  const ops = [];
  let match;
  OP_PATTERN.lastIndex = 0;
  while((match = OP_PATTERN.exec(xml)) !== null){
    const [, op, attrText, body] = match;
    const attrs = extractAttrs(attrText || '');
    ops.push({ op, id: attrs.id, attrs, markup: body ?? '' });
  }
  return ops;
};

/*
  Rewrites an element's attribute list.

  `add-class` and `remove-class` exist because setting `class` outright is the wrong tool for the
  common case: a patch wanting to mark an element would otherwise have to know, and restate, every
  class the template already put there.
*/
const serialiseAttrs = (existing, ops, selfClosed) => {
  const next = { ...existing };

  for(const [key, value] of Object.entries(ops)){
    if(key === 'id' || key === 'add-class' || key === 'remove-class') continue;
    next[key] = value;
  }

  const classes = String(next.class || '').split(/\s+/).filter(Boolean);
  for(const add of String(ops['add-class'] || '').split(/\s+/).filter(Boolean)){
    if(!classes.includes(add)) classes.push(add);
  }
  const removing = new Set(String(ops['remove-class'] || '').split(/\s+/).filter(Boolean));
  const remaining = classes.filter(c => !removing.has(c));

  if(remaining.length) next.class = remaining.join(' ');
  else delete next.class;

  const rendered = Object.entries(next)
    .map(([k, v]) => (v === '' ? ` ${k}` : ` ${k}="${v}"`))
    .join('');

  /*
    The slash has to come back for an element written self-closing. Dropping it is harmless on a
    void element like <img>, but turns a self-closed custom element into an unclosed one that then
    appears to swallow everything after it.
  */
  const close = selfClosed ? ' /' : '';
  return `${rendered}${close}`;
};

const applyOp = (html, { op, id, attrs, markup }, describe) => {
  const where = describe ? ` in ${describe}` : '';
  if(!id) throw new Error(`<${op}> requires an id${where}`);

  const el = findById(html, id);

  /*
    A patch naming an id the template does not have is an error, never a quiet no-op. A patch is
    coupled to markup the template never promised to keep, so the one thing it must not do is fail
    the way the copying it replaces failed — invisibly.
  */
  if(!el) throw new Error(`<${op} id="${id}"> found no element with that id${where}`);

  switch(op){
    case 'replace': return html.slice(0, el.outerStart) + markup + html.slice(el.outerEnd);
    case 'inner':   return html.slice(0, el.innerStart) + markup + html.slice(el.innerEnd);
    case 'before':  return html.slice(0, el.outerStart) + markup + html.slice(el.outerStart);
    case 'after':   return html.slice(0, el.outerEnd) + markup + html.slice(el.outerEnd);
    case 'prepend': return html.slice(0, el.innerStart) + markup + html.slice(el.innerStart);
    case 'append':  return html.slice(0, el.innerEnd) + markup + html.slice(el.innerEnd);
    case 'remove':  return html.slice(0, el.outerStart) + html.slice(el.outerEnd);
    case 'attr':    return html.slice(0, el.attrStart) + serialiseAttrs(el.attrs, attrs, el.selfClosed) + html.slice(el.attrEnd);
    default: throw new Error(`Unknown patch operation: ${op}${where}`);
  }
};

/*
  Applies every operation in the order written, each seeing the result of the last, so a patch can
  target markup an earlier operation introduced.
*/
export const applyPatchOps = (html, ops, describe) =>
  ops.reduce((acc, op) => applyOp(acc, op, describe), html);
