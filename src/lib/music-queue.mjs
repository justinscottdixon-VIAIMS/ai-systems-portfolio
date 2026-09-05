const REPEAT = new Set(['off', 'all', 'one']);

function copy(queue, updates) { return { ...queue, ...updates, order: [...(updates.order ?? queue.order)] }; }

function itemMode(item) {
  if (item.kind === 'audio') return 'audio';
  if (item.kind === 'video') return 'video';
  throw new TypeError(`unsupported Music kind: ${item.kind}`);
}

function normalizeItem(item) {
  if (item.kind !== undefined) {
    itemMode(item);
    return item;
  }
  if (typeof item.audioSrc === 'string') {
    return { ...item, kind: 'audio', src: item.audioSrc };
  }
  itemMode(item);
}

export function createMusicQueue(items) {
  const normalized = items.map(normalizeItem);
  const seen = new Set();
  for (const item of normalized) {
    if (seen.has(item.productId)) throw new TypeError(`duplicate Music product: ${item.productId}`);
    seen.add(item.productId);
  }
  const tracks = new Map(normalized.map((item) => [item.productId, item]));
  const order = normalized.map((item) => item.productId);
  return {
    tracks,
    order,
    cursor: 0,
    currentProductId: order[0] ?? null,
    mode: normalized[0] ? itemMode(normalized[0]) : 'audio',
    shuffle: false,
    repeat: 'off',
  };
}

export function selectMusicItem(queue, productId) {
  const track = queue.tracks.get(productId);
  if (!track) throw new RangeError(`unknown Music product: ${productId}`);
  const cursor = queue.order.indexOf(productId);
  return copy(queue, { currentProductId: productId, cursor, mode: itemMode(track) });
}

export function selectMusicMode(queue, productId, mode) {
  const track = queue.tracks.get(productId);
  if (!track) throw new RangeError(`unknown Music product: ${productId}`);
  if (mode !== 'audio' && mode !== 'video') throw new TypeError(`unsupported Music mode: ${mode}`);
  if (mode === 'video' && !track.videoSrc) throw new TypeError(`Music product ${productId} has no video asset`);
  const cursor = queue.order.indexOf(productId);
  return copy(queue, { currentProductId: productId, cursor, mode });
}

export function setRepeatMode(queue, repeat) {
  if (!REPEAT.has(repeat)) throw new TypeError(`unsupported repeat mode: ${repeat}`);
  return copy(queue, { repeat });
}

export function toggleShuffle(queue, random = Math.random) {
  if (queue.shuffle) return copy(queue, { shuffle: false, order: [...queue.tracks.keys()], cursor: [...queue.tracks.keys()].indexOf(queue.currentProductId) });
  const upcoming = queue.order.filter((id) => id !== queue.currentProductId);
  for (let index = upcoming.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [upcoming[index], upcoming[target]] = [upcoming[target], upcoming[index]];
  }
  return copy(queue, { shuffle: true, order: [queue.currentProductId, ...upcoming], cursor: 0 });
}

export function advanceMusicQueue(queue, direction = 1) {
  if (!queue.currentProductId) return null;
  if (queue.repeat === 'one' && direction > 0) return copy(queue, {});
  let cursor = queue.cursor + Math.sign(direction || 1);
  if (cursor < 0 || cursor >= queue.order.length) {
    if (queue.repeat !== 'all') return null;
    cursor = cursor < 0 ? queue.order.length - 1 : 0;
  }
  const currentProductId = queue.order[cursor];
  return copy(queue, { cursor, currentProductId, mode: itemMode(queue.tracks.get(currentProductId)) });
}
