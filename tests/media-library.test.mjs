import test from 'node:test';
import assert from 'node:assert/strict';
import { toMediaLibrary } from '../src/lib/media-library.mjs';

const manifest = {
  version: 1,
  generatedAt: '2026-08-30T00:00:00.000Z',
  items: [
    { id: 'video-atlas', kind: 'video', title: 'Atlas', src: 'https://cdn.example/atlas.mp4', specs: 'MP4', engine: 'Sora' },
    { id: 'audio-north', kind: 'audio', title: 'Magnetic North', src: 'https://cdn.example/north.wav', specs: '24-bit WAV' },
  ],
};

const curated = {
  version: 1,
  music: [{
    productId: 'audio-north',
    musicVideoSrc: 'https://cdn.example/north-video.mp4',
  }],
  media: [{ id: 'media-reel', title: 'Systems Reel', src: 'https://cdn.example/reel.mp4', specs: 'MP4' }],
  youtube: [{ id: 'youtube-mix', title: 'Mix Walkthrough', videoId: 'M7lc1UVf-VE' }],
};

test('toMediaLibrary keeps four independent providers', () => {
  const library = toMediaLibrary(manifest, curated);
  assert.deepEqual(library.cinema.map((item) => item.id), ['video-atlas']);
  assert.deepEqual(library.music.map((item) => item.productId), ['audio-north']);
  assert.deepEqual(library.media.map((item) => item.id), ['media-reel']);
  assert.deepEqual(library.youtube.map((item) => item.id), ['youtube-mix']);
});

test('one Music product contains audio and optional video modes without entering Cinema', () => {
  const library = toMediaLibrary(manifest, curated);
  assert.equal(library.music[0].audioSrc, 'https://cdn.example/north.wav');
  assert.equal(library.music[0].videoSrc, 'https://cdn.example/north-video.mp4');
  assert.equal(library.music[0].storeHref, '/store?product=audio-north');
  assert.equal(library.cinema.some((item) => item.src === library.music[0].videoSrc), false);
});

test('empty curated providers produce explicit empty arrays without fabricated items', () => {
  const library = toMediaLibrary(manifest, { version: 1, music: [], media: [], youtube: [] });
  assert.deepEqual(library.media, []);
  assert.deepEqual(library.youtube, []);
  assert.equal(library.music[0].videoSrc, null);
});

test('curated entries must reference real Music products and HTTPS media', () => {
  assert.throws(
    () => toMediaLibrary(manifest, { ...curated, music: [{ productId: 'missing' }] }),
    /unknown Music product: missing/,
  );
  assert.throws(
    () => toMediaLibrary(manifest, { ...curated, media: [{ id: 'bad', title: 'Bad', src: '/local.mp4', specs: 'MP4' }] }),
    /must be an HTTPS URL/,
  );
});
