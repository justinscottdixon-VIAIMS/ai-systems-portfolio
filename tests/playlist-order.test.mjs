import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePlaylistOrder } from '../src/lib/playlist-order.mjs';

const videoExtensions = new Set(['.mp4', '.mov', '.webm']);

function resolve(filenames, orderEntries) {
  return resolvePlaylistOrder({ provider: 'Cinema', filenames, orderEntries, supportedExtensions: videoExtensions });
}

test('sidecar order is exact and unlisted media follows in natural filename order', () => {
  assert.deepEqual(
    resolve(['Finale.mp4', 'Clip 10.mp4', 'Opening.mp4', 'Clip 2.mp4'], ['Opening.mp4', 'Finale.mp4']),
    ['Opening.mp4', 'Finale.mp4', 'Clip 2.mp4', 'Clip 10.mp4'],
  );
});

test('sidecar insertion changes position without renaming media files', () => {
  const filenames = ['Opening.mp4', 'Interview.mp4', 'Atlas.mp4'];
  assert.deepEqual(resolve(filenames, ['Opening.mp4', 'Interview.mp4', 'Atlas.mp4']), filenames);
});

test('absent and empty sidecars use deterministic natural fallback', () => {
  assert.deepEqual(resolve(['Clip 10.mp4', 'Clip 2.mp4'], null), ['Clip 2.mp4', 'Clip 10.mp4']);
  assert.deepEqual(resolve(['Clip 10.mp4', 'Clip 2.mp4'], []), ['Clip 2.mp4', 'Clip 10.mp4']);
});

test('natural fallback uses an exact tie-breaker for collator-equivalent filenames', () => {
  const forward = resolve(['alpha.mp4', 'Álpha.mp4', 'Alpha.mp4'], null);
  const reverse = resolve(['Alpha.mp4', 'Álpha.mp4', 'alpha.mp4'], null);
  assert.deepEqual(forward, reverse);
  assert.deepEqual(forward, ['Alpha.mp4', 'alpha.mp4', 'Álpha.mp4']);
});

test('sidecar rejects duplicates missing files and case mismatches with provider context', () => {
  assert.throws(() => resolve(['Atlas.mp4'], ['Atlas.mp4', 'Atlas.mp4']), /Cinema.*duplicate.*Atlas\.mp4/i);
  assert.throws(() => resolve(['Atlas.mp4'], ['Missing.mp4']), /Cinema.*missing.*Missing\.mp4/i);
  assert.throws(() => resolve(['Atlas.mp4'], ['atlas.mp4']), /Cinema.*missing.*atlas\.mp4/i);
});

test('sidecar rejects paths and unsupported provider file types', () => {
  assert.throws(() => resolve(['Atlas.mp4'], ['../Atlas.mp4']), /Cinema.*path.*\.\.\/Atlas\.mp4/i);
  assert.throws(() => resolve(['Atlas.mp4'], ['/tmp/Atlas.mp4']), /Cinema.*path.*\/tmp\/Atlas\.mp4/i);
  assert.throws(() => resolve(['Song.wav'], ['Song.wav']), /Cinema.*unsupported.*Song\.wav/i);
});

test('sidecar rejects non-array and non-string values', () => {
  assert.throws(() => resolve(['Atlas.mp4'], { first: 'Atlas.mp4' }), /Cinema.*array/i);
  assert.throws(() => resolve(['Atlas.mp4'], ['']), /Cinema.*non-empty filename/i);
	assert.throws(() => resolve(['Atlas.mp4'], [42]), /Cinema.*index 0.*42/i);
});
