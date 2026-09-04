const TABS = new Set(['cinema', 'music', 'media', 'youtube']);

function cinemaPlayback(id, muted) {
  return {
    provider: 'cinema', id, mode: 'video', stageOwner: 'cinema',
    audibleOwner: muted ? null : 'cinema', meterSource: muted ? null : 'cinema', meterStatus: muted ? 'idle' : 'native',
  };
}

export function createPlaybackSession({ cinemaId, cinemaMuted = true } = {}) {
  return {
    activeTab: 'cinema',
    playback: cinemaPlayback(cinemaId ?? null, cinemaMuted),
    lease: null,
  };
}

export function selectBrowseTab(session, activeTab) {
  if (!TABS.has(activeTab)) throw new TypeError(`unsupported media tab: ${activeTab}`);
  return { ...session, activeTab };
}

export function activateSource(session, activation) {
  if (!TABS.has(activation.provider)) throw new TypeError(`unsupported provider: ${activation.provider}`);
  if (activation.provider === 'music' && activation.mode === 'audio') {
    if (session.lease) throw new TypeError('releaseStageLease must be called before activating Music audio');
    return { ...session, playback: { provider: 'music', id: activation.id, mode: 'audio', stageOwner: 'cinema', audibleOwner: 'music', meterSource: 'music', meterStatus: 'native' } };
  }
  if (activation.provider === 'cinema') {
    return { ...session, lease: null, playback: cinemaPlayback(activation.id, activation.muted) };
  }
  const lease = session.lease ?? { snapshot: activation.snapshot };
  if (!lease.snapshot) throw new TypeError('stage lease requires a Cinema snapshot');
  const external = activation.provider === 'youtube';
  return {
    ...session,
    lease,
    playback: { provider: activation.provider, id: activation.id, mode: activation.mode, stageOwner: activation.provider, audibleOwner: activation.provider, meterSource: external ? null : activation.provider, meterStatus: external ? 'external-unavailable' : 'native' },
  };
}

export function releaseStageLease(session) {
  if (!session.lease) return { session, snapshot: null };
  const snapshot = session.lease.snapshot;
  return {
    snapshot,
    session: { ...session, lease: null, playback: cinemaPlayback(snapshot.id ?? null, snapshot.muted) },
  };
}

export function setPlaybackMuted(session, muted) {
  const isMuted = Boolean(muted);
  const external = session.playback.provider === 'youtube';
  return {
    ...session,
    playback: {
      ...session.playback,
      audibleOwner: isMuted ? null : session.playback.provider,
      meterSource: isMuted || external ? null : session.playback.provider,
      meterStatus: isMuted ? 'idle' : external ? 'external-unavailable' : 'native',
    },
  };
}
