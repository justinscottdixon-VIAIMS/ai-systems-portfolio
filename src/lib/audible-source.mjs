function normalized(source) {
  if (!source) return null;
  return {
    provider: source.provider,
    id: source.id ?? null,
    mode: source.mode,
    currentTime: Number.isFinite(source.currentTime) ? source.currentTime : 0,
  };
}

export function audibleElementKind(state) {
  const current = state?.current;
  if (current?.mode !== 'audio') return null;
  if (current.provider === 'ambient') return 'ambient';
  if (current.provider === 'music') return 'music';
  return null;
}

export function createAudibleSource(initial = null) {
  return { current: normalized(initial), suspended: null };
}

export function selectAudibleTrack(state, source) {
  return { current: normalized(source), suspended: null };
}

export function removeAudibleProvider(state, provider) {
  if (!state) return state;
  return {
    current: state.current?.provider === provider ? null : normalized(state.current),
    suspended: state.suspended?.provider === provider ? null : normalized(state.suspended),
  };
}

export function claimCinemaAudio(state) {
  if (state.current?.provider === 'cinema') return state;
  return {
    current: { provider: 'cinema', id: null, mode: 'video', currentTime: 0 },
    suspended: normalized(state.current),
  };
}

export function restorePriorAudio(state) {
  if (state.current?.provider !== 'cinema') return state;
  return { current: normalized(state.suspended), suspended: null };
}
