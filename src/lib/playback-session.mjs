const TABS = new Set(['cinema', 'music', 'media', 'youtube']);

export function createPlaybackSession({ cinemaId, cinemaMuted = true } = {}) {
  return {
    activeTab: 'cinema',
    playback: {
      provider: 'cinema', id: cinemaId ?? null, mode: 'video', stageOwner: 'cinema',
      audibleOwner: cinemaMuted ? null : 'cinema', meterSource: cinemaMuted ? null : 'cinema', meterStatus: cinemaMuted ? 'idle' : 'native',
    },
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
    return { ...session, playback: { provider: 'music', id: activation.id, mode: 'audio', stageOwner: 'cinema', audibleOwner: 'music', meterSource: 'music', meterStatus: 'native' } };
  }
  if (activation.provider === 'cinema') {
    return { ...session, lease: null, playback: { provider: 'cinema', id: activation.id, mode: 'video', stageOwner: 'cinema', audibleOwner: activation.muted ? null : 'cinema', meterSource: activation.muted ? null : 'cinema', meterStatus: activation.muted ? 'idle' : 'native' } };
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
    session: { ...session, lease: null, playback: { provider: 'cinema', id: snapshot.id ?? null, mode: 'video', stageOwner: 'cinema', audibleOwner: snapshot.muted ? null : 'cinema', meterSource: snapshot.muted ? null : 'cinema', meterStatus: snapshot.muted ? 'idle' : 'native' } },
  };
}
