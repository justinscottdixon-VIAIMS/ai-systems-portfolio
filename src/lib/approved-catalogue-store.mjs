import { get, put } from '@vercel/blob';
import { CATALOGUE_PATH, readApprovedRegistry } from './approved-catalogue.mjs';

export function createApprovedCatalogueStore({ token, pathname = CATALOGUE_PATH, reader = get, writer = put } = {}) {
  return {
    async read() {
      const result = await reader(pathname, { access: 'public', useCache: false, ...(token ? { token } : {}) });
      if (!result) return null;
      if (result.statusCode !== 200 || result.blob.size > 2_000_000) throw new TypeError('Invalid catalogue response');
      let length = 0;
      const chunks = [];
      for await (const chunk of result.stream) {
        length += chunk.byteLength;
        if (length > 2_000_000) throw new TypeError('Catalogue exceeds size limit');
        chunks.push(Buffer.from(chunk));
      }
      const registry = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      readApprovedRegistry(registry);
      return { registry, etag: result.blob.etag };
    },
    async write(registry, etag) {
      readApprovedRegistry(registry);
      return writer(pathname, JSON.stringify(registry), {
        access: 'public', addRandomSuffix: false, allowOverwrite: Boolean(etag),
        ...(etag ? { ifMatch: etag } : {}), ...(token ? { token } : {}),
        contentType: 'application/json', cacheControlMaxAge: 60,
      });
    },
  };
}
