import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const recordsUrl = new URL('../src/data/portfolio-records.json', import.meta.url);
const modelUrl = new URL('../src/lib/portfolio-records.mjs', import.meta.url);
const archiveUrl = new URL('../src/components/PublicationsAndCredits.astro', import.meta.url);
const engineUrl = new URL('../src/components/HybridMediaEngine.astro', import.meta.url);
const cssUrl = new URL('../src/styles/hybrid-media-engine.css', import.meta.url);

test('portfolio record model validates and chronologically sorts the public pilot archive', async () => {
  const { toPortfolioRecords } = await import(modelUrl);
  const source = JSON.parse(await readFile(recordsUrl, 'utf8'));
  const records = toPortfolioRecords(source);

  assert.equal(records.length, 18);
  assert.deepEqual(records.map((record) => record.sortDate), [...records.map((record) => record.sortDate)].sort());
  assert.equal(new Set(records.map((record) => record.id)).size, records.length);
  assert.equal(new Set(records.map((record) => record.slug)).size, records.length);
  assert.equal(records.every((record) => record.publicSources.length > 0), true);
  assert.equal(records.every((record) => record.gallery.length > 0), true);
  assert.equal(records.some((record) => record.gallery.some((item) => item.kind === 'image')), true);
  assert.equal(records.every((record) => record.publicSources.every((source) => new URL(source.href).protocol === 'https:')), true);
  assert.equal(records.some((record) => record.id === 'groove-me'), false);
  assert.equal(records.some((record) => record.id === 'unexpected'), true);
  assert.equal(records.find((record) => record.id === 'cosmic-records-history').sections.length >= 2, true);
  assert.equal(records.find((record) => record.id === 'cosmic-records-history').children.some((child) => child.id === 'groove-me'), true);
  assert.equal(records.find((record) => record.id === 'screen-credits-history').sections.length >= 1, true);
});

test('expanded archive preserves the corrected Cosmic sequence and approved artwork', async () => {
  const source = JSON.parse(await readFile(recordsUrl, 'utf8'));
  const cosmic = source.records.find(record => record.id === 'cosmic-records-history');
  assert.equal(cosmic.children.length, 17);
  assert.equal(cosmic.sortDate, '1996-01-01');
  assert.equal(cosmic.children[4].title, 'Trixta / Friction');
  assert.equal(cosmic.children[16].title, 'Time Travel E.P.');
  assert.equal(cosmic.children.slice(0, 4).every(child => child.gallery[0].kind === 'image'), true);
  assert.equal(source.records.find(record => record.id === 'singles-remixes').children.length, 18);
  const archive = await readFile(archiveUrl, 'utf8');
  assert.match(archive, /href="\/archive\/"/);
});

test('career index opens shared portfolio records in the theater reference deck', async () => {
  const [archive, engine, css] = await Promise.all([
    readFile(archiveUrl, 'utf8'),
    readFile(engineUrl, 'utf8'),
    readFile(cssUrl, 'utf8'),
  ]);

  assert.match(archive, /data-open-reference/);
  assert.match(archive, /CAREER & RELEASE INDEX/);
  assert.match(engine, /id="reference-stage"/);
  assert.match(engine, /data-reference-panel/);
  assert.match(engine, /reference-stage__gallery/);
  assert.match(engine, /reference-stage__dossier-page/);
  assert.match(engine, /reference-stage__child-page/);
  assert.match(engine, /data-reference-slide/);
  assert.match(engine, /aria-label="Previous slide"/);
  assert.match(engine, /aria-label="Next slide"/);
  assert.match(css, /aspect-ratio:\s*16\s*\/\s*9/);
  assert.match(engine, /RESEARCH \/ CLEARANCE PENDING/);
	assert.match(engine, /id="close-reference"/);
	assert.match(engine, />BACK TO CREDENTIALS<\/button>/);
  assert.match(engine, /function openReference/);
  assert.match(engine, /function closeReference/);
  assert.match(engine, /referenceReturnState/);
  assert.doesNotMatch(engine, /playerDock\.inert = true/);
  assert.match(engine, /scrollIntoView/);
  assert.equal((engine.match(/if \(typeof referenceReturnState !== 'undefined' && referenceReturnState\) return;/g) ?? []).length >= 2, true);
  assert.match(css, /\.reference-stage\s*\{/);
  assert.match(css, /\.reference-stage__record\s*\{/);
  assert.match(css, /\.reference-stage__gallery\s*\{/);
});

test('pilot archive avoids unresolved superlatives and publication claims', async () => {
  const records = await readFile(recordsUrl, 'utf8');

  assert.doesNotMatch(records, /pioneer|seminal|first artist|best selling|published ebook|certified/i);
  assert.doesNotMatch(records, /settlement|royalt(?:y|ies)|payment|contract terms/i);
});
