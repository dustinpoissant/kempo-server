import { extractAttrs } from './parse.js';
import { scanElements, queryAll } from './select.js';

/*
  Patch operations a child template applies to the template it extends.

  <content location="…"> only reaches places the parent chose to mark. These reach anything, marked
  or not — the <title> a site never wrapped, a class on <body>, an insertion after some <h1>. That
  is the whole point, and also the whole risk: a patch is coupled to markup the parent never
  promised to keep, so a selector that stops matching is a real possibility.

  Which is why a selector matching nothing is an error rather than a silent no-op. Failing loudly
  is the entire difference between this and the copy-a-template approach it replaces, whose defining
  flaw was drifting quietly.
*/

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
    ops.push({ op, selector: attrs.selector, attrs, markup: body ?? '' });
  }
  return ops;
};

/*
  Applies one operation to every element its selector matches.

  Splices run last match first so that an earlier match's offsets are still valid when it is
  reached — every edit shifts everything after it.
*/
const applyOp = (html, { op, selector, attrs, markup }, describe) => {
  if(!selector) throw new Error(`<${op}> requires a selector${describe ? ` in ${describe}` : ''}`);

  const elements = scanElements(html);
  const matches = queryAll(elements, selector);

  if(!matches.length){
    throw new Error(`<${op} selector="${selector}"> matched nothing${describe ? ` in ${describe}` : ''}`);
  }

  let out = html;
  for(let i = matches.length - 1; i >= 0; i--){
    const el = elements[matches[i]];
    switch(op){
      case 'replace':
        out = out.slice(0, el.outerStart) + markup + out.slice(el.outerEnd);
        break;
      case 'inner':
        out = out.slice(0, el.innerStart) + markup + out.slice(el.innerEnd);
        break;
      case 'before':
        out = out.slice(0, el.outerStart) + markup + out.slice(el.outerStart);
        break;
      case 'after':
        out = out.slice(0, el.outerEnd) + markup + out.slice(el.outerEnd);
        break;
      case 'prepend':
        out = out.slice(0, el.innerStart) + markup + out.slice(el.innerStart);
        break;
      case 'append':
        out = out.slice(0, el.innerEnd) + markup + out.slice(el.innerEnd);
        break;
      case 'remove':
        out = out.slice(0, el.outerStart) + out.slice(el.outerEnd);
        break;
      case 'attr':
        out = out.slice(0, el.attrStart) + serialiseAttrs(el.attrs, attrs, el.selfClosed) + out.slice(el.attrEnd);
        break;
      default:
        throw new Error(`Unknown patch operation: ${op}`);
    }
  }
  return out;
};

/*
  Rewrites an element's attribute list.

  `add-class` and `remove-class` exist because setting `class` outright is the wrong tool for the
  common case: an extension wanting to mark <body> would have to know, and restate, every class the
  site already put there.
*/
const serialiseAttrs = (existing, ops, selfClosed) => {
  const next = { ...existing };

  for(const [key, value] of Object.entries(ops)){
    if(key === 'selector' || key === 'add-class' || key === 'remove-class') continue;
    next[key] = value;
  }

  const classes = String(next.class || '').split(/\s+/).filter(Boolean);
  for(const add of String(ops['add-class'] || '').split(/\s+/).filter(Boolean)){
    if(!classes.includes(add)) classes.push(add);
  }
  const removing = new Set(String(ops['remove-class'] || '').split(/\s+/).filter(Boolean));
  const finalClasses = classes.filter(c => !removing.has(c));

  if(finalClasses.length) next.class = finalClasses.join(' ');
  else delete next.class;

  const rendered = Object.entries(next)
    .map(([k, v]) => (v === '' ? ` ${k}` : ` ${k}="${v}"`))
    .join('');

  /*
    The slash has to come back for an element that was written self-closing. Dropping it is harmless
    on a void element like <img>, but silently turns a self-closed custom element into an unclosed
    one that then swallows everything after it.
  */
  const close = selfClosed ? ' /' : '';
  return rendered || close ? `${rendered}${close}` : '';
};

/*
  Applies every operation in the order written, each seeing the result of the last, so a patch can
  target markup an earlier patch introduced.
*/
export const applyPatchOps = (html, ops, describe) =>
  ops.reduce((acc, op) => applyOp(acc, op, describe), html);
