import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { BlobPreconditionFailedError } from '@vercel/blob';
import { syncMedia, uploadOptions } from '../scripts/sync-media.mjs';

const missingBlob = async () => null;

function sync(options) {
  return syncMedia({ resolver: missingBlob, ...options });
}

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
  const manifest = await sync({
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
  await assert.rejects(() => sync({
    rootDirectory: root,
    token: 'test-token',
    uploader: async () => { throw new Error('upload failed'); },
  }), /upload failed/);
  assert.equal(await readFile(path.join(root, 'src/data/media.json'), 'utf8'), '{"sentinel":true}\n');
});

test('syncMedia reuses a published URL for unchanged content on a repeat sync', async () => {
  const root = await fixture();
  const first = await sync({
    rootDirectory: root,
    token: 'test-token',
    generatedAt: '2026-08-29T17:00:00.000Z',
    uploader: async (pathname) => ({ url: `https://example.public.blob.vercel-storage.com/${pathname}` }),
  });

  const second = await sync({
    rootDirectory: root,
    token: 'test-token',
    generatedAt: '2026-08-30T17:00:00.000Z',
    uploader: async () => { throw new Error('unchanged content must not upload'); },
  });

  assert.equal(second.items[0].src, first.items[0].src);
  assert.equal(second.items[0].id, first.items[0].id);
});

test('syncMedia rejects normalized manifest-ID collisions before starting an upload', async () => {
  const root = await fixture();
  await writeFile(path.join(root, 'public/media/video', 'Atlas_.MP4'), 'different bytes');
  let uploads = 0;

  await assert.rejects(() => sync({
    rootDirectory: root,
    token: 'test-token',
    uploader: async () => {
      uploads += 1;
      return { url: 'https://example.public.blob.vercel-storage.com/unreachable' };
    },
  }), /duplicate media id/);

  assert.equal(uploads, 0);
});

test('syncMedia keeps the complete previous release live when a later upload fails', async () => {
  const root = await fixture();
  await writeFile(path.join(root, 'public/media/video', 'Atlas.MP4'), 'first-new');
  await writeFile(path.join(root, 'public/media/video', 'Second.MP4'), 'second-new');
  const oldManifest = {
    version: 1,
    generatedAt: '2026-08-28T17:00:00.000Z',
    items: [
      { id: 'video-atlas', kind: 'video', title: 'Atlas', src: 'https://example.public.blob.vercel-storage.com/portfolio/video/old-atlas.mp4', specs: 'MP4 Master', engine: 'AI Render' },
      { id: 'video-second', kind: 'video', title: 'Second', src: 'https://example.public.blob.vercel-storage.com/portfolio/video/old-second.mp4', specs: 'MP4 Master', engine: 'AI Render' },
    ],
  };
  const oldManifestBytes = `${JSON.stringify(oldManifest, null, 2)}\n`;
  await writeFile(path.join(root, 'src/data/media.json'), oldManifestBytes);
  let uploads = 0;

  await assert.rejects(() => sync({
    rootDirectory: root,
    token: 'test-token',
    uploader: async (pathname) => {
      uploads += 1;
      if (uploads === 2) throw new Error('second upload failed');
      return { url: `https://example.public.blob.vercel-storage.com/${pathname}` };
    },
  }), /second upload failed/);

  const writtenBytes = await readFile(path.join(root, 'src/data/media.json'), 'utf8');
  assert.equal(uploads, 2);
  assert.equal(writtenBytes, oldManifestBytes);
  assert.deepEqual(JSON.parse(writtenBytes).items.map((item) => item.src), oldManifest.items.map((item) => item.src));
});

test('syncMedia destroys a retained ReadStream after uploader rejection', async () => {
  const root = await fixture();
  let stream;

  await assert.rejects(() => sync({
    rootDirectory: root,
    token: 'test-token',
    uploader: async (_pathname, body) => {
      stream = body;
      throw new Error('uploader rejected');
    },
  }), /uploader rejected/);

  assert.equal(stream.destroyed, true);
});

test('syncMedia reuses an orphan release then uploads only the still-missing file on retry', async () => {
  const root = await fixture();
  await writeFile(path.join(root, 'public/media/video', 'Atlas.MP4'), 'first-new');
  await writeFile(path.join(root, 'public/media/video', 'Second.MP4'), 'second-new');
  const oldManifest = {
    version: 1,
    generatedAt: '2026-08-28T17:00:00.000Z',
    items: [
      { id: 'video-atlas', kind: 'video', title: 'Atlas', src: 'https://example.public.blob.vercel-storage.com/portfolio/video/old-atlas.mp4', specs: 'MP4 Master', engine: 'AI Render' },
      { id: 'video-second', kind: 'video', title: 'Second', src: 'https://example.public.blob.vercel-storage.com/portfolio/video/old-second.mp4', specs: 'MP4 Master', engine: 'AI Render' },
    ],
  };
  const oldManifestBytes = `${JSON.stringify(oldManifest, null, 2)}\n`;
  await writeFile(path.join(root, 'src/data/media.json'), oldManifestBytes);
  const published = new Map();
  const uploads = [];
  let failSecondUpload = true;
  const resolver = async (pathname) => published.get(pathname) ?? null;
  const uploader = async (pathname) => {
    uploads.push(pathname);
    if (failSecondUpload && uploads.length === 2) throw new Error('second upload failed');
    const blob = { url: `https://example.public.blob.vercel-storage.com/${pathname}` };
    published.set(pathname, blob);
    return blob;
  };

  await assert.rejects(() => sync({ rootDirectory: root, token: 'test-token', resolver, uploader }), /second upload failed/);
  assert.equal(await readFile(path.join(root, 'src/data/media.json'), 'utf8'), oldManifestBytes);

  failSecondUpload = false;
  const manifest = await sync({ rootDirectory: root, token: 'test-token', resolver, uploader });
  assert.equal(uploads.length, 3);
  assert.deepEqual(
    manifest.items.map((item) => item.src).sort(),
    [...published.values()].map((blob) => blob.url).sort(),
  );
});

test('syncMedia resolves and reuses an immutable key after a put conflict race', async () => {
  const root = await fixture();
  let resolverCalls = 0;
  let stream;
  const blob = { url: 'https://example.public.blob.vercel-storage.com/portfolio/video/race.mp4' };

  const manifest = await sync({
    rootDirectory: root,
    token: 'test-token',
    resolver: async () => {
      resolverCalls += 1;
      return resolverCalls === 1 ? null : blob;
    },
    uploader: async (_pathname, body) => {
      stream = body;
      throw new BlobPreconditionFailedError();
    },
  });

  assert.equal(resolverCalls, 2);
  assert.equal(manifest.items[0].src, blob.url);
  assert.equal(stream.destroyed, true);
});

test('uploadOptions uses multipart only above 100 MiB and never overwrites releases', () => {
  const base = { contentType: 'video/mp4', size: 100 * 1024 * 1024 };
  assert.deepEqual(uploadOptions(base, 'test-token'), {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: false,
    multipart: false,
    contentType: 'video/mp4',
    token: 'test-token',
  });
  assert.equal(uploadOptions({ ...base, size: base.size + 1 }, 'test-token').multipart, true);
});
