import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const pagePath = new URL('../src/pages/index.astro', import.meta.url);
const layoutPath = new URL('../src/layouts/Layout.astro', import.meta.url);
const globalCssPath = new URL('../src/styles/global.css', import.meta.url);

test('opening identity uses the approved centered institutional hierarchy', async () => {
  const page = await readFile(pagePath, 'utf8');
  const required = [
    'JUSTIN SCOTT DIXON',
    'VOYAGER INSTITUTE OF AI MUSIC SYSTEMS',
    '(VIAIMS)',
    'AI SYSTEMS ARCHITECT · CREATIVE TECHNOLOGIST',
    'MUSIC / VIDEO PRODUCER',
    'SPATIAL AUDIO ENGINEER · SONGWRITER',
    'SOUND DESIGNER · VISUAL STORYTELLER',
  ];

  for (const text of required) {
    assert.match(page, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  assert.match(page, /data-institutional-identity/);
  assert.match(page, /text-center/);
  assert.doesNotMatch(page, /Principal AI Systems Architect & Creative Technologist bridging/);
  assert.doesNotMatch(page, /A\.K\.A\. VOYAGER/i);
  assert.doesNotMatch(page, /INNOVATOR · MOTIVATOR · CREATOR/);

  const identity = page.indexOf('data-institutional-identity');
  const engine = page.indexOf('<HybridMediaEngine');
  assert.equal(identity > -1 && engine > identity, true);
});

test('opening identity uses the compact institutional nameplate contract', async () => {
  const [page, layout, css] = await Promise.all([
    readFile(pagePath, 'utf8'),
    readFile(layoutPath, 'utf8'),
    readFile(globalCssPath, 'utf8'),
  ]);

  assert.match(page, /<Layout compactMain>/);
  for (const hook of ['data-institutional-header', 'institutional-status', 'institutional-nameplate', 'institutional-roles']) {
    assert.match(page, new RegExp(hook));
  }
  assert.doesNotMatch(page, /\bmb-10\b|\bmt-6\b|\bspace-y-1\.5\b/);
  assert.match(layout, /compactMain/);
  assert.match(layout, /main--compact/);
  assert.doesNotMatch(layout, /md:py-24/);
  assert.match(css, /\.main--compact\s*\{/);
  assert.match(css, /\.institutional-header\s*\{/);
  assert.match(css, /\.institutional-roles\s*\{/);
});

test('credentials content has one canonical home inside the player', async () => {
  const page = await readFile(pagePath, 'utf8');
  assert.doesNotMatch(page, /import PublicationsAndCredits/);
  assert.doesNotMatch(page, /<PublicationsAndCredits\s*\/>/);
});
