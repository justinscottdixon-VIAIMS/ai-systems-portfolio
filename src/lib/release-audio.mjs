/** Local recordings attached to a release card, separate from track/credit evidence. */
export function normalizeAudioClips(value = []) {
  if (!Array.isArray(value)) throw new TypeError('audioClips must be an array');
  const seen = new Set();
  return value.map(clip => {
    if (!clip || !/^\/reference\/release-audio\/[a-z0-9-]+\.(?:m4a|mp3|wav|ogg)$/.test(clip.src ?? '')) {
      throw new TypeError('Audio clips require a local release-audio asset');
    }
    if (typeof clip.title !== 'string' || !clip.title.trim()) throw new TypeError('Audio clip requires a title');
    if (clip.note !== undefined && (typeof clip.note !== 'string' || !clip.note.trim())) throw new TypeError('Invalid audio clip note');
    return { src: clip.src, title: clip.title.trim(), ...(clip.note ? { note: clip.note.trim() } : {}) };
  }).filter(clip => {
    if (seen.has(clip.src)) return false;
    seen.add(clip.src);
    return true;
  });
}

/** Native controls own this short preview; leave other players paused for manual resume. */
export function bindReleaseAudio(document, { Observer = globalThis.MutationObserver } = {}) {
  const clips = [...document.querySelectorAll('[data-release-audio]')];
  if (!clips.length) return () => {};
  const pauseClips = except => clips.forEach(clip => { if (clip !== except) clip.pause(); });
  const unavailable = clip => clip.closest('[hidden], #reference-stage[data-view="directory"]');
  const onPlay = event => {
    const media = event.target;
    if (!media?.matches?.('audio, video')) return;
    if (!clips.includes(media)) { pauseClips(); return; }
    if (unavailable(media)) { media.pause(); return; }
    for (const other of document.querySelectorAll('audio, video')) if (other !== media) other.pause();
    for (const frame of document.querySelectorAll('#youtube-player-host iframe')) {
      frame.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }), 'https://www.youtube.com');
    }
  };
  const observer = new Observer(() => {
    for (const clip of clips) if (!clip.paused && unavailable(clip)) clip.pause();
  });
  observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['hidden', 'data-view'] });
  const onPageHide = () => pauseClips();
  document.addEventListener('play', onPlay, true);
  document.defaultView?.addEventListener('pagehide', onPageHide);
  return () => {
    pauseClips();
    observer.disconnect();
    document.removeEventListener('play', onPlay, true);
    document.defaultView?.removeEventListener('pagehide', onPageHide);
  };
}
