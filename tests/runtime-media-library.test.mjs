import test from 'node:test';
import assert from 'node:assert/strict';
import { toRuntimeMediaLibrary } from '../src/lib/runtime-media-library.mjs';

const video = (id, folder, playlistOrder, patch = {}) => ({
  id,
  pathname: id,
  folder,
  kind: 'video',
  title: id.split('/').at(-1).replace(/\.[^.]+$/, ''),
  src: `https://media.example.test/${id}`,
  playlistOrder,
  width: 1920,
  height: 1080,
  aspect: 'landscape',
  ...patch,
});

const items = [
  video('Music/film.mp4', 'music', 2, { title: 'Film' }),
  video('Media/reel.mov', 'media', 0, { title: 'Reel' }),
  {
    id: 'Music/film.wav',
    pathname: 'Music/film.wav',
    folder: 'music',
    kind: 'audio',
    title: 'Film',
    src: 'https://media.example.test/Music/film.wav',
    playlistOrder: 0,
    visualTag: 'VIZ-VOID',
  },
  video('Music-Visuals/VIZ-VOID.mp4', 'music-visuals', 0, {
    title: 'VIZ-VOID',
    visualTag: 'VIZ-VOID',
    width: 1080,
    height: 1920,
    aspect: 'portrait',
  }),
  video('Cinema/second.mp4', 'cinema', 1, { title: 'Second' }),
  video('Music/film.mov', 'music', 1, {
    title: 'Film',
    width: 1080,
    height: 1920,
    aspect: 'portrait',
  }),
  {
    id: 'Music/orphan.mp3',
    pathname: 'Music/orphan.mp3',
    folder: 'music',
    kind: 'audio',
    title: 'Orphan',
    src: 'https://media.example.test/Music/orphan.mp3',
    playlistOrder: 3,
    visualTag: 'VIZ-MISSING',
  },
  video('Cinema/first.mov', 'cinema', 0, { title: 'First' }),
];

test('projects provider rows in playlist order without pairing independent Music files', () => {
  const library = toRuntimeMediaLibrary(items);

  assert.deepEqual(library.cinema.map(({ id }) => id), [
    'Cinema/first.mov',
    'Cinema/second.mp4',
  ]);
  assert.deepEqual(library.media.map(({ id }) => id), ['Media/reel.mov']);
  assert.deepEqual(library.music.map(({ productId, kind, src }) => [productId, kind, src]), [
    ['Music/film.wav', 'audio', 'https://media.example.test/Music/film.wav'],
    ['Music/film.mov', 'video', 'https://media.example.test/Music/film.mov'],
    ['Music/film.mp4', 'video', 'https://media.example.test/Music/film.mp4'],
    ['Music/orphan.mp3', 'audio', 'https://media.example.test/Music/orphan.mp3'],
  ]);
  assert.equal(library.cinema.some(({ id }) => id.startsWith('Music-Visuals/')), false);
  assert.equal(library.music.some(({ productId }) => productId.startsWith('Music-Visuals/')), false);
  assert.equal(library.media.some(({ id }) => id.startsWith('Music-Visuals/')), false);
});

test('attaches only matching validated Music visuals and leaves missing visuals playable', () => {
  const library = toRuntimeMediaLibrary(items);
  assert.deepEqual(library.musicVisuals, [{
    tag: 'VIZ-VOID',
    src: 'https://media.example.test/Music-Visuals/VIZ-VOID.mp4',
    width: 1080,
    height: 1920,
    aspect: 'portrait',
  }]);
  assert.deepEqual(library.music[0].visual, library.musicVisuals[0]);
  assert.equal(library.music[3].visual, undefined);
  assert.equal(library.music[3].src, 'https://media.example.test/Music/orphan.mp3');

  const incompleteVisual = video('Music-Visuals/VIZ-RAW.mp4', 'music-visuals', 1, {
    title: 'VIZ-RAW',
    visualTag: 'VIZ-RAW',
    width: undefined,
    height: undefined,
    aspect: undefined,
  });
  const taggedAudio = {
    ...items[2],
    id: 'Music/raw.wav',
    pathname: 'Music/raw.wav',
    src: 'https://media.example.test/Music/raw.wav',
    visualTag: 'VIZ-RAW',
  };
  const unvalidated = toRuntimeMediaLibrary([taggedAudio, incompleteVisual]);
  assert.deepEqual(unvalidated.musicVisuals, []);
  assert.equal(unvalidated.music[0].visual, undefined);
});

test('generates factual file and dimension specs from catalogue metadata', () => {
  const library = toRuntimeMediaLibrary(items);
  assert.equal(library.cinema[0].specs, 'MOV • 1920×1080');
  assert.equal(library.music[0].specs, 'WAV');
  assert.equal(library.music[1].specs, 'MOV • 1080×1920');
  assert.equal(library.media[0].specs, 'MOV • 1920×1080');
});

test('returns detached frozen provider data without mutating catalogue items', () => {
  const before = structuredClone(items);
  const library = toRuntimeMediaLibrary(items);

  assert.deepEqual(items, before);
  for (const provider of ['cinema', 'music', 'media', 'musicVisuals']) {
    assert.equal(Object.isFrozen(library[provider]), true, provider);
    assert.equal(Object.isFrozen(library[provider][0]), true, `${provider} item`);
  }
  assert.notEqual(library.cinema[0], items.at(-1));
  assert.notEqual(library.music[0].visual, library.musicVisuals[0]);
  assert.equal(Object.isFrozen(library.music[0].visual), true);
});
