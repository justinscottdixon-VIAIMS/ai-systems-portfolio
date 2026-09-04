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
  return { items: copy, cursor: copy.length ? 0 : -1, currentId: copy[0]?.id ?? null, generation: 0 };
}

export function selectCinema(state, index) {
  return withCursor(state, index);
}

export function advanceCinema(state, direction = 1) {
  if (state.items.length === 0) return state;
  return withCursor(state, state.cursor + Math.sign(direction || 1));
}

export function createCinemaEndedToken(state, source) {
  return { id: state.currentId, generation: state.generation, source };
}

export function isCurrentCinemaEndedToken(token, state, source) {
  return token?.id === state.currentId
    && token?.generation === state.generation
    && token?.source === source;
}
