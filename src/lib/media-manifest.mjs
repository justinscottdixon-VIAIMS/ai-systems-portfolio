const HTTPS = 'https:';
const KINDS = new Set(['video', 'audio']);

function requiredString(value, field, index) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`items[${index}].${field} must be a non-empty string`);
  }
  return value;
}

export function parseMediaManifest(input) {
  if (!input || typeof input !== 'object') {
    throw new TypeError('manifest must be an object');
  }
  if (input.version !== 1) {
    throw new TypeError('manifest version must be 1');
  }
  if (typeof input.generatedAt !== 'string' || Number.isNaN(Date.parse(input.generatedAt))) {
    throw new TypeError('manifest generatedAt must be an ISO date string');
  }
  if (!Array.isArray(input.items)) {
    throw new TypeError('manifest items must be an array');
  }

  const seenIds = new Set();
  const items = input.items.map((item, index) => {
    if (!item || typeof item !== 'object') {
      throw new TypeError(`items[${index}] must be an object`);
    }
    const id = requiredString(item.id, 'id', index);
    if (seenIds.has(id)) throw new TypeError(`duplicate media id: ${id}`);
    seenIds.add(id);
    if (!KINDS.has(item.kind)) {
      throw new TypeError(`items[${index}].kind must be video or audio`);
    }
    const src = requiredString(item.src, 'src', index);
    let url;
    try {
      url = new URL(src);
    } catch {
      throw new TypeError(`items[${index}].src must be an HTTPS URL`);
    }
    if (url.protocol !== HTTPS) {
      throw new TypeError(`items[${index}].src must be an HTTPS URL`);
    }
    const parsed = {
      id,
      kind: item.kind,
      title: requiredString(item.title, 'title', index),
      src,
      specs: requiredString(item.specs, 'specs', index),
    };
    if (item.engine !== undefined) {
      parsed.engine = requiredString(item.engine, 'engine', index);
    }
    return parsed;
  });

  return { version: 1, generatedAt: input.generatedAt, items };
}

export function toPlaylists(manifest) {
  const videoPlaylist = manifest.items
    .filter((item) => item.kind === 'video')
    .map((item) => ({ ...item, type: 'video', engine: item.engine ?? 'AI Render' }));
  const audioPlaylist = manifest.items.filter((item) => item.kind === 'audio');

  return {
    videoPlaylist: videoPlaylist.length > 0 ? videoPlaylist : [{
      id: 'video-standby',
      title: 'No Media Loaded',
      type: 'video',
      src: '',
      engine: 'Standby',
      specs: 'N/A',
    }],
    audioPlaylist: audioPlaylist.length > 0 ? audioPlaylist : [{
      id: 'audio-standby',
      title: 'No Masters Loaded',
      src: '',
      specs: 'Run npm run media:sync',
    }],
  };
}

export function getMediaOrigin(manifest) {
  const first = manifest.items[0];
  return first ? new URL(first.src).origin : null;
}
