import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceMusicQueue,
  createMusicQueue,
  selectMusicMode,
  setRepeatMode,
  toggleShuffle,
} from '../src/lib/music-queue.mjs';

const tracks = [
  { productId: 'a', audioSrc: 'a.wav', videoSrc: 'a.mp4' },
  { productId: 'b', audioSrc: 'b.wav', videoSrc: null },
  { productId: 'c', audioSrc: 'c.wav', videoSrc: 'c.mp4' },
];

test('queue starts on one product identity in Audio mode', () => {
  const queue = createMusicQueue(tracks);
  assert.equal(queue.currentProductId, 'a');
  assert.equal(queue.mode, 'audio');
  assert.deepEqual(queue.order, ['a', 'b', 'c']);
});

test('mode selection preserves queue position and rejects missing video', () => {
  const queue = selectMusicMode(createMusicQueue(tracks), 'a', 'video');
  assert.equal(queue.currentProductId, 'a');
  assert.equal(queue.mode, 'video');
  assert.throws(() => selectMusicMode(queue, 'b', 'video'), /has no video asset/);
});

test('shuffle preserves the current product and randomizes only upcoming items', () => {
  const selected = selectMusicMode(createMusicQueue(tracks), 'b', 'audio');
  const shuffled = toggleShuffle(selected, () => 0);
  assert.equal(shuffled.currentProductId, 'b');
  assert.equal(shuffled.order[shuffled.cursor], 'b');
  assert.equal(shuffled.shuffle, true);
});

test('disabling shuffle restores natural order while preserving current product and cursor', () => {
  const selected = selectMusicMode(createMusicQueue(tracks), 'b', 'audio');
  const shuffled = toggleShuffle(selected, () => 0);
  const natural = toggleShuffle(shuffled);
  assert.equal(natural.shuffle, false);
  assert.deepEqual(natural.order, ['a', 'b', 'c']);
  assert.equal(natural.currentProductId, 'b');
  assert.equal(natural.cursor, 1);
});

test('queue rejects duplicate Music product identities', () => {
  assert.throws(
    () => createMusicQueue([...tracks, { ...tracks[0] }]),
    /duplicate Music product: a/,
  );
});

test('Repeat Off ends, Repeat All wraps, and Repeat One retains the current product', () => {
  let queue = selectMusicMode(createMusicQueue(tracks), 'c', 'audio');
  assert.equal(advanceMusicQueue(queue, 1), null);
  queue = setRepeatMode(queue, 'all');
  assert.equal(advanceMusicQueue(queue, 1).currentProductId, 'a');
  queue = setRepeatMode(queue, 'one');
  assert.equal(advanceMusicQueue(queue, 1).currentProductId, 'c');
});
