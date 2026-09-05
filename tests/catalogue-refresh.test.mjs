import test from 'node:test';
import assert from 'node:assert/strict';
import * as api from '../src/lib/catalogue-refresh.mjs';
const fp = (character) => character.repeat(64);
const item = (id = 'Cinema/a.mp4', patch = {}) => ({
  id,
  versionId: 'v1',
  pathname: id,
  folder: 'cinema',
  kind: 'video',
  title: 'Film',
  src: `https://media.example.test/${id}`,
  size: 1024,
  uploadedAt: '2026-09-04T12:00:00.000Z',
  playlistOrder: 0,
  ...patch,
});
const bootstrapItem = (id = 'a', patch = {}) => ({
  id,
  versionId: 'v1',
  folder: 'cinema',
  kind: 'video',
  title: 'Film',
  src: `https://media.example.test/${id}/v1.mp4`,
  width: 720,
  height: 1280,
  aspect: 'portrait',
  ...patch,
});
const runtimeItem = (id = 'a', patch = {}) => ({ ...bootstrapItem(id), ...patch });
const live = (fingerprint, items) => ({ authoritative: true, fingerprint, items });

test('runtime boundary exposes the four pure operations', () => {
  for (const name of ['createCatalogueRefreshState', 'refreshCatalogue', 'catalogueRefreshDecision', 'reconcileActiveCatalogueItem']) assert.equal(typeof api[name], 'function', name);
});

test('bootstrap survives failures only until the first authoritative response', () => {
  const bootstrap = api.createCatalogueRefreshState([bootstrapItem()]);
  assert.equal(bootstrap.authoritative, false);
  assert.equal(bootstrap.fingerprint, null);
  assert.equal(api.refreshCatalogue(bootstrap, null).state, bootstrap);
  const accepted = api.refreshCatalogue(bootstrap, live(fp('a'), []));
  assert.equal(accepted.status, 'accepted');
  assert.deepEqual(accepted.state.items, []);
  assert.equal(accepted.state.authoritative, true);
  assert.equal(api.refreshCatalogue(accepted.state, null).state, accepted.state);
  assert.equal(api.refreshCatalogue(accepted.state, live(fp('a'), [item()])).status, 'fingerprint-conflict');
});

test('rejects malformed envelopes and items atomically, retaining last accepted snapshot', () => {
  const state = api.refreshCatalogue(api.createCatalogueRefreshState(), live(fp('a'), [item()])).state;
  const bad = [
    {},
    live('', []),
    live('A'.repeat(64), []),
    live('g'.repeat(64), []),
    live('a'.repeat(63), []),
    live('a'.repeat(65), []),
    { ...live(fp('b'), []), authoritative: false },
    live(fp('b'), null),
    live(fp('b'), [item(), item()]),
    live(fp('b'), [item('Cinema/b.mp4', { size: 0 })]),
    live(fp('b'), [item('Cinema/b.mp4', { folder: 'music' })]),
    live(fp('b'), [item('Cinema/b.mp4', { src: 'http://example.test/b.mp4' })]),
  ];
  for (const response of bad) {
    const result = api.refreshCatalogue(state, response);
    assert.equal(result.status, 'invalid');
    assert.equal(result.state, state);
  }
});

test('same fingerprint must describe the same ordered projected data and a new fingerprint replaces it', () => {
  const a = item('Cinema/a.mp4', { playlistOrder: 0 });
  const b = item('Cinema/b.mp4', { playlistOrder: 1 });
  const state = api.refreshCatalogue(api.createCatalogueRefreshState(), live(fp('a'), [a, b])).state;
  assert.equal(api.refreshCatalogue(state, live(fp('a'), [b, a])).status, 'fingerprint-conflict');
  assert.equal(api.refreshCatalogue(state, live(fp('a'), [item('Cinema/a.mp4', { title: 'Changed' }), b])).status, 'fingerprint-conflict');
  const same = api.refreshCatalogue(state, live(fp('a'), [{ ...a, privateToken: 'ignore' }, b]));
  assert.equal(same.status, 'unchanged');
  assert.equal(same.state, state);
  const replaced = api.refreshCatalogue(state, live(fp('b'), []));
  assert.equal(replaced.status, 'accepted');
  assert.equal(replaced.state.fingerprint, fp('b'));
  assert.deepEqual(replaced.state.items, []);
});

test('projects allowlisted Blob fields without requiring native metadata', () => {
  const rows = [
    item('Cinema/a.mp4', { ownerId: 'secret' }),
    item('Music/song.mp3', { folder: 'music', kind: 'audio', title: 'creative CASE' }),
    item('Music/clip.mp4', { folder: 'music', kind: 'video' }),
    item('Media/feature.webm', { folder: 'media' }),
    item('Music-Visuals/VIZ-VOID.mp4', { folder: 'music-visuals', visualTag: 'VIZ-VOID' }),
  ];
  const state = api.refreshCatalogue(api.createCatalogueRefreshState(), live(fp('c'), rows)).state;
  assert.equal('ownerId' in state.items[0], false);
  assert.equal('width' in state.items[0], false);
  assert.deepEqual(state.items.map(({ folder, kind }) => [folder, kind]), [
    ['cinema', 'video'],
    ['music', 'audio'],
    ['music', 'video'],
    ['media', 'video'],
    ['music-visuals', 'video'],
  ]);
  assert.equal(state.items[1].title, 'creative CASE');
  assert.equal(state.items[4].visualTag, 'VIZ-VOID');
  rows[0].title = 'Changed outside';
  assert.equal(state.items[0].title, 'Film');
  assert.ok(Object.isFrozen(state.items[0]));
  assert.throws(() => api.createCatalogueRefreshState([bootstrapItem('bad', { title: '' })]));
});

test('visible scheduling checks immediately, every 15 seconds, and on focus without overlap', () => {
  const decide = (patch) => api.catalogueRefreshDecision({ now: 20_000, lastStartedAt: 10_000, visible: true, inFlight: false, focusRegained: false, ...patch });
  assert.deepEqual(decide({ lastStartedAt: null }), { shouldRequest: true, delayMs: 0 });
  assert.deepEqual(decide({}), { shouldRequest: false, delayMs: 5_000 });
  assert.deepEqual(decide({ now: 25_000 }), { shouldRequest: true, delayMs: 0 });
  assert.deepEqual(decide({ focusRegained: true }), { shouldRequest: true, delayMs: 0 });
  assert.deepEqual(decide({ visible: false, focusRegained: true }), { shouldRequest: false, delayMs: null });
  assert.deepEqual(decide({ inFlight: true, focusRegained: true }), { shouldRequest: false, delayMs: null });
  assert.throws(() => decide({ now: NaN }));
});

test('reconciliation preserves active playback through unrelated edits, title and order changes', () => {
  const before = [runtimeItem('a'), runtimeItem('b')];
  const active = { id: 'a', versionId: 'v1' };
  for (const after of [[runtimeItem('b') , runtimeItem('a')], [runtimeItem('a', { title: 'New title' })], [...before, runtimeItem('c')]]) {
    assert.deepEqual(api.reconcileActiveCatalogueItem(before, after, active), { action: 'preserve', itemId: 'a' });
  }
  assert.deepEqual(api.reconcileActiveCatalogueItem(before, [], active), { action: 'unpublished', itemId: 'a' });
  for (const patch of [{ versionId: 'v2', src: 'https://media.example.test/a/v2.mp4' }, { src: 'https://media.example.test/a/other.mp4' }, { kind: 'audio', folder: 'media' }, { width: 1280, height: 720 }]) {
    assert.deepEqual(api.reconcileActiveCatalogueItem(before, [runtimeItem('a', patch)], active), { action: 'replaced', itemId: 'a' });
  }
  assert.deepEqual(api.reconcileActiveCatalogueItem(before, before, null), { action: 'none', itemId: null });
  assert.deepEqual(api.reconcileActiveCatalogueItem(before, before, { id: 'a', versionId: 'old' }), { action: 'replaced', itemId: 'a' });
});
