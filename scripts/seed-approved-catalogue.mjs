import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { head } from '@vercel/blob';
import { toMediaLibrary } from '../src/lib/media-library.mjs';
import { MEDIA_ORIGIN, registryDocument } from '../src/lib/approved-catalogue.mjs';
import { createApprovedCatalogueStore } from '../src/lib/approved-catalogue-store.mjs';
import { loadPublisherToken } from './local-media-publisher.mjs';

export async function buildSeedRegistry({ manifest, curated, resolver = head, token }) {
  const library = toMediaLibrary(manifest, curated);
  const items = [];
  for (const folder of ['cinema', 'music', 'media']) {
    for (const [index, row] of library[folder].entries()) {
      const src = row.src ?? row.audioSrc;
      const url = new URL(src);
      const hash = url.pathname.match(/(?:^|\/)([a-f0-9]{64})-/)?.[1];
      if (url.origin !== MEDIA_ORIGIN || !hash) throw new Error('Existing media must use a verified immutable URL in the current store');
      const blob = await resolver(src, { token });
      if (blob.url !== src || blob.size <= 0) throw new Error('Existing media could not be verified');
      const prefix = folder[0].toUpperCase() + folder.slice(1);
      const pathname = `${prefix}/${path.posix.basename(url.pathname)}`;
      items.push({ id: pathname, pathname, versionId: hash, folder, kind: folder === 'music' ? 'audio' : 'video', title: row.title, src,
        size: blob.size, uploadedAt: new Date(blob.uploadedAt).toISOString(), playlistOrder: index });
      if (folder === 'music' && row.videoSrc) throw new Error('Paired Music video requires explicit migration review');
    }
  }
  return registryDocument(items);
}

async function main() {
  const { values } = parseArgs({ options: { 'env-file': { type: 'string' }, write: { type: 'boolean', default: false }, output: { type: 'string' } } });
  const token = await loadPublisherToken(values['env-file']);
  const store = createApprovedCatalogueStore({ token });
  const current = await store.read();
  const registry = await buildSeedRegistry({
    manifest: JSON.parse(await fs.readFile(new URL('../src/data/media.json', import.meta.url), 'utf8')),
    curated: JSON.parse(await fs.readFile(new URL('../src/data/curated-media.json', import.meta.url), 'utf8')), token,
  });
  if (current) {
    if (!registry.items.every(row => current.registry.items.some(existing => existing.src === row.src && existing.title === row.title && existing.folder === row.folder))) throw new Error('Existing registry differs from the approved release');
    console.log(`Catalogue already includes all ${registry.items.length} approved releases. No writes.`); return;
  }
  if (values.output) await fs.writeFile(values.output, JSON.stringify(registry, null, 2));
  if (values.write) await store.write(registry);
  console.log(`${values.write ? 'Registered' : 'Verified without writing'} ${registry.items.length} existing releases; no media bytes uploaded.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(() => { console.error('Catalogue seed failed; existing releases were not changed.'); process.exitCode = 1; });
