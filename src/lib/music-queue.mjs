const REPEAT = new Set(['off', 'all', 'one']);

function copy(queue, updates) { return { ...queue, ...updates, order: [...(updates.order ?? queue.order)] }; }

export function createMusicQueue(items) {
  const tracks = new Map(items.map((item) => [item.productId, item]));
  const order = items.map((item) => item.productId);
  return { tracks, order, cursor: 0, currentProductId: order[0] ?? null, mode: 'audio', shuffle: false, repeat: 'off' };
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
  return copy(queue, { cursor, currentProductId: queue.order[cursor], mode: 'audio' });
}
