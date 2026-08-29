import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  assertUniqueManifestIds,
  assertUniqueObjectKeys,
  discoverMedia,
  manifestItemId,
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
    'portfolio/audio/6ed8919ce20490a5e3ad8630a4fab69475297abd07db73918dd5f36fcfaeb11b-a-master.wav',
    'portfolio/video/0cab1c9617404faf2b24e221e189ca5945813e14d3f766345b09ca13bbe28ffc-b.mp4',
  ]);
});

test('assertUniqueObjectKeys rejects normalization collisions', () => {
  assert.throws(() => assertUniqueObjectKeys([
    { objectKey: 'portfolio/video/a-b.mp4' },
    { objectKey: 'portfolio/video/a-b.mp4' },
  ]), /duplicate Blob key/);
});

test('assertUniqueManifestIds rejects filename normalization collisions', () => {
  assert.throws(() => assertUniqueManifestIds([
    { kind: 'video', filename: 'A_B.MP4' },
    { kind: 'video', filename: 'A-B.MP4' },
  ]), /duplicate media id/);
});

test('discoverMedia maps every supported extension to its Blob content type', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'viaims-media-'));
  await mkdir(path.join(root, 'public/media/video'), { recursive: true });
  await mkdir(path.join(root, 'public/media/audio'), { recursive: true });
  const expected = {
    'audio/a.wav': 'audio/wav',
    'audio/b.mp3': 'audio/mpeg',
    'audio/c.m4a': 'audio/mp4',
    'audio/d.flac': 'audio/flac',
    'audio/e.aac': 'audio/aac',
    'video/f.mp4': 'video/mp4',
    'video/g.mov': 'video/quicktime',
    'video/h.webm': 'video/webm',
  };
  for (const relativePath of Object.keys(expected)) {
    await writeFile(path.join(root, 'public/media', relativePath), 'media');
  }

  const files = await discoverMedia(root);
  assert.deepEqual(
    Object.fromEntries(files.map((file) => [`${file.kind}/${file.filename.toLowerCase()}`, file.contentType])),
    expected,
  );
});

test('discoverMedia gives changed bytes a new release key without changing the manifest ID', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'viaims-media-'));
  const filePath = path.join(root, 'public/media/video', 'Atlas.MP4');
  await mkdir(path.dirname(filePath), { recursive: true });
  await mkdir(path.join(root, 'public/media/audio'), { recursive: true });
  await writeFile(filePath, 'first release');
  const [first] = await discoverMedia(root);
  await writeFile(filePath, 'second release');
  const [second] = await discoverMedia(root);

  assert.notEqual(second.objectKey, first.objectKey);
  assert.equal(manifestItemId(second), manifestItemId(first));
});

test('toManifestItem preserves the display name and derives media specs', () => {
  const item = toManifestItem({
    kind: 'video',
    filename: '3I | ATLAS_14.MP4',
    objectKey: 'portfolio/video/3i-atlas-14.mp4',
  }, 'https://example.public.blob.vercel-storage.com/portfolio/video/3i-atlas-14.mp4');
  assert.equal(item.title, '3I | ATLAS 14');
  assert.equal(item.id, 'video-3i-atlas-14');
  assert.equal(item.engine, 'Sora Pro');
  assert.equal(item.specs, 'MP4 Master');
});
