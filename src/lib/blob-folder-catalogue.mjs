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

const ISO_TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;
const DIAGNOSTIC_REASONS = Object.freeze({
  CATALOGUE_UNAVAILABLE: 'unexpected catalogue failure',
  BLOB_LIST_FAILED: 'Blob listing failed',
  BLOB_PAGE_INVALID: 'returned a malformed Blob page',
  BLOB_CURSOR_INVALID: 'returned an invalid pagination cursor',
  BLOB_OBJECT_INVALID: 'returned a malformed Blob object',
  BLOB_PATH_OUTSIDE_PREFIX: 'returned an object outside the requested prefix',
  BLOB_PATH_INVALID: 'returned an invalid direct-child pathname',
  BLOB_PATH_DUPLICATE: 'returned a duplicate pathname',
  BLOB_ETAG_INVALID: 'media requires a non-empty ETag',
  BLOB_SIZE_INVALID: 'media requires a positive safe integer size',
  BLOB_UPLOAD_TIME_INVALID: 'media requires a valid upload time',
  BLOB_MEDIA_URL_INVALID: 'media requires a valid HTTPS URL',
  BLOB_IDENTITY_INVALID: 'media filename contains invalid identity metadata',
  PLAYLIST_ORDER_URL_INVALID: 'playlist order requires a valid HTTPS URL',
  PLAYLIST_ORDER_READ_FAILED: 'playlist order could not be read',
  PLAYLIST_ORDER_JSON_INVALID: 'playlist order contains invalid JSON',
  PLAYLIST_ORDER_TYPE_INVALID: 'playlist order must be an array',
  PLAYLIST_ORDER_INVALID: 'playlist order contains invalid entries',
  BLOB_NESTED_OMITTED: 'nested files are not eligible',
  BLOB_HIDDEN_OMITTED: 'hidden files are not eligible',
  BLOB_EXTENSION_OMITTED: 'file extension is not supported',
});
const failureDiagnostics = new WeakMap();

function diagnostic(code, prefix, pathname) {
  const config = BLOB_FOLDERS.find((folder) => folder.prefix === prefix);
  // Omit ambiguous paths entirely: URLs, credentials, query strings, control
  // characters and encoded text are never useful as trusted log context.
  const safePath = config && typeof pathname === 'string' && pathname.startsWith(prefix)
    && pathname.length <= 512 && /^[\p{L}\p{N} ._()/-]+$/u.test(pathname)
    && !pathname.split('/').some((segment) => segment === '.' || segment === '..');
  return Object.freeze({
    code,
    ...(config ? { provider: config.folder, prefix: config.prefix } : {}),
    ...(safePath ? { pathname } : {}),
    reason: DIAGNOSTIC_REASONS[code],
  });
}

function catalogueError(code, prefix, pathname) {
  const details = diagnostic(code, prefix, pathname);
  const error = new TypeError(`${details.prefix ?? ''} ${details.reason}${details.pathname ? `: ${details.pathname}` : ''}`.trim());
  failureDiagnostics.set(error, details);
  return error;
}

export function catalogueFailureDiagnostic(error) {
  // Only errors created here carry context. Never inspect an upstream error's
  // message, code, URL, headers or even a purported diagnostic property.
  return failureDiagnostics.get(error) ?? diagnostic('CATALOGUE_UNAVAILABLE');
}

function validIsoTimestamp(value) {
  if (typeof value !== 'string' || value.length === 0 || value !== value.trim()) return false;
  const match = value.match(ISO_TIMESTAMP);
  if (!match) return false;
  const [year, month, day, hour, minute, second] = match.slice(1).map(Number);
  const daysInMonth = [31, (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth[month - 1] || hour > 23 || minute > 59 || second > 59) return false;
  return !Number.isNaN(new Date(value).getTime());
}

function directFilename(prefix, blob) {
  if (!blob || typeof blob !== 'object' || typeof blob.pathname !== 'string' || blob.pathname.length === 0) {
    throw catalogueError('BLOB_OBJECT_INVALID', prefix);
  }
  if (!blob.pathname.startsWith(prefix)) {
    throw catalogueError('BLOB_PATH_OUTSIDE_PREFIX', prefix);
  }
  const filename = blob.pathname.slice(prefix.length);
  if (filename.length === 0) throw catalogueError('BLOB_PATH_INVALID', prefix);
  return filename;
}

function normalizeDirectChildren(prefix, blobs, onDiagnostic) {
  const normalized = [];
  const pathnames = new Set();
  for (const blob of blobs) {
    const filename = directFilename(prefix, blob);
    if (filename.includes('/')) {
      onDiagnostic(diagnostic('BLOB_NESTED_OMITTED', prefix, blob.pathname));
      continue;
    }
    if (filename.startsWith('.')) {
      onDiagnostic(diagnostic('BLOB_HIDDEN_OMITTED', prefix, blob.pathname));
      continue;
    }
    if (pathnames.has(blob.pathname)) {
      throw catalogueError('BLOB_PATH_DUPLICATE', prefix, blob.pathname);
    }
    pathnames.add(blob.pathname);
    normalized.push(blob);
  }
  return normalized;
}

export async function listCompletePrefix({ prefix, listPage, onDiagnostic = () => {} }) {
  const blobs = [];
  const cursors = new Set();
  let cursor;
  do {
    let page;
    try {
      page = await listPage({ prefix, cursor, limit: 1000 });
    } catch {
      throw catalogueError('BLOB_LIST_FAILED', prefix);
    }
    if (!page || !Array.isArray(page.blobs) || typeof page.hasMore !== 'boolean') {
      throw catalogueError('BLOB_PAGE_INVALID', prefix);
    }
    blobs.push(...page.blobs);
    if (!page.hasMore) break;
    if (typeof page.cursor !== 'string' || page.cursor.length === 0 || cursors.has(page.cursor)) {
      throw catalogueError('BLOB_CURSOR_INVALID', prefix);
    }
    cursors.add(page.cursor);
    cursor = page.cursor;
  } while (true);
  return normalizeDirectChildren(prefix, blobs, onDiagnostic);
}

function publicMetadata(prefix, blob) {
  if (typeof blob.etag !== 'string' || blob.etag.length === 0) {
    throw catalogueError('BLOB_ETAG_INVALID', prefix, blob.pathname);
  }
  if (!Number.isSafeInteger(blob.size) || blob.size <= 0) {
    throw catalogueError('BLOB_SIZE_INVALID', prefix, blob.pathname);
  }
  const url = httpsUrl(prefix, blob.url, 'BLOB_MEDIA_URL_INVALID', blob.pathname);
  const hasIsoTimestamp = validIsoTimestamp(blob.uploadedAt);
  if (!(blob.uploadedAt instanceof Date) && !hasIsoTimestamp) {
    throw catalogueError('BLOB_UPLOAD_TIME_INVALID', prefix, blob.pathname);
  }
  const uploadedAt = new Date(blob.uploadedAt);
  if (Number.isNaN(uploadedAt.getTime())) throw catalogueError('BLOB_UPLOAD_TIME_INVALID', prefix, blob.pathname);
  return { url, uploadedAt };
}

function httpsUrl(prefix, value, errorCode, pathname) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw catalogueError(errorCode, prefix, pathname);
  }
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) {
    throw catalogueError(errorCode, prefix, pathname);
  }
  return url;
}

async function readPlaylistOrder({ config, blobs, readText }) {
  if (config.folder === 'music-visuals') return null;
  const sidecar = blobs.find((blob) => blob.pathname === `${config.prefix}playlist-order.json`);
  if (!sidecar) return null;
  const sidecarUrl = httpsUrl(config.prefix, sidecar.url, 'PLAYLIST_ORDER_URL_INVALID', sidecar.pathname);
  let source;
  try {
    source = await readText(sidecarUrl.href);
  } catch {
    throw catalogueError('PLAYLIST_ORDER_READ_FAILED', config.prefix, sidecar.pathname);
  }
  let entries;
  try {
    entries = JSON.parse(source);
  } catch {
    throw catalogueError('PLAYLIST_ORDER_JSON_INVALID', config.prefix, sidecar.pathname);
  }
  if (!Array.isArray(entries)) throw catalogueError('PLAYLIST_ORDER_TYPE_INVALID', config.prefix, sidecar.pathname);
  return entries;
}

function projectProvider({ config, blobs, orderEntries, onDiagnostic }) {
  const eligible = blobs.filter((blob) => {
    const filename = blob.pathname.slice(config.prefix.length);
    const supported = config.extensions.has(path.posix.extname(filename).toLowerCase());
    if (!supported && filename !== 'playlist-order.json') {
      onDiagnostic(diagnostic('BLOB_EXTENSION_OMITTED', config.prefix, blob.pathname));
    }
    return supported;
  });
  const filenames = eligible.map((blob) => blob.pathname.slice(config.prefix.length));
  let orderedFilenames;
  try {
    orderedFilenames = resolvePlaylistOrder({
      provider: config.prefix.slice(0, -1),
      filenames,
      orderEntries,
      supportedExtensions: config.extensions,
    });
  } catch {
    throw catalogueError('PLAYLIST_ORDER_INVALID', config.prefix, `${config.prefix}playlist-order.json`);
  }
  const byFilename = new Map(eligible.map((blob) => [blob.pathname.slice(config.prefix.length), blob]));
  return orderedFilenames.map((filename, playlistOrder) => {
    const blob = byFilename.get(filename);
    const { url, uploadedAt } = publicMetadata(config.prefix, blob);
    const extension = path.posix.extname(filename);
    const kind = config.extensions.get(extension.toLowerCase());
    let musicIdentity;
    let visualTag;
    try {
      musicIdentity = config.folder === 'music' ? parseMusicIdentity(filename) : null;
      visualTag = musicIdentity?.visualTag ?? (config.folder === 'music-visuals' ? extractMusicVisualTag(filename) : null);
    } catch {
      throw catalogueError('BLOB_IDENTITY_INVALID', config.prefix, blob.pathname);
    }
    return Object.freeze({
      id: blob.pathname,
      versionId: blob.etag,
      pathname: blob.pathname,
      folder: config.folder,
      kind,
      title: config.folder === 'music'
        ? musicIdentity.title
        : path.posix.basename(filename, extension).replaceAll('_', ' ').trim() || filename.trim(),
      src: url.href,
      size: blob.size,
      uploadedAt: uploadedAt.toISOString(),
      playlistOrder,
      ...(visualTag ? { visualTag } : {}),
    });
  });
}

export async function buildBlobFolderCatalogue({ listPage, readText, onDiagnostic = () => {} }) {
  const items = [];
  for (const config of BLOB_FOLDERS) {
    try {
      const blobs = await listCompletePrefix({ prefix: config.prefix, listPage, onDiagnostic });
      const orderEntries = await readPlaylistOrder({ config, blobs, readText });
      items.push(...projectProvider({ config, blobs, orderEntries, onDiagnostic }));
    } catch (error) {
      if (failureDiagnostics.has(error)) throw error;
      throw catalogueError('CATALOGUE_UNAVAILABLE', config.prefix);
    }
  }
  const fingerprint = createHash('sha256')
    .update(JSON.stringify(items))
    .digest('hex');
  return Object.freeze({ authoritative: true, fingerprint, items: Object.freeze(items) });
}
