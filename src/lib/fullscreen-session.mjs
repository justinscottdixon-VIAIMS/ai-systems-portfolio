export function createFullscreenSession({ hideDelayMs = 3000, titleFadeMs = 1250 } = {}) {
  let state = { mode: 'inline', controlsVisible: true, paused: false, token: 0, hideDelayMs, titleFadeMs };
  const snapshot = () => Object.freeze({ ...state });
  const update = (changes) => {
    state = { ...state, ...changes, token: state.token + 1 };
    return snapshot();
  };
  return Object.freeze({
    snapshot,
    enter: () => update({ mode: 'fullscreen', controlsVisible: true }),
    interact: () => update({ controlsVisible: true }),
    setPaused: (paused) => update({ paused: Boolean(paused), controlsVisible: paused ? true : state.controlsVisible }),
    onHideTimer(token) {
      if (state.mode === 'fullscreen' && !state.paused && token === state.token) {
        state = { ...state, controlsVisible: false };
      }
      return snapshot();
    },
    exit: () => update({ mode: 'inline', controlsVisible: true }),
  });
}
