import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  assertUniqueObjectKeys,
  discoverMedia,
  safeObjectName,
  toManifestItem,
} from '../scripts/media-catalog.mjs';

test('safeObjectName normalizes punctuation but preserves the extension', () => {
  assert.equal(safeObjectName('3I | ATLAS_14.MP4'), '3i-atlas-14.mp4');
});

test('discoverMedia returns supported files in stable order', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'viaims-media-'));
  await mkdir(path.join(root, 'public/media/video'), { recursive: true });
  await mkdir(path.join(root, 'public/media/audio'), { recursive: true });
  await writeFile(path.join(root, 'public/media/video', 'B.MP4'), 'video');
  await writeFile(path.join(root, 'public/media/video', '.hidden.mp4'), 'hidden');
  await writeFile(path.join(root, 'public/media/audio', 'A_master.WAV'), 'audio');

  const files = await discoverMedia(root);
  assert.deepEqual(files.map((file) => file.objectKey), [
    'portfolio/audio/a-master.wav',
    'portfolio/video/b.mp4',
  ]);
});

test('assertUniqueObjectKeys rejects normalization collisions', () => {
  assert.throws(() => assertUniqueObjectKeys([
    { objectKey: 'portfolio/video/a-b.mp4' },
    { objectKey: 'portfolio/video/a-b.mp4' },
  ]), /duplicate Blob key/);
});

test('toManifestItem preserves the display name and derives media specs', () => {
  const item = toManifestItem({
    kind: 'video',
    filename: '3I | ATLAS_14.MP4',
    objectKey: 'portfolio/video/3i-atlas-14.mp4',
  }, 'https://example.public.blob.vercel-storage.com/portfolio/video/3i-atlas-14.mp4');
  assert.equal(item.title, '3I | ATLAS 14');
  assert.equal(item.engine, 'Sora Pro');
  assert.equal(item.specs, 'MP4 Master');
});
