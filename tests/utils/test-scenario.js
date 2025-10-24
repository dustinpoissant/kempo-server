import {writeFile, mkdir} from 'fs/promises';
import path from 'path';

export const prepareTestScenario = async (dir, scenario) => {
  switch (scenario) {
    case 'basic-server':
      // Already has index.html, api/GET.js, etc.
      break;
    case 'wildcard-routes':
      await write(dir, 'docs/.config.json', JSON.stringify({
        customRoutes: { '/src/**': '../src/**' }
      }));
      break;
    case 'middleware':
      await write(dir, '.config.json', JSON.stringify({
        middleware: { cors: {enabled: true} }
      }));
      break;
    default:
      // No special preparation needed
  }
};

const write = async (root, rel, content = '') => {
  const full = path.join(root, rel);
  await mkdir(path.dirname(full), {recursive: true});
  await writeFile(full, content);
  return full;
};