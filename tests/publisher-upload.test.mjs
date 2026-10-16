import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { BlobPreconditionFailedError, BlobNotFoundError } from '@vercel/blob';
import { publishAuditedFile } from '../scripts/publisher-upload.mjs';
import { registryDocument, MEDIA_ORIGIN } from '../src/lib/approved-catalogue.mjs';

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'viaims-upload-test-')); t.after(() => fs.rm(root, { recursive: true, force: true }));
  const snapshot = path.join(root, 'snapshot'); await fs.writeFile(snapshot, 'bytes');
  return { file: { filename: 'Finished.mp4', extension: '.mp4', snapshot }, audit: { title: 'Finished', kind: 'video', contentHash: 'a'.repeat(64) }, provider: 'Media', size: 5, token: 'test-token' };
}
test('upload failure never commits a public entry', async t => {
  const input = await fixture(t); let writes = 0;
  await assert.rejects(publishAuditedFile({ ...input, store: { read: async () => ({ registry: registryDocument([]), etag: 'v1' }), write: async () => { writes++; } }, resolver: async () => { throw new BlobNotFoundError(); }, uploader: async () => { throw new Error('offline'); } }));
  assert.equal(writes, 0);
});
test('conditional registry conflict retries with latest entries and does not upload twice', async t => {
  const input = await fixture(t); let writes = 0, uploads = 0;
  let registry = registryDocument([]);
  const result = await publishAuditedFile({ ...input,
    resolver: async () => { throw new BlobNotFoundError(); },
    uploader: async (name, stream, options) => { for await (const _ of stream) {} uploads++; assert.equal(options.allowOverwrite, false); return { url: `${MEDIA_ORIGIN}/${name}` }; },
    store: { read: async () => ({ registry, etag: String(writes) }), write: async next => { writes++; if (writes === 1) throw new BlobPreconditionFailedError(); registry = next; } },
  });
  assert.equal(result.status, 'published'); assert.equal(uploads, 1); assert.equal(writes, 2); assert.equal(registry.items.length, 1);
  const duplicate = await publishAuditedFile({ ...input, store: { read: async () => ({ registry, etag: 'v2' }) }, uploader: () => { throw new Error('duplicate must not upload'); } });
  assert.equal(duplicate.status, 'duplicate');
});
