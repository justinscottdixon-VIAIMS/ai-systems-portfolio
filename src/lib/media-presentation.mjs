export function classifyMediaAspect(width, height) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return 'unknown';
  }
  if (width < height) return 'portrait';
  if (width > height) return 'landscape';
  return 'square';
}

export function usesMirrorWings(aspect) {
  return aspect === 'portrait' || aspect === 'square';
}

export function alignFollower(master, follower, threshold = 0.3) {
  if (!Number.isFinite(master.currentTime) || !Number.isFinite(follower.currentTime)) return false;
  if (Math.abs(follower.currentTime - master.currentTime) <= threshold) return false;
  follower.currentTime = master.currentTime;
  return true;
}

export async function claimAudioBus(video, audio) {
  const priorMuteState = video.muted;
  video.muted = true;
  try {
    await audio.play();
  } catch (error) {
    video.muted = priorMuteState;
    throw error;
  }
}

export function claimVideoBus(video, audio) {
  if (!audio.paused) audio.pause();
  video.muted = false;
}

export function captureCinemaSnapshot(video, stage, id = null) {
  return { id, src: video.currentSrc || video.src, currentTime: video.currentTime, paused: video.paused, muted: video.muted, aspect: stage.dataset.mediaAspect };
}

export async function restoreCinemaSnapshot(video, stage, snapshot) {
  video.pause();
  video.src = snapshot.src;
  const metadataReady = typeof video.readyState === 'number' && video.readyState < 1
    ? new Promise((resolve) => video.addEventListener('loadedmetadata', resolve, { once: true }))
    : Promise.resolve();
  video.load?.();
  await metadataReady;
  video.currentTime = snapshot.currentTime;
  video.muted = snapshot.muted;
  stage.dataset.mediaAspect = snapshot.aspect;
  if (!snapshot.paused) await video.play();
}
