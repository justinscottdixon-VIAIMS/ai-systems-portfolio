const HTTPS = 'https:';
const KINDS = new Set(['video', 'audio']);
const ASPECTS = new Set(['portrait', 'square', 'landscape']);
const VISUAL_TAG = /^VIZ-[A-Z0-9]+(?:-[A-Z0-9]+)*$/;

function requiredString(value, field, index) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`items[${index}].${field} must be a non-empty string`);
  }
  return value;
}

function classifyAspect(width, height) {
  if (width === height) return 'square';
  return width < height ? 'portrait' : 'landscape';
}

export function parseVideoDimensions(value, label, { optional = false } = {}) {
  const fields = ['width', 'height', 'aspect'];
  const present = fields.filter((field) => value?.[field] !== undefined);
  if (present.length === 0 && optional) return null;
  if (present.length !== fields.length) {
    throw new TypeError(`${label} dimensions require width, height, and aspect together`);
  }
  if (!Number.isInteger(value.width) || value.width <= 0
    || !Number.isInteger(value.height) || value.height <= 0
    || !ASPECTS.has(value.aspect)) {
    throw new TypeError(`${label} width and height must be positive integers and aspect must be portrait, square, or landscape`);
  }
  if (classifyAspect(value.width, value.height) !== value.aspect) {
    throw new TypeError(`${label} aspect contradicts its dimensions`);
  }
  return { width: value.width, height: value.height, aspect: value.aspect };
}

function parseHttpsUrl(value, label) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${label} must be an HTTPS URL`);
  try {
    if (new URL(value).protocol !== HTTPS) throw new Error();
  } catch {
    throw new TypeError(`${label} must be an HTTPS URL`);
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
    const dimensions = parseVideoDimensions(item, `items[${index}]`, { optional: true });
    if (dimensions) Object.assign(parsed, dimensions);
    if (item.visual !== undefined) {
      if (item.kind !== 'audio') throw new TypeError(`items[${index}].visual is only valid on audio items`);
      if (!item.visual || typeof item.visual !== 'object' || Array.isArray(item.visual)) {
        throw new TypeError(`items[${index}].visual must be an object`);
      }
      if (typeof item.visual.tag !== 'string' || !VISUAL_TAG.test(item.visual.tag)) {
        throw new TypeError(`items[${index}].visual tag must use VIZ-<NAME>`);
      }
      parsed.visual = {
        tag: item.visual.tag,
        src: parseHttpsUrl(item.visual.src, `items[${index}].visual.src`),
        ...parseVideoDimensions(item.visual, `items[${index}].visual`),
      };
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
