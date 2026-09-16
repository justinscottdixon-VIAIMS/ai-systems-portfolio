import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const componentPath = new URL('../src/components/PublicationsAndCredits.astro', import.meta.url);
const globalCssPath = new URL('../src/styles/global.css', import.meta.url);

test('publications use the shared technical module language and one restrained accent palette', async () => {
  const [component, css] = await Promise.all([
    readFile(componentPath, 'utf8'),
    readFile(globalCssPath, 'utf8'),
  ]);

  for (const hook of [
    'publications-module',
    'publications-module__header',
    'publications-module__group',
    'publications-module__entry',
    'publications-module__badge',
  ]) {
    assert.match(component, new RegExp(hook));
    assert.match(css, new RegExp(`\\.${hook.replaceAll('__', '__')}\\s*[{,]`));
  }

  assert.match(component, /04 \/ EXTERNAL NODES/);
  assert.doesNotMatch(component, /badgeColor|text-(?:red|amber|pink|emerald|cyan|purple)-/);
  assert.match(css, /--module-accent:\s*rgb\(181 155 102\)/);
  assert.match(css, /font-family:\s*ui-monospace/);
});
