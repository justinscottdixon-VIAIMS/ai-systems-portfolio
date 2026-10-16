function normalizeIndex(length, index) {
  if (length === 0) return -1;
  return ((index % length) + length) % length;
}

function withCursor(state, cursor) {
  const normalized = normalizeIndex(state.items.length, cursor);
  const item = normalized < 0 ? null : state.items[normalized];
  return { ...state, cursor: normalized, currentId: item?.id ?? null, generation: state.generation + 1 };
}

export function createCinemaContinuity(items) {
  const copy = items.map(({ id, src }) => ({ id, src }));
  return { items: copy, cursor: copy.length ? 0 : -1, currentId: copy[0]?.id ?? null, generation: 0, order: copy.map(item => item.id), shuffle: false, repeat: 'all' };
}

export function selectCinema(state, index) {
  return withCursor(state, index);
}

export function setCinemaRepeat(state, repeat) {
  if (!['off', 'all', 'one'].includes(repeat)) throw new TypeError(`unsupported repeat mode: ${repeat}`);
  return { ...state, repeat };
}

export function toggleCinemaShuffle(state, random = Math.random) {
  if (state.shuffle) return { ...state, shuffle: false, order: state.items.map(item => item.id) };
  const order = state.items.map(item => item.id).filter(id => id !== state.currentId);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  if (state.items.some(item => item.id === state.currentId)) order.unshift(state.currentId);
  return { ...state, shuffle: true, order };
}

export function advanceCinema(state, direction = 1, { natural = false } = {}) {
  if (!state.items.length) return natural ? null : state;
  if (natural && state.repeat === 'one') return withCursor(state, state.cursor);
  const order = state.order;
  const current = order.indexOf(state.currentId);
  let next = current < 0 ? (direction < 0 ? order.length - 1 : 0) : current + Math.sign(direction || 1);
  if (natural && state.repeat === 'off' && (next < 0 || next >= order.length)) return null;
  next = normalizeIndex(order.length, next);
  return withCursor(state, state.items.findIndex(item => item.id === order[next]));
}

export function createCinemaEndedToken(state, source) {
  return { id: state.currentId, generation: state.generation, source };
}

export function isCurrentCinemaEndedToken(token, state, source) {
  return token?.id === state.currentId
    && token?.generation === state.generation
    && token?.source === source;
}
