const FINGERPRINT = /^[a-f0-9]{64}$/;
const BOOTSTRAP_ITEM_FIELDS = Object.freeze(['id', 'versionId', 'folder', 'kind', 'title', 'src']);
const BLOB_ITEM_FIELDS = Object.freeze([
  'id',
  'versionId',
  'pathname',
  'folder',
  'kind',
  'title',
  'src',
  'size',
  'uploadedAt',
  'playlistOrder',
]);
const BLOB_KINDS = new Map([
  ['cinema', new Set(['video'])],
  ['music', new Set(['audio', 'video'])],
  ['media', new Set(['video'])],
  ['music-visuals', new Set(['video'])],
]);
const BLOB_PREFIXES = new Map([
  ['cinema', 'Cinema/'],
  ['music', 'Music/'],
  ['media', 'Media/'],
  ['music-visuals', 'Music-Visuals/'],
]);
const text = (value) => typeof value === 'string' && value.length > 0 && value === value.trim();

function publicHttpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}

function projectBootstrapItems(rows) {
  if (!Array.isArray(rows)) return null;
  const ids = new Set();
  const items = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row)
        || !BOOTSTRAP_ITEM_FIELDS.every((key) => text(row[key]))
        || !BLOB_KINDS.get(row.folder)?.has(row.kind)
        || !publicHttpsUrl(row.src)
        || ids.has(row.id)) return null;
    // Bootstrap records already have native metadata; keep their existing
    // immutable-URL boundary and derive aspect instead of trusting input.
    const url = new URL(row.src);
    if (url.search || url.hash) return null;
    const item = Object.fromEntries(BOOTSTRAP_ITEM_FIELDS.map((key) => [key, row[key]]));
    if (row.kind === 'video') {
      if (!Number.isSafeInteger(row.width) || row.width <= 0
          || !Number.isSafeInteger(row.height) || row.height <= 0) return null;
      item.width = row.width;
      item.height = row.height;
      item.aspect = row.height > row.width ? 'portrait'
        : row.height < row.width ? 'landscape' : 'square';
    }
    ids.add(item.id);
    items.push(Object.freeze(item));
  }
  return Object.freeze(items);
}

// Endpoint records are public candidates, but the browser still projects an
// exact allowlist before native metadata decides whether they can be played.
function projectEndpointItems(rows) {
  if (!Array.isArray(rows)) return null;
  const ids = new Set();
  const items = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row)
        || !BLOB_ITEM_FIELDS.slice(0, 7).every((key) => text(row[key]))
        || row.id !== row.pathname
        || !BLOB_KINDS.get(row.folder)?.has(row.kind)
        || !row.pathname.startsWith(BLOB_PREFIXES.get(row.folder) ?? '')
        || !publicHttpsUrl(row.src)
        || !Number.isSafeInteger(row.size) || row.size <= 0
        || !Number.isSafeInteger(row.playlistOrder) || row.playlistOrder < 0
        || typeof row.uploadedAt !== 'string'
        || Number.isNaN(Date.parse(row.uploadedAt))
        || ids.has(row.id)
        || ('visualTag' in row && !text(row.visualTag))) return null;
    ids.add(row.id);
    const item = Object.fromEntries(BLOB_ITEM_FIELDS.map((key) => [key, row[key]]));
    if ('visualTag' in row) item.visualTag = row.visualTag;
    items.push(Object.freeze(item));
  }
  return Object.freeze(items);
}

export function createCatalogueRefreshState(bootstrapItems = []) {
  const items = projectBootstrapItems(bootstrapItems);
  if (!items) throw new TypeError('Bootstrap must contain valid public catalogue items');
  return Object.freeze({ authoritative: false, fingerprint: null, items });
}

// null represents transport/HTTP/parse failure; callers retain the returned state.
export function refreshCatalogue(state, response) {
  const retain = (status) => ({ state, status });
  if (response === null) return retain('error');
  if (!response || response.authoritative !== true
      || typeof response.fingerprint !== 'string'
      || !FINGERPRINT.test(response.fingerprint)) return retain('invalid');
  const items = projectEndpointItems(response.items);
  if (!items) return retain('invalid');
  if (state.authoritative && response.fingerprint === state.fingerprint) {
    return retain(JSON.stringify(items) === JSON.stringify(state.items) ? 'unchanged' : 'fingerprint-conflict');
  }
  return {
    state: Object.freeze({ authoritative: true, fingerprint: response.fingerprint, items }),
    status: 'accepted',
  };
}

// Uses caller-supplied monotonic milliseconds. No clocks, timers, or requests.
export function catalogueRefreshDecision({ now, lastStartedAt = null, visible, inFlight, focusRegained = false }) {
  if (!Number.isFinite(now) || now < 0
      || (lastStartedAt !== null && (!Number.isFinite(lastStartedAt) || lastStartedAt < 0 || lastStartedAt > now))) {
    throw new TypeError('Refresh timestamps must be ordered nonnegative monotonic milliseconds');
  }
  if (!visible || inFlight) return { shouldRequest: false, delayMs: null };
  const delayMs = focusRegained || lastStartedAt === null ? 0 : Math.max(0, 15_000 - (now - lastStartedAt));
  return { shouldRequest: delayMs === 0, delayMs };
}

// Accepts projected snapshots and active { id, versionId }. Reports intent only;
// playback ownership, currentTime and controller actions remain caller-owned.
export function reconcileActiveCatalogueItem(previousItems, nextItems, active) {
  if (!active) return { action: 'none', itemId: null };
  const previous = previousItems.find((item) => item.id === active.id);
  const next = nextItems.find((item) => item.id === active.id);
  const report = (action) => ({ action, itemId: active.id });
  if (!next) return report('unpublished');
  const playbackFields = ['versionId', 'src', 'folder', 'kind', 'width', 'height', 'aspect'];
  if (!previous || active.versionId !== next.versionId
      || playbackFields.some((key) => previous[key] !== next[key])) return report('replaced');
  return report('preserve');
}
