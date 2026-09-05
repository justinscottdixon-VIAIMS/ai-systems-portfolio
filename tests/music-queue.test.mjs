import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceMusicQueue,
  createMusicQueue,
  selectMusicItem,
  selectMusicMode,
  setRepeatMode,
  toggleShuffle,
} from '../src/lib/music-queue.mjs';

const tracks = [
  { productId: 'a', audioSrc: 'a.wav', videoSrc: 'a.mp4' },
  { productId: 'b', audioSrc: 'b.wav', videoSrc: null },
  { productId: 'c', audioSrc: 'c.wav', videoSrc: 'c.mp4' },
];

const mixed = [
  { productId: 'song.wav', kind: 'audio', src: 'song.wav' },
  { productId: 'film.mov', kind: 'video', src: 'film.mov' },
  { productId: 'clip.mp4', kind: 'video', src: 'clip.mp4' },
];

for (const kind of ['audio', 'video']) {
  test(`shuffle excludes a retained removed ${kind} identity from navigation`, () => {
    const remaining = { productId: 'remaining', kind: 'audio', src: '/remaining.mp3' };
    const retained = { ...createMusicQueue([remaining]), currentProductId: 'removed', mode: kind, cursor: -1 };
    const shuffled = toggleShuffle(retained, () => 0);
    assert.deepEqual(shuffled.order, ['remaining']);
    assert.equal(shuffled.currentProductId, 'removed');
    assert.equal(shuffled.cursor, -1);
    assert.equal(advanceMusicQueue(shuffled).currentProductId, 'remaining');
    assert.equal(advanceMusicQueue(setRepeatMode(shuffled, 'one')).currentProductId, 'remaining');
    assert.deepEqual(toggleShuffle(shuffled).order, ['remaining']);
  });
}

test('mixed Music starts in the first item mode and follows one combined order', () => {
  let queue = createMusicQueue(mixed);
  assert.equal(queue.currentProductId, 'song.wav');
  assert.equal(queue.mode, 'audio');
  assert.deepEqual(queue.order, ['song.wav', 'film.mov', 'clip.mp4']);

  queue = advanceMusicQueue(queue, 1);
  assert.equal(queue.currentProductId, 'film.mov');
  assert.equal(queue.mode, 'video');
  queue = advanceMusicQueue(queue, 1);
  assert.equal(queue.currentProductId, 'clip.mp4');
  assert.equal(queue.mode, 'video');
  queue = advanceMusicQueue(queue, -1);
  assert.equal(queue.currentProductId, 'film.mov');
  assert.equal(queue.mode, 'video');
  queue = advanceMusicQueue(queue, -1);
  assert.equal(queue.currentProductId, 'song.wav');
  assert.equal(queue.mode, 'audio');
});

test('direct mixed Music selection uses the selected item kind', () => {
  const queue = createMusicQueue(mixed);
  assert.equal(selectMusicItem(queue, 'film.mov').mode, 'video');
  assert.equal(selectMusicItem(queue, 'song.wav').mode, 'audio');
  assert.throws(
    () => createMusicQueue([{ productId: 'notes.txt', kind: 'document', src: 'notes.txt' }]),
    /unsupported Music kind: document/,
  );
});

test('mixed Music repeat and shuffle retain the active item mode', () => {
  let queue = selectMusicItem(createMusicQueue(mixed), 'clip.mp4');
  queue = setRepeatMode(queue, 'all');
  queue = advanceMusicQueue(queue, 1);
  assert.equal(queue.currentProductId, 'song.wav');
  assert.equal(queue.mode, 'audio');

  queue = setRepeatMode(selectMusicItem(queue, 'film.mov'), 'one');
  queue = advanceMusicQueue(queue, 1);
  assert.equal(queue.currentProductId, 'film.mov');
  assert.equal(queue.mode, 'video');

  queue = toggleShuffle(setRepeatMode(queue, 'off'), () => 0);
  assert.equal(queue.currentProductId, 'film.mov');
  assert.equal(queue.mode, 'video');
  queue = advanceMusicQueue(queue, 1);
  assert.equal(queue.currentProductId, 'clip.mp4');
  assert.equal(queue.mode, 'video');
  queue = advanceMusicQueue(queue, 1);
  assert.equal(queue.currentProductId, 'song.wav');
  assert.equal(queue.mode, 'audio');
});

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
