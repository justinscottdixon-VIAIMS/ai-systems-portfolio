import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { syncMedia } from '../scripts/sync-media.mjs';

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'viaims-sync-'));
  await mkdir(path.join(root, 'public/media/video'), { recursive: true });
  await mkdir(path.join(root, 'public/media/audio'), { recursive: true });
  await mkdir(path.join(root, 'src/data'), { recursive: true });
  await writeFile(path.join(root, 'public/media/video', 'Atlas.MP4'), 'video');
  await writeFile(path.join(root, 'src/data/media.json'), '{"sentinel":true}\n');
  return root;
}

test('syncMedia replaces the manifest only after every upload succeeds', async () => {
  const root = await fixture();
  const manifest = await syncMedia({
    rootDirectory: root,
    token: 'test-token',
    uploader: async (pathname) => ({ url: `https://example.public.blob.vercel-storage.com/${pathname}` }),
    generatedAt: '2026-08-29T17:00:00.000Z',
  });
  const written = JSON.parse(await readFile(path.join(root, 'src/data/media.json'), 'utf8'));
  assert.deepEqual(written, manifest);
  assert.equal(written.items.length, 1);
});

test('syncMedia preserves the old manifest after an upload failure', async () => {
  const root = await fixture();
  await assert.rejects(() => syncMedia({
    rootDirectory: root,
    token: 'test-token',
    uploader: async () => { throw new Error('upload failed'); },
  }), /upload failed/);
  assert.equal(await readFile(path.join(root, 'src/data/media.json'), 'utf8'), '{"sentinel":true}\n');
});
