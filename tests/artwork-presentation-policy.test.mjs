import test from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import config from '../astro.config.mjs';
import { excludedArtworkPaths, isExcludedArtwork, presentationArtwork } from '../src/lib/artwork-presentation-policy.mjs';
import { toPortfolioRecords } from '../src/lib/portfolio-records.mjs';

const readJson = async relative => JSON.parse(await readFile(new URL(relative, import.meta.url), 'utf8'));

test('capture exclusion matches the documented owner photographs exactly', async () => {
  const singles = await readJson('../docs/research/2026-09-29-singles-artwork-import.json');
  const remaining = await readJson('../docs/research/2026-10-11-artwork-exclusion-evidence.json');
  const documented = [...singles.images.map(image => image.output), ...remaining.images.filter(image => image.release === 'time-travel').map(image => image.output)];
  assert.equal(excludedArtworkPaths.length, 29);
  assert.equal(new Set(excludedArtworkPaths).size, 29);
  assert.deepEqual(new Set(excludedArtworkPaths), new Set(documented));
});

test('public portfolio projection removes all captures while preserving catalogue facts and source records', async () => {
  const source = await readJson('../src/data/portfolio-records.json');
  const before = structuredClone(source);
  const records = toPortfolioRecords(source);
  let originalCaptureReferences = 0;
  for (const original of source.records) {
    const projected = records.find(record => record.id === original.id);
    for (const [input, output] of [[original, projected], ...(original.children ?? []).map(child => [child, projected.children.find(item => item.id === child.id)])]) {
      originalCaptureReferences += input.gallery.filter(item => isExcludedArtwork(item.src)).length;
      for (const key of ['id', 'title', 'summary', 'roles']) assert.deepEqual(output[key], input[key]);
      assert.ok(output.gallery.length > 0);
      assert.ok(output.gallery.every(item => !isExcludedArtwork(item.src)));
    }
  }
  assert.equal(originalCaptureReferences, 28);
  assert.deepEqual(source, before);
  const singles = records.find(record => record.id === 'singles-remixes');
  const rawSingles = source.records.find(record => record.id === 'singles-remixes');
  const awaitingArtworkIds = new Set([rawSingles, ...rawSingles.children]
    .filter(item => item.gallery.every(image => isExcludedArtwork(image.src)))
    .map(item => item.id));
  for (const item of [singles, ...singles.children].filter(item => awaitingArtworkIds.has(item.id))) {
    assert.equal(item.gallery.length, 1);
    assert.equal(item.gallery[0].kind, 'pending');
    assert.equal('src' in item.gallery[0], false);
  }
  assert.deepEqual(records.find(record => record.id === 'cosmic-records-history').children.find(item => item.id === 'sunshine-state-of-mind').gallery.map(item => item.src), [
    '/reference/restored-artwork/sunshine-state-of-mind-full-compilation-approved-v1.png',
  ]);
  assert.deepEqual(singles.children.find(item => item.id === 'nc-02').gallery.map(item => item.src), [
    '/reference/restored-artwork/bedrock-beautiful-strange-ep-approved-v1.png',
  ]);
  assert.deepEqual(singles.children.find(item => item.id === 'nc-03').gallery.map(item => item.src), [
    '/reference/restored-artwork/keoki-altered-ego-trip-approved-v1.png',
  ]);
  assert.deepEqual(singles.children.find(item => item.id === 'nc-04').gallery.map(item => item.src), [
    '/reference/restored-artwork/magic-shop-code10-cover-approved-v1.png',
    '/reference/restored-artwork/magic-shop-code10-label-approved-v1.png',
  ]);
  assert.deepEqual(singles.children.find(item => item.id === 'nc-05').gallery.map(item => item.src), [
    '/reference/restored-artwork/acid-x-mas-sb013-sticker-approved-v1.png',
  ]);
  assert.deepEqual(singles.children.find(item => item.id === 'nc-06').gallery.map(item => item.src), [
    '/reference/restored-artwork/origin-refined-intricacy-99-approved-v1.png',
  ]);
  assert.deepEqual(singles.children.find(item => item.id === 'nc-07').gallery.map(item => item.src), [
    '/reference/restored-artwork/mot-mellow-promo-label-approved-v1.png',
  ]);
  assert.deepEqual(records.find(record => record.id === 'time-travel').gallery.map(item => item.src), ['/reference/time-travel-digital-cover.jpg']);
  assert.deepEqual(records.find(record => record.id === 'one-voyager-remix').gallery.map(item => item.src), [
    '/reference/restored-artwork/nc-13-aria-one-fire-a-side-approved-v1.webp',
    '/reference/remaining-artwork/global-underground-019.jpg',
  ]);
});

test('unrelated documentary photos and existing presentation art remain available', () => {
  const images = ['/reference/studio-evolution-thumbnail.jpg', '/reference/cosmic-records-photo.jpg', '/reference/cosmic-006-approved.png', '/reference/cosmic-017-scale-v6.png'].map(src => ({ kind: 'image', src, alt: 'Existing artwork', caption: 'Existing caption' }));
  assert.deepEqual(presentationArtwork(images), images);
});

test('current directory derivatives cannot reintroduce excluded capture sources', async () => {
  const derivatives = await readJson('../src/data/directory-image-review.json');
  for (const image of Object.values(derivatives)) {
    assert.equal(isExcludedArtwork(image.source.replace(/^public/, '')), false);
    assert.equal(isExcludedArtwork(image.desktop), false);
    assert.equal(isExcludedArtwork(image.mobile), false);
  }
});

test('all build scopes omit original capture copies and legacy evidence pages without touching sources', async t => {
  const hook = config.integrations.find(integration => integration.name === 'credentials-artwork-publication-policy').hooks['astro:build:done'];
  const root = await mkdtemp(path.join(tmpdir(), 'viaims-artwork-policy-'));
  const previousScope = process.env.VIAIMS_RELEASE_SCOPE;
  t.after(async () => {
    if (previousScope === undefined) delete process.env.VIAIMS_RELEASE_SCOPE;
    else process.env.VIAIMS_RELEASE_SCOPE = previousScope;
    await rm(root, { recursive: true, force: true });
  });
  const put = async (base, relative, content) => {
    const file = path.join(base, relative);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, content);
    return file;
  };
  const sourceFiles = await Promise.all(excludedArtworkPaths.map(src => put(path.join(root, 'sources'), src.slice(1), 'private source evidence')));
  for (const scope of ['full', 'selected', 'player']) {
    process.env.VIAIMS_RELEASE_SCOPE = scope;
    const output = path.join(root, scope);
    const captures = await Promise.all(excludedArtworkPaths.map(src => put(output, src.slice(1), 'copied capture')));
    const legacy = await put(output, 'reference/archive/legacy.html', `<img src="${excludedArtworkPaths[0]}">`);
    const approved = await put(output, 'reference/approved-art.png', 'presentation');
    const currentArchive = await put(output, 'archive/current/index.html', 'current dossier');
    const site = await put(output, 'index.html', 'site');
    await hook({ dir: pathToFileURL(`${output}${path.sep}`) });
    for (const file of [...captures, legacy]) await assert.rejects(access(file), { code: 'ENOENT' });
    assert.equal(await readFile(site, 'utf8'), 'site');
    for (const file of sourceFiles) assert.equal(await readFile(file, 'utf8'), 'private source evidence');
    if (scope === 'player') {
      for (const file of [approved, currentArchive]) await assert.rejects(access(file), { code: 'ENOENT' });
    } else {
      assert.equal(await readFile(approved, 'utf8'), 'presentation');
      assert.equal(await readFile(currentArchive, 'utf8'), 'current dossier');
    }
  }
});
