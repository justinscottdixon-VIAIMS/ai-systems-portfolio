import { createHash } from 'node:crypto';
import path from 'node:path';
import { extractMusicVisualTag, parseMusicIdentity } from './music-title.mjs';
import { resolvePlaylistOrder } from './playlist-order.mjs';

export const BLOB_FOLDERS = Object.freeze([
  { prefix: 'Cinema/', folder: 'cinema', extensions: new Map([['.mp4', 'video'], ['.mov', 'video'], ['.webm', 'video']]) },
  { prefix: 'Music/', folder: 'music', extensions: new Map([['.wav', 'audio'], ['.mp3', 'audio'], ['.m4a', 'audio'], ['.flac', 'audio'], ['.aac', 'audio'], ['.mov', 'video'], ['.mp4', 'video']]) },
  { prefix: 'Media/', folder: 'media', extensions: new Map([['.mp4', 'video'], ['.mov', 'video'], ['.webm', 'video']]) },
  { prefix: 'Music-Visuals/', folder: 'music-visuals', extensions: new Map([['.mp4', 'video'], ['.mov', 'video'], ['.webm', 'video']]) },
]);

function directFilename(prefix, blob) {
  if (!blob || typeof blob !== 'object' || typeof blob.pathname !== 'string' || blob.pathname.length === 0) {
    throw new TypeError(`${prefix} returned a malformed Blob object`);
  }
  if (!blob.pathname.startsWith(prefix)) {
    throw new TypeError(`${prefix} returned an object outside the requested prefix: ${blob.pathname}`);
  }
  const filename = blob.pathname.slice(prefix.length);
  if (filename.length === 0) throw new TypeError(`${prefix} returned an invalid direct-child pathname`);
  return filename;
}

function normalizeDirectChildren(prefix, blobs) {
  const normalized = [];
  const pathnames = new Set();
  for (const blob of blobs) {
    const filename = directFilename(prefix, blob);
    if (filename.includes('/')) continue;
    if (filename.startsWith('.')) continue;
    if (pathnames.has(blob.pathname)) {
      throw new TypeError(`${prefix} returned a duplicate pathname: ${blob.pathname}`);
    }
    pathnames.add(blob.pathname);
    normalized.push(blob);
  }
  return normalized;
}

export async function listCompletePrefix({ prefix, listPage }) {
  const blobs = [];
  const cursors = new Set();
  let cursor;
  do {
    const page = await listPage({ prefix, cursor, limit: 1000 });
    if (!page || !Array.isArray(page.blobs) || typeof page.hasMore !== 'boolean') {
      throw new TypeError(`${prefix} returned a malformed Blob page`);
    }
    blobs.push(...page.blobs);
    if (!page.hasMore) break;
    if (typeof page.cursor !== 'string' || page.cursor.length === 0 || cursors.has(page.cursor)) {
      throw new TypeError(`${prefix} returned an invalid pagination cursor`);
    }
    cursors.add(page.cursor);
    cursor = page.cursor;
  } while (true);
  return normalizeDirectChildren(prefix, blobs);
}

function publicMetadata(prefix, blob) {
  if (typeof blob.etag !== 'string' || blob.etag.length === 0) {
    throw new TypeError(`${prefix} media requires a non-empty ETag`);
  }
  if (typeof blob.size !== 'number' || !Number.isFinite(blob.size) || blob.size <= 0) {
    throw new TypeError(`${prefix} media requires a positive size`);
  }
  let url;
  try {
    url = new URL(blob.url);
  } catch {
    throw new TypeError(`${prefix} media requires a valid HTTPS URL`);
  }
  if (url.protocol !== 'https:' || !url.hostname) {
    throw new TypeError(`${prefix} media requires a valid HTTPS URL`);
  }
  const uploadedAt = new Date(blob.uploadedAt);
  if (Number.isNaN(uploadedAt.getTime())) {
    throw new TypeError(`${prefix} media requires a valid upload time`);
  }
  return { url, uploadedAt };
}

function httpsUrl(prefix, value, subject) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new TypeError(`${prefix} ${subject} requires a valid HTTPS URL`);
  }
  if (url.protocol !== 'https:' || !url.hostname) {
    throw new TypeError(`${prefix} ${subject} requires a valid HTTPS URL`);
  }
  return url;
}

async function readPlaylistOrder({ config, blobs, readText }) {
  if (config.folder === 'music-visuals') return null;
  const sidecar = blobs.find((blob) => blob.pathname === `${config.prefix}playlist-order.json`);
  if (!sidecar) return null;
  const sidecarUrl = httpsUrl(config.prefix, sidecar.url, 'playlist order');
  let source;
  try {
    source = await readText(sidecarUrl.href);
  } catch (error) {
    throw new TypeError(`${config.prefix} playlist order could not be read: ${error.message}`);
  }
  try {
    return JSON.parse(source);
  } catch {
    throw new TypeError(`${config.prefix} playlist order contains invalid JSON`);
  }
}

function projectProvider({ config, blobs, orderEntries }) {
  const eligible = blobs.filter((blob) => {
    const filename = blob.pathname.slice(config.prefix.length);
    return config.extensions.has(path.posix.extname(filename).toLowerCase());
  });
  const filenames = eligible.map((blob) => blob.pathname.slice(config.prefix.length));
  const orderedFilenames = resolvePlaylistOrder({
    provider: config.prefix.slice(0, -1),
    filenames,
    orderEntries,
    supportedExtensions: config.extensions,
  });
  const byFilename = new Map(eligible.map((blob) => [blob.pathname.slice(config.prefix.length), blob]));
  return orderedFilenames.map((filename, playlistOrder) => {
    const blob = byFilename.get(filename);
    const { url, uploadedAt } = publicMetadata(config.prefix, blob);
    const extension = path.posix.extname(filename);
    const kind = config.extensions.get(extension.toLowerCase());
    const musicIdentity = config.folder === 'music' ? parseMusicIdentity(filename) : null;
    const visualTag = musicIdentity?.visualTag ?? (config.folder === 'music-visuals' ? extractMusicVisualTag(filename) : null);
    return Object.freeze({
      id: blob.pathname,
      versionId: blob.etag,
      pathname: blob.pathname,
      folder: config.folder,
      kind,
      title: config.folder === 'music'
        ? musicIdentity.title
        : path.posix.basename(filename, extension).replaceAll('_', ' ').trim(),
      src: url.href,
      size: blob.size,
      uploadedAt: uploadedAt.toISOString(),
      playlistOrder,
      ...(visualTag ? { visualTag } : {}),
    });
  });
}

export async function buildBlobFolderCatalogue({ listPage, readText }) {
  const items = [];
  for (const config of BLOB_FOLDERS) {
    const blobs = await listCompletePrefix({ prefix: config.prefix, listPage });
    const orderEntries = await readPlaylistOrder({ config, blobs, readText });
    items.push(...projectProvider({ config, blobs, orderEntries }));
  }
  const fingerprint = createHash('sha256')
    .update(JSON.stringify(items))
    .digest('hex');
  return Object.freeze({ authoritative: true, fingerprint, items: Object.freeze(items) });
}
