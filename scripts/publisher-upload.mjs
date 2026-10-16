import { createReadStream } from 'node:fs';
import { head, put, BlobNotFoundError, BlobPreconditionFailedError } from '@vercel/blob';
import { appendApprovedItem, MEDIA_ORIGIN, readApprovedRegistry } from '../src/lib/approved-catalogue.mjs';
import { safeObjectName } from './media-catalog.mjs';
import { AuditHold } from './publisher-audit.mjs';

export async function publishAuditedFile({ file, audit, provider, size, store, token, uploader = put, resolver = head, objectPrefix = '', signal, expectedItemId }) {
  signal?.throwIfAborted();
  const snapshot = await store.read({ signal });
  if (!snapshot) throw new Error('Approved catalogue must be initialized before publishing');
  const prior = readApprovedRegistry(snapshot.registry).items;
  const folder = provider.toLowerCase();
  if (expectedItemId) {
    const expected = prior.find(item => item.id === expectedItemId && item.folder === folder);
    if (!expected || expected.versionId !== audit.contentHash) throw new AuditHold('REPLACEMENT_REVIEW', 'This track folder already represents a different published recording. Review a replacement before publishing.');
  }
  const duplicate = prior.find(item => item.folder === folder && item.versionId === audit.contentHash);
  if (duplicate) return { status: 'duplicate', item: duplicate };
  if (prior.some(item => item.folder === folder && item.title.normalize('NFKC').toLowerCase() === audit.title.normalize('NFKC').toLowerCase())) throw new AuditHold('TITLE_CONFLICT', 'This title already has a different published recording.');
  const pathname = `${objectPrefix}${provider}/${audit.contentHash}-${safeObjectName(file.filename)}`;
  signal?.throwIfAborted();
  let uploaded;
  try { uploaded = await resolver(pathname, { token, abortSignal: signal }); } catch (error) { if (!(error instanceof BlobNotFoundError)) throw error; }
  if (!uploaded) {
    signal?.throwIfAborted();
    const stream = createReadStream(file.snapshot);
    try {
      uploaded = await uploader(pathname, stream, {
        token, access: 'public', addRandomSuffix: false, allowOverwrite: false, abortSignal: signal,
        multipart: size > 100 * 1024 * 1024, contentType: audit.kind === 'audio'
          ? ({ '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.flac': 'audio/flac' }[file.extension])
          : ({ '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm' }[file.extension]),
      });
    } catch (error) {
      if (!(error instanceof BlobPreconditionFailedError)) throw error;
      uploaded = await resolver(pathname, { token, abortSignal: signal });
    } finally { stream.destroy(); }
  }
  if (uploaded.size !== undefined && uploaded.size !== size) throw new Error('Immutable upload size mismatch');
  if (new URL(uploaded.url).origin !== MEDIA_ORIGIN) throw new Error('Unexpected upload store');
  const item = {
    id: pathname, pathname, versionId: audit.contentHash, folder, kind: audit.kind, title: audit.title,
    src: uploaded.url, size, uploadedAt: new Date(uploaded.uploadedAt ?? Date.now()).toISOString(), playlistOrder: 0,
  };
  for (let attempt = 0; attempt < 4; attempt++) {
    signal?.throwIfAborted();
    const latest = await store.read({ signal });
    if (!latest) throw new Error('Approved catalogue disappeared');
    let result;
    try { result = appendApprovedItem(latest.registry, item); } catch (error) {
      if (error.code === 'TITLE_CONFLICT') throw new AuditHold(error.code, 'This title already has a different published recording.');
      throw error;
    }
    if (result.status === 'duplicate') return result;
    try { signal?.throwIfAborted(); await store.write(result.registry, latest.etag, { signal }); return result; } catch (error) {
      if (!(error instanceof BlobPreconditionFailedError) || attempt === 3) throw error;
    }
  }
}
