const VISUAL_TAG = /^VIZ-[A-Z0-9]+(?:-[A-Z0-9]+)*$/;

function providerOf(item) {
  return item.folder ?? item.provider ?? null;
}

function kindOf(item) {
  if (item.kind === 'audio' || item.kind === 'video') return item.kind;
  if (providerOf(item) === 'music' && typeof item.audioSrc === 'string') return 'audio';
  if (!('folder' in item)
      && item.provider === 'media'
      && item.kind === undefined
      && [item.id, item.title, item.src, item.specs]
        .every((value) => typeof value === 'string' && value.length > 0)
      && dimensionsOf(item)) return 'video';
  return null;
}

function sourceOf(item, kind) {
  if (typeof item.src === 'string') return item.src;
  if (kind === 'audio' && typeof item.audioSrc === 'string') return item.audioSrc;
  return '';
}

function identityOf(item, provider) {
  if (provider === 'music') return item.productId ?? item.id ?? item.pathname;
  return item.id ?? item.pathname;
}

function extensionOf(item, src) {
  for (const candidate of [item.pathname, item.id, item.productId, src]) {
    if (typeof candidate !== 'string') continue;
    const pathname = (() => {
      try { return new URL(candidate).pathname; } catch { return candidate.split(/[?#]/, 1)[0]; }
    })();
    const extension = pathname.match(/\.([^.\/]+)$/)?.[1];
    if (extension) return extension.toUpperCase();
  }
  return '';
}

function dimensionsOf(item) {
  if (!Number.isSafeInteger(item.width) || item.width <= 0
      || !Number.isSafeInteger(item.height) || item.height <= 0) return null;
  const aspect = item.height > item.width ? 'portrait'
    : item.height < item.width ? 'landscape' : 'square';
  if (item.aspect !== aspect) return null;
  return { width: item.width, height: item.height, aspect };
}

function specsOf(item, src, dimensions) {
  const extension = extensionOf(item, src);
  const medium = extension || (kindOf(item) === 'audio' ? 'AUDIO' : 'VIDEO');
  return dimensions ? `${medium} • ${dimensions.width}×${dimensions.height}` : medium;
}

function ordered(items, provider) {
  return items
    .map((item, sourceIndex) => ({ item, sourceIndex }))
    .filter(({ item }) => providerOf(item) === provider)
    .sort((left, right) => {
      const leftOrder = Number.isSafeInteger(left.item.playlistOrder)
        ? left.item.playlistOrder : left.sourceIndex;
      const rightOrder = Number.isSafeInteger(right.item.playlistOrder)
        ? right.item.playlistOrder : right.sourceIndex;
      return leftOrder - rightOrder || left.sourceIndex - right.sourceIndex;
    })
    .map(({ item }) => item);
}

function freezeArray(items) {
  return Object.freeze(items.map((item) => Object.freeze(item)));
}

function projectVisual(visual) {
  const tag = visual.visualTag ?? visual.tag;
  const dimensions = dimensionsOf(visual);
  const src = sourceOf(visual, 'video');
  if (!VISUAL_TAG.test(tag ?? '') || !dimensions || !src) return null;
  return Object.freeze({ tag, src, ...dimensions });
}

function projectVideo(item, provider) {
  const src = sourceOf(item, 'video');
  const dimensions = dimensionsOf(item);
  return {
    id: identityOf(item, provider),
    kind: 'video',
    title: item.title,
    src,
    specs: specsOf(item, src, dimensions),
    ...(dimensions ?? {}),
  };
}

export function toRuntimeMediaLibrary(items) {
  if (!Array.isArray(items)) throw new TypeError('runtime media items must be an array');

  const musicItems = ordered(items, 'music');
  const projectedVisuals = ordered(items, 'music-visuals')
    .map(projectVisual)
    .filter(Boolean);
  for (const item of musicItems) {
    const embedded = projectVisual(item.visual ?? {});
    if (embedded && !projectedVisuals.some(({ tag }) => tag === embedded.tag)) {
      projectedVisuals.push(embedded);
    }
  }
  const musicVisuals = freezeArray(projectedVisuals);
  const visualsByTag = new Map(musicVisuals.map((visual) => [visual.tag, visual]));

  const cinema = freezeArray(ordered(items, 'cinema')
    .filter((item) => kindOf(item) === 'video')
    .map((item) => projectVideo(item, 'cinema')));
  const media = freezeArray(ordered(items, 'media')
    .filter((item) => kindOf(item) === 'video')
    .map((item) => projectVideo(item, 'media')));
  const music = freezeArray(musicItems
    .filter((item) => kindOf(item) === 'audio' || kindOf(item) === 'video')
    .map((item) => {
      const kind = kindOf(item);
      const src = sourceOf(item, kind);
      const dimensions = kind === 'video' ? dimensionsOf(item) : null;
      const tag = item.visualTag ?? item.visual?.tag;
      const visual = visualsByTag.get(tag);
      return {
        productId: identityOf(item, 'music'),
        kind,
        title: item.title,
        src,
        specs: specsOf(item, src, dimensions),
        ...(dimensions ? { aspect: dimensions.aspect } : {}),
        ...(visual ? { visual: Object.freeze({ ...visual }) } : {}),
      };
    }));

  return Object.freeze({ cinema, music, media, musicVisuals });
}
