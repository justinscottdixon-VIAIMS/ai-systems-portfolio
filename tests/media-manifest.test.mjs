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

test('toPlaylists preserves manifest order within each media kind', () => {
  const manifest = structuredClone(valid);
  manifest.items.push({
    id: 'video-atlas-2',
    kind: 'video',
    title: '3I | ATLAS 2',
    src: 'https://example.public.blob.vercel-storage.com/video/3i-atlas-2.mp4',
    specs: 'MP4 Master',
    engine: 'Sora Pro',
  });
  assert.deepEqual(toPlaylists(manifest).videoPlaylist.map((item) => item.id), [
    'video-atlas-1',
    'video-atlas-2',
  ]);
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

test('manifest preserves validated video aspect and reusable Music visual metadata', () => {
  const input = structuredClone(valid);
  Object.assign(input.items[0], { width: 720, height: 1280, aspect: 'portrait' });
  input.items[1].title = 'V_Edges Fade_';
  input.items[1].visual = {
    tag: 'VIZ-VOID',
    src: 'https://example.public.blob.vercel-storage.com/visual/void.mp4',
    width: 1080,
    height: 1920,
    aspect: 'portrait',
  };
  const parsed = parseMediaManifest(input);
  assert.equal(parsed.items[0].aspect, 'portrait');
  assert.deepEqual(parsed.items[1].visual, input.items[1].visual);
});

test('manifest rejects incomplete or contradictory dimension metadata', () => {
  const incomplete = structuredClone(valid);
  incomplete.items[0].width = 720;
  assert.throws(() => parseMediaManifest(incomplete), /width.*height.*aspect/i);
  const contradictory = structuredClone(valid);
  Object.assign(contradictory.items[0], { width: 720, height: 1280, aspect: 'landscape' });
  assert.throws(() => parseMediaManifest(contradictory), /aspect.*dimensions/i);
});

test('manifest rejects invalid Music visuals and visual metadata on video items', () => {
  const badTag = structuredClone(valid);
  badTag.items[1].visual = { tag: 'void', src: 'https://cdn.example/void.mp4', width: 1, height: 2, aspect: 'portrait' };
  assert.throws(() => parseMediaManifest(badTag), /visual.*tag/i);
  const onVideo = structuredClone(valid);
  onVideo.items[0].visual = { tag: 'VIZ-VOID', src: 'https://cdn.example/void.mp4', width: 1, height: 2, aspect: 'portrait' };
  assert.throws(() => parseMediaManifest(onVideo), /visual.*audio/i);
});
