import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { discoverPreviewMedia } from '../scripts/preview-media-catalog.mjs';

async function tree() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'viaims-preview-media-'));
  await Promise.all(['Cinema', 'Music', 'Media'].map((provider) => mkdir(path.join(root, provider))));
  return root;
}

test('preview discovery preserves provider sidecar order and uses an isolated Blob namespace', async () => {
  const root = await tree();
  await writeFile(path.join(root, 'Cinema', 'First.mp4'), 'first');
  await writeFile(path.join(root, 'Cinema', 'Second.mp4'), 'second');
  await writeFile(path.join(root, 'Cinema', 'playlist-order.json'), '["Second.mp4","First.mp4"]');
  await writeFile(path.join(root, 'Music', 'Song.mp3'), 'song');

  const files = await discoverPreviewMedia({
    ingestionRoot: root,
    videoMetadataReader: async () => ({ width: 720, height: 1280, aspect: 'portrait' }),
  });

  assert.deepEqual(files.map((file) => file.filename), ['Second.mp4', 'First.mp4', 'Song.mp3']);
  assert.deepEqual(files.map((file) => file.kind), ['video', 'video', 'audio']);
  assert.deepEqual(files.map((file) => file.role), ['cinema', 'cinema', 'music']);
  assert.equal(files[0].aspect, 'portrait');
  assert.equal(files.every((file) => file.objectKey.startsWith(`portfolio-preview/${file.kind}/`)), true);
  assert.equal(files.at(-1).contentType, 'audio/mpeg');
});

test('preview discovery resolves one hidden reusable visual without adding it to Cinema', async () => {
  const root = await tree();
  await writeFile(path.join(root, 'Cinema', 'Portrait.mp4'), 'cinema');
  await writeFile(path.join(root, 'Music', 'Song__VIZ-VOID.mp3'), 'song');
  await mkdir(path.join(root, 'Media', 'Music-Visuals'));
  await writeFile(path.join(root, 'Media', 'Music-Visuals', 'VIZ-VOID.mp4'), 'visual');
  const files = await discoverPreviewMedia({
    ingestionRoot: root,
    videoMetadataReader: async (absolutePath) => absolutePath.includes('VIZ-VOID')
      ? { width: 1080, height: 1920, aspect: 'portrait' }
      : { width: 720, height: 1280, aspect: 'portrait' },
  });
  assert.deepEqual(files.map((file) => file.role), ['cinema', 'music', 'music-visual']);
  assert.equal(files[1].visualTag, 'VIZ-VOID');
  assert.equal(files[1].title, 'V_Song_');
  assert.equal(files[2].visualTag, 'VIZ-VOID');
});

test('preview discovery rejects a Music visual tag without a matching system visual', async () => {
  const root = await tree();
  await writeFile(path.join(root, 'Music', 'Song__VIZ-MISSING.mp3'), 'song');
  await assert.rejects(
    () => discoverPreviewMedia({ ingestionRoot: root, videoMetadataReader: async () => ({ width: 1, height: 2, aspect: 'portrait' }) }),
    /VIZ-MISSING.*matching visual/i,
  );
});

test('preview discovery applies exact Music title sidecar overrides', async () => {
  const root = await tree();
  await writeFile(path.join(root, 'Music', 'odd_caps.mp3'), 'song');
  await writeFile(path.join(root, 'Music', 'track-metadata.json'), JSON.stringify({ 'odd_caps.mp3': { title: 'odd capS' } }));
  const files = await discoverPreviewMedia({ ingestionRoot: root, videoMetadataReader: async () => ({ width: 1, height: 2, aspect: 'portrait' }) });
  assert.equal(files[0].title, 'V_odd capS_');
});

test('preview discovery rejects Media payloads until their manifest provider is representable', async () => {
  const root = await tree();
  await writeFile(path.join(root, 'Media', 'Interview.mp4'), 'media');
  await assert.rejects(
    () => discoverPreviewMedia({ ingestionRoot: root, videoMetadataReader: async () => ({ width: 1, height: 2, aspect: 'portrait' }) }),
    /Media provider.*not yet representable/i,
  );
});
