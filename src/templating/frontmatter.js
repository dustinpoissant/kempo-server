/*
  Frontmatter is the comment above a page's <page> tag. This is the one definition of it, shared by the template patch
  parser and by everything that keeps it out of a response.
*/
export const FRONTMATTER = /^\s*<!--([\s\S]*?)-->/;

export const stripFrontmatter = text => text.replace(FRONTMATTER, '').replace(/^\r?\n/, '');
