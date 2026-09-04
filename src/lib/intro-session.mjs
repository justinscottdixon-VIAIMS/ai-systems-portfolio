export function createIntroSession(experience = {}) {
  const hasEntryAssets = typeof experience.welcomeVideoSrc === 'string'
    && experience.welcomeVideoSrc.trim().length > 0
    && typeof experience.ambientAudioSrc === 'string'
    && experience.ambientAudioSrc.trim().length > 0;
  if (!experience.enabled || !hasEntryAssets) {
    return { available: false, phase: 'cinema', ambientStatus: 'unavailable', status: 'CINEMA READY' };
  }
  return { available: true, phase: 'awaiting-entry', ambientStatus: 'ready', status: 'AWAITING VISITOR ENTRY' };
}

export function beginExperience(session) {
  if (!session.available || session.phase !== 'awaiting-entry') return session;
  return { ...session, phase: 'welcome', ambientStatus: 'playing', status: 'VIAIMS EXPERIENCE OPENING' };
}

export function completeWelcome(session) {
  if (session.phase !== 'welcome') return session;
  return { ...session, phase: 'cinema', status: session.ambientStatus === 'playing'
    ? 'CINEMA LIVE · AMBIENT AUDIO LIVE'
    : 'CINEMA LIVE · AMBIENT AUDIO UNAVAILABLE' };
}

export function failWelcome(session) {
  if (session.phase !== 'welcome') return session;
  return { ...session, phase: 'cinema', status: 'WELCOME VIDEO UNAVAILABLE · CINEMA CONTINUING' };
}

export function failAmbient(session) {
  if (!session.available || session.ambientStatus === 'unavailable' || session.ambientStatus === 'failed') return session;
  return { ...session, ambientStatus: 'failed', status: 'AMBIENT AUDIO UNAVAILABLE · VISUAL EXPERIENCE CONTINUING' };
}
