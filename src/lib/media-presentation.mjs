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

function captureFollowerSnapshot(follower) {
  return {
    src: follower.currentSrc || follower.src || null,
    currentTime: follower.currentTime,
    paused: follower.paused,
    muted: follower.muted,
    hidden: follower.hidden,
  };
}

async function restoreFollowerSnapshot(follower, snapshot) {
  const sourceChanged = (follower.currentSrc || follower.src) !== snapshot.src;
  const metadataReady = sourceChanged && snapshot.src && typeof follower.addEventListener === 'function'
    ? new Promise((resolve) => follower.addEventListener('loadedmetadata', resolve, { once: true }))
    : Promise.resolve();
  follower.pause();
  if (sourceChanged) {
    if (snapshot.src) follower.src = snapshot.src;
    else if (typeof follower.removeAttribute === 'function') follower.removeAttribute('src');
    else follower.src = '';
    follower.load?.();
  }
  await metadataReady;
  follower.currentTime = snapshot.currentTime;
  follower.muted = snapshot.muted;
  follower.hidden = snapshot.hidden;
  if (!snapshot.paused) {
    try {
      await follower.play();
    } catch {}
  }
}

export function captureCinemaSnapshot(video, stage, id = null, followers = []) {
  return { id, src: video.currentSrc || video.src, currentTime: video.currentTime, paused: video.paused, muted: video.muted, aspect: stage.dataset.mediaAspect, hasMirrorFailure: Object.hasOwn(stage.dataset, 'mirrorFailure'), mirrorFailure: stage.dataset.mirrorFailure, followers: followers.map(captureFollowerSnapshot) };
}

export async function restoreCinemaSnapshot(video, stage, snapshot, followers = []) {
  const sourceChanged = (video.currentSrc || video.src) !== snapshot.src;
  const metadataReady = sourceChanged && typeof video.addEventListener === 'function'
    ? new Promise((resolve) => video.addEventListener('loadedmetadata', resolve, { once: true }))
    : Promise.resolve();
  video.pause();
  if (sourceChanged) {
    video.src = snapshot.src;
    video.load?.();
  }
  await metadataReady;
  video.currentTime = snapshot.currentTime;
  video.muted = snapshot.muted;
  stage.dataset.mediaAspect = snapshot.aspect;
  await Promise.all(followers.map((follower, index) => restoreFollowerSnapshot(follower, snapshot.followers?.[index])));
  if (snapshot.hasMirrorFailure) stage.dataset.mirrorFailure = snapshot.mirrorFailure;
  else delete stage.dataset.mirrorFailure;
  if (!snapshot.paused) await video.play();
}
