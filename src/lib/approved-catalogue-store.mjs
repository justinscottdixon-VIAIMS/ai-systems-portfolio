import { createHash } from 'node:crypto';
import { get, head, put, BlobNotFoundError } from '@vercel/blob';
import { CATALOGUE_PATH, MEDIA_ORIGIN, readApprovedRegistry } from './approved-catalogue.mjs';

export function createApprovedCatalogueStore({ token, pathname = CATALOGUE_PATH, reader = get, writer = put, metadata = head } = {}) {
  return {
    async read({ signal } = {}) {
      // The authenticated pointer metadata names the current immutable revision.
      // Public mutable bodies can remain cached; revision objects never change.
      let latest;
      try { latest = await metadata(pathname, { ...(token ? { token } : {}), abortSignal: signal }); }
      catch (error) { if (error instanceof BlobNotFoundError) return null; throw error; }
      const url = new URL(latest.url);
      if (url.origin !== MEDIA_ORIGIN || !latest.etag || latest.size > 2_000_000) throw new TypeError('Invalid catalogue metadata');
      const normalized = value => String(value).replace(/^W\//, '').replace(/^"(.*)"$/, '$1');
      const revision = `${pathname}.versions/${encodeURIComponent(normalized(latest.etag))}.json`;
      let result = await reader(`${MEDIA_ORIGIN}/${revision}`, { access: 'public', abortSignal: signal, ...(token ? { token } : {}) });
      if (!result) {
        // Compatibility for a registry written before immutable revisions.
        url.searchParams.set('download', '1');
        result = await reader(url.href, { access: 'public', headers: { 'Cache-Control': 'no-cache' }, abortSignal: signal, ...(token ? { token } : {}) });
      }
      if (!result) throw new TypeError('Catalogue metadata exists without content');
      if (normalized(result.blob.etag) !== normalized(latest.etag)) { await result.stream?.cancel().catch(() => {}); throw new TypeError('Catalogue version changed during read'); }
      if (result.statusCode !== 200 || result.blob.size > 2_000_000) { await result.stream?.cancel().catch(() => {}); throw new TypeError('Invalid catalogue response'); }
      let length = 0;
      const chunks = [];
      for await (const chunk of result.stream) {
        length += chunk.byteLength;
        if (length > 2_000_000) throw new TypeError('Catalogue exceeds size limit');
        chunks.push(Buffer.from(chunk));
      }
      const registry = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      readApprovedRegistry(registry);
      return { registry, etag: latest.etag };
    },
    async write(registry, etag, { signal } = {}) {
      readApprovedRegistry(registry);
      const body = JSON.stringify(registry);
      // Blob's authoritative ETag is the MD5 of these exact bytes, verified
      // against real writes. It is a version address, not a security checksum.
      const revisionId = createHash('md5').update(body).digest('hex');
      const revision = `${pathname}.versions/${revisionId}.json`;
      try { await writer(revision, body, {
        access: 'public', addRandomSuffix: false, allowOverwrite: false,
        ...(token ? { token } : {}), contentType: 'application/json', abortSignal: signal,
      }); } catch (error) {
        // The SDK reports an existing immutable key as a generic error.
        // Reuse it only after authenticated metadata proves identical bytes.
        let existing;
        try { existing = await metadata(revision, { ...(token ? { token } : {}), abortSignal: signal }); }
        catch { throw error; }
        const existingId = String(existing.etag).replace(/^W\//, '').replace(/^"(.*)"$/, '$1');
        if (existingId !== revisionId || existing.size !== Buffer.byteLength(body)) throw error;
      }
      signal?.throwIfAborted();
      return writer(pathname, body, {
        access: 'public', addRandomSuffix: false, allowOverwrite: Boolean(etag),
        ...(etag ? { ifMatch: etag } : {}), ...(token ? { token } : {}),
        contentType: 'application/json', cacheControlMaxAge: 60, abortSignal: signal,
      });
    },
  };
}
