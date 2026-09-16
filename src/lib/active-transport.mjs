const DISABLED = Object.freeze({
  playPause: false,
  previous: false,
  next: false,
  shuffle: false,
  repeat: false,
});

const CINEMA = Object.freeze({
  playPause: true,
  previous: true,
  next: true,
  shuffle: false,
  repeat: false,
});

const MUSIC = Object.freeze({
  playPause: true,
  previous: true,
  next: true,
  shuffle: true,
  repeat: true,
});

const MEDIA = Object.freeze({
  playPause: true,
  previous: false,
  next: false,
  shuffle: false,
  repeat: false,
});

export function transportPlaybackForTab(activeTab, decks = {}) {
  if (activeTab === 'cinema') return decks.cinema ? { ...decks.cinema } : {};
  if (activeTab === 'music') return decks.music ? { ...decks.music } : {};
  if (activeTab === 'media') return decks.media ? { ...decks.media } : {};
  return {};
}

export function activeTransportPolicy(playback = {}) {
  if (!playback.id) return { ...DISABLED };
  if (playback.provider === 'cinema' && playback.mode === 'video') return { ...CINEMA };
  if (playback.provider === 'music' && (playback.mode === 'audio' || playback.mode === 'video')) return { ...MUSIC };
  if (playback.provider === 'media' && playback.mode === 'video') return { ...MEDIA };
  return { ...DISABLED };
}

export function runtimeVideoErrorAction({ introPhase, playback = {}, hasLease = false } = {}) {
  if (introPhase === 'welcome') return 'welcome-fallback';
  if (hasLease) return 'restore-lease';
  if (playback.stageOwner === 'cinema') return 'cinema-retry';
  return 'ignore';
}

export function activePlayButtonState(paused) {
  return paused === false
    ? { text: 'PAUSE', ariaLabel: 'Pause active item' }
    : { text: 'PLAY', ariaLabel: 'Play active item' };
}

export function activeStatusAfterSuccessfulPlay(playback = {}, currentStatus = '') {
  const isCinemaPlaybackError = playback.provider === 'cinema'
    && playback.mode === 'video'
    && currentStatus.startsWith('CINEMA PLAYBACK ERROR');
  return isCinemaPlaybackError ? 'CINEMA LIVE' : currentStatus;
}

export async function runActivePlaybackRetry({
  playback = {},
  currentStatus = '',
  startPlayback,
  onStatus,
}) {
  let value;
  try {
    value = await startPlayback();
  } catch (error) {
    if (playback.provider !== 'cinema' || playback.mode !== 'video') throw error;
    const message = error instanceof Error ? error.message : 'UNKNOWN';
    const status = `CINEMA PLAYBACK ERROR · ${message}`;
    await onStatus(status);
    return { outcome: 'handled-error', status, error };
  }
  const status = activeStatusAfterSuccessfulPlay(playback, currentStatus);
  await onStatus(status);
  return { outcome: 'playing', status, value };
}

export function createEndedEventToken(playback = {}, source) {
  return {
    provider: playback.provider,
    id: playback.id,
    mode: playback.mode,
    source,
  };
}

export function isCurrentEndedEventToken(token, playback = {}, source) {
  return token?.provider === playback.provider
    && token?.id === playback.id
    && token?.mode === playback.mode
    && token?.source === source;
}

export async function runCommittedPlayback({
  commitSelection,
  startPlayback,
  onPlaying,
  onRejected,
}) {
  const committed = await commitSelection();
  let playbackResult;
  try {
    playbackResult = await startPlayback(committed);
  } catch (error) {
    await onRejected(error, committed);
    throw error;
  }
  await onPlaying(committed, playbackResult);
  return playbackResult;
}
