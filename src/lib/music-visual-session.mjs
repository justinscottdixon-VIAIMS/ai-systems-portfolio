function frozen(state, action) { return Object.freeze({ ...state, visual: state.visual ? Object.freeze({ ...state.visual }) : null, action }); }

export function createMusicVisualSession() {
  let state = { owner: 'cinema', visual: null, cinemaId: null, transition: null, token: 0 };
  return Object.freeze({
    snapshot: () => frozen(state, 'none'),
    activate(visual) {
      if (!visual?.tag || !visual?.src) throw new TypeError('visual requires tag and src');
      if (state.owner === 'music-tag' && state.visual?.tag === visual.tag && state.visual?.src === visual.src) {
        return frozen(state, 'keep');
      }
      state = { owner: 'music-tag', visual: { ...visual }, cinemaId: state.cinemaId, transition: null, token: state.token + 1 };
      return frozen(state, 'replace');
    },
    releaseToCinema(cinemaId) {
      state = { ...state, cinemaId, transition: 'fade-out', token: state.token + 1 };
      return frozen(state, state.visual ? 'fade-to-cinema' : 'keep-cinema');
    },
    completeFade(token) {
      if (token === state.token && state.transition === 'fade-out') {
        state = { ...state, owner: 'cinema', visual: null, transition: null };
      }
      return frozen(state, 'complete');
    },
    fail(token) {
      if (token === state.token) state = { ...state, owner: 'cinema', visual: null, transition: null };
      return frozen(state, 'fail');
    },
  });
}
