import { musicPlaylistFields, groupMusicPlaylists } from './music-playlists.mjs';
import { createHash } from 'node:crypto';
import { createCatalogueRefreshState, refreshCatalogue } from './catalogue-refresh.mjs';

export const CATALOGUE_PATH = 'VIAIMS/approved-catalogue.json';
export const MEDIA_ORIGIN = 'https://5vqpsktuycwubnaj.public.blob.vercel-storage.com';
const FIELDS = ['id', 'versionId', 'pathname', 'folder', 'kind', 'title', 'src', 'size', 'uploadedAt', 'playlistOrder'];
const FOLDERS = ['cinema', 'music', 'media', 'music-visuals'];
const HASH = /^[a-f0-9]{64}$/;

export function approvedCatalogue(items, { origin = MEDIA_ORIGIN } = {}) {
  if (!Array.isArray(items) || items.length > 2000) throw new TypeError('Invalid approved catalogue');
  const projected = items.map(item => {
    if (!item || Object.keys(item).some(key => ![...FIELDS, 'visualTag', 'playlistId', 'playlistTitle', 'playlistPosition'].includes(key))) throw new TypeError('Unexpected catalogue field');
    const source = new URL(item.src);
    if (source.origin !== origin || source.username || source.password || source.search || source.hash
        || !HASH.test(item.versionId) || typeof item.title !== 'string' || item.title.length > 250
        || /[\x00-\x1f\x7f]/.test(item.title)
        || !Number.isSafeInteger(item.playlistOrder) || item.playlistOrder < 0) throw new TypeError('Invalid approved media');
    return { ...Object.fromEntries([...FIELDS, ...('visualTag' in item ? ['visualTag'] : [])].map(key => [key, item[key]])), ...musicPlaylistFields(item) };
  }).sort((a, b) => FOLDERS.indexOf(a.folder) - FOLDERS.indexOf(b.folder) || a.playlistOrder - b.playlistOrder || a.id.localeCompare(b.id));
  for (const folder of ['music','cinema']) groupMusicPlaylists(projected.filter(item => item.folder === folder));
  const envelope = { authoritative: true, fingerprint: createHash('sha256').update(JSON.stringify(projected)).digest('hex'), items: projected };
  if (refreshCatalogue(createCatalogueRefreshState(), envelope).status !== 'accepted') throw new TypeError('Invalid approved catalogue');
  return envelope;
}

export function readApprovedRegistry(registry, options) {
  if (!registry || registry.version !== 1 || registry.initialized !== true
      || Object.keys(registry).some(key => !['version', 'initialized', 'items'].includes(key))) throw new TypeError('Catalogue is not initialized');
  return approvedCatalogue(registry.items, options);
}

export function registryDocument(items, options) {
  return { version: 1, initialized: true, items: approvedCatalogue(items, options).items };
}

export function appendApprovedItem(registry, item, options) {
  const prior = readApprovedRegistry(registry, options).items;
  const same = prior.find(row => row.folder === item.folder && row.versionId === item.versionId);
  if (same) return { registry: registryDocument(prior, options), item: same, status: 'duplicate' };
  if (prior.some(row => row.id === item.id || (row.folder === item.folder && row.title.normalize('NFKC').toLowerCase() === item.title.normalize('NFKC').toLowerCase()))) {
    const error = new Error('A published title already exists'); error.code = 'TITLE_CONFLICT'; throw error;
  }
  const order = prior.filter(row => row.folder === item.folder).reduce((max, row) => Math.max(max, row.playlistOrder), -1) + 1;
  const next = { ...item, playlistOrder: order };
  return { registry: registryDocument([...prior, next], options), item: next, status: 'published' };
}
