import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readMusicMetadata } from '../scripts/music-metadata.mjs';

async function directory() {
  return mkdtemp(path.join(os.tmpdir(), 'viaims-music-meta-'));
}

test('Music metadata accepts exact title overrides for existing tracks', async () => {
  const root = await directory();
  await writeFile(path.join(root, 'track-metadata.json'), JSON.stringify({
    'Song.mp3': { title: 'eXAct intent' },
  }));
  const metadata = await readMusicMetadata({ musicDirectory: root, filenames: ['Song.mp3'] });
  assert.deepEqual(metadata.get('Song.mp3'), { title: 'eXAct intent' });
});

test('absent Music metadata is an empty map', async () => {
  const root = await directory();
  const metadata = await readMusicMetadata({ musicDirectory: root, filenames: ['Song.mp3'] });
  assert.equal(metadata.size, 0);
});

test('Music metadata rejects unknown files and unsupported fields with sidecar context', async () => {
  const root = await directory();
  const sidecar = path.join(root, 'track-metadata.json');
  await writeFile(sidecar, JSON.stringify({ 'Missing.mp3': { title: 'Missing' } }));
  await assert.rejects(
    () => readMusicMetadata({ musicDirectory: root, filenames: ['Song.mp3'] }),
    (error) => error.message.includes(sidecar) && error.message.includes('Missing.mp3'),
  );
  await writeFile(sidecar, JSON.stringify({ 'Song.mp3': { visual: 'implicit.mp4' } }));
  await assert.rejects(
    () => readMusicMetadata({ musicDirectory: root, filenames: ['Song.mp3'] }),
    (error) => error.message.includes(sidecar) && error.message.includes('visual'),
  );
});

test('Music metadata rejects invalid JSON and empty titles', async () => {
  const root = await directory();
  const sidecar = path.join(root, 'track-metadata.json');
  await writeFile(sidecar, '{broken');
  await assert.rejects(() => readMusicMetadata({ musicDirectory: root, filenames: [] }), /valid JSON/i);
  await writeFile(sidecar, JSON.stringify({ 'Song.mp3': { title: '  ' } }));
  await assert.rejects(() => readMusicMetadata({ musicDirectory: root, filenames: ['Song.mp3'] }), /title/i);
});
