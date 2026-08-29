import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getMediaOrigin,
  parseMediaManifest,
  toPlaylists,
} from '../src/lib/media-manifest.mjs';

const valid = {
  version: 1,
  generatedAt: '2026-08-29T17:00:00.000Z',
  items: [
    {
      id: 'video-atlas-1',
      kind: 'video',
      title: '3I | ATLAS 1',
      src: 'https://example.public.blob.vercel-storage.com/video/3i-atlas-1.mp4',
      specs: 'MP4 Master',
      engine: 'Sora Pro',
    },
    {
      id: 'audio-edges-fade',
      kind: 'audio',
      title: 'V edges fade voo1.1.2 48k24b mstr',
      src: 'https://example.public.blob.vercel-storage.com/audio/v-edges-fade.wav',
      specs: 'WAV • 24-bit / 48kHz Staging',
    },
  ],
};

test('parseMediaManifest accepts a complete HTTPS manifest', () => {
  assert.deepEqual(parseMediaManifest(valid), valid);
});

test('parseMediaManifest rejects an unsupported version', () => {
  assert.throws(
    () => parseMediaManifest({ ...valid, version: 2 }),
    /version must be 1/,
  );
});

test('parseMediaManifest rejects non-HTTPS media', () => {
  const invalid = structuredClone(valid);
  invalid.items[0].src = '/media/video/local.mp4';
  assert.throws(() => parseMediaManifest(invalid), /HTTPS URL/);
});

test('toPlaylists splits video and audio without losing metadata', () => {
  const playlists = toPlaylists(parseMediaManifest(valid));
  assert.equal(playlists.videoPlaylist[0].engine, 'Sora Pro');
  assert.equal(playlists.audioPlaylist[0].id, 'audio-edges-fade');
});

test('toPlaylists supplies explicit standby entries for an empty manifest', () => {
  const playlists = toPlaylists({
    version: 1,
    generatedAt: '2026-08-29T17:00:00.000Z',
    items: [],
  });
  assert.equal(playlists.videoPlaylist[0].title, 'No Media Loaded');
  assert.equal(playlists.audioPlaylist[0].title, 'No Masters Loaded');
});

test('getMediaOrigin returns the first shared Blob origin', () => {
  assert.equal(getMediaOrigin(valid), 'https://example.public.blob.vercel-storage.com');
});
