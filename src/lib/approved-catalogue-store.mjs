import { get, head, put, BlobNotFoundError } from '@vercel/blob';
import { CATALOGUE_PATH, MEDIA_ORIGIN, readApprovedRegistry } from './approved-catalogue.mjs';

export function createApprovedCatalogueStore({ token, pathname = CATALOGUE_PATH, reader = get, writer = put, metadata = head } = {}) {
  return {
    async read({ signal } = {}) {
      // Public Blob get() ignores useCache:false in the current SDK. Read the
      // latest metadata through its authenticated API and reject a CDN body whose
      // ETag differs. Public overwrites can take up to 60 seconds to propagate;
      // callers retry rather than accepting a stale catalogue.
      let latest;
      try { latest = await metadata(pathname, { ...(token ? { token } : {}), abortSignal: signal }); }
      catch (error) { if (error instanceof BlobNotFoundError) return null; throw error; }
      const url = new URL(latest.url);
      if (url.origin !== MEDIA_ORIGIN || !latest.etag || latest.size > 2_000_000) throw new TypeError('Invalid catalogue metadata');
      url.searchParams.set('viaimsVersion', latest.etag);
      const result = await reader(url.href, { access: 'public', headers: { 'Cache-Control': 'no-cache' }, abortSignal: signal, ...(token ? { token } : {}) });
      if (!result) throw new TypeError('Catalogue metadata exists without content');
      const normalized = value => String(value).replace(/^W\//, '').replace(/^"(.*)"$/, '$1');
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
      return writer(pathname, JSON.stringify(registry), {
        access: 'public', addRandomSuffix: false, allowOverwrite: Boolean(etag),
        ...(etag ? { ifMatch: etag } : {}), ...(token ? { token } : {}),
        contentType: 'application/json', cacheControlMaxAge: 60, abortSignal: signal,
      });
    },
  };
}
