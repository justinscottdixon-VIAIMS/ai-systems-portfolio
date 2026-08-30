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

const DEFAULT_FOLLOWER_METADATA_TIMEOUT_MS = 5_000;

function waitForFollowerMetadata(follower, timeoutMs) {
  let cancel;
  const promise = new Promise((resolve) => {
    let settled = false;
    let timeoutId;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      for (const [event, listener] of Object.entries(listeners)) {
        follower.removeEventListener?.(event, listener);
      }
      resolve(result);
    };
    const listeners = {
      loadedmetadata: () => finish('loadedmetadata'),
      error: () => finish('error'),
      abort: () => finish('abort'),
    };
    timeoutId = setTimeout(() => finish('timeout'), timeoutMs);
    cancel = () => finish('cancelled');
    for (const [event, listener] of Object.entries(listeners)) {
      follower.addEventListener(event, listener);
    }
  });
  return { promise, cancel };
}

function createFollowerRestoreContext() {
  const cancellations = new Set();
  return {
    addCancellation(cancel) {
      cancellations.add(cancel);
    },
    removeCancellation(cancel) {
      cancellations.delete(cancel);
    },
    cancelPending() {
      for (const cancel of cancellations) cancel();
      cancellations.clear();
    },
  };
}

function clearFollowerSource(follower) {
  follower.pause();
  if (typeof follower.removeAttribute === 'function') follower.removeAttribute('src');
  else follower.src = '';
  follower.load?.();
}

async function restoreFollowerSnapshot(follower, snapshot, timeoutMs, context) {
  const sourceChanged = (follower.currentSrc || follower.src) !== snapshot.src;
  const metadataWait = sourceChanged && snapshot.src && typeof follower.addEventListener === 'function'
    ? waitForFollowerMetadata(follower, timeoutMs)
    : null;
  if (metadataWait) context.addCancellation(metadataWait.cancel);
  follower.pause();
  if (sourceChanged) {
    if (snapshot.src) follower.src = snapshot.src;
    else if (typeof follower.removeAttribute === 'function') follower.removeAttribute('src');
    else follower.src = '';
    follower.load?.();
  }
  const metadataResult = metadataWait ? await metadataWait.promise : 'loadedmetadata';
  if (metadataWait) context.removeCancellation(metadataWait.cancel);
  if (metadataResult !== 'loadedmetadata' && sourceChanged && snapshot.src) return false;
  follower.currentTime = snapshot.currentTime;
  follower.muted = snapshot.muted;
  follower.hidden = snapshot.hidden;
  if (!snapshot.paused) {
    try {
      await follower.play();
    } catch {
      return false;
    }
  }
  return true;
}

export function captureCinemaSnapshot(video, stage, id = null, followers = []) {
  return { id, src: video.currentSrc || video.src, currentTime: video.currentTime, paused: video.paused, muted: video.muted, aspect: stage.dataset.mediaAspect, hasMirrorFailure: Object.hasOwn(stage.dataset, 'mirrorFailure'), mirrorFailure: stage.dataset.mirrorFailure, followers: followers.map(captureFollowerSnapshot) };
}

export async function restoreCinemaSnapshot(video, stage, snapshot, followers = [], { followerMetadataTimeoutMs = DEFAULT_FOLLOWER_METADATA_TIMEOUT_MS } = {}) {
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
  const context = createFollowerRestoreContext();
  const followerRestores = await Promise.all(followers.map(async (follower, index) => {
    const restored = await restoreFollowerSnapshot(follower, snapshot.followers?.[index], followerMetadataTimeoutMs, context);
    if (!restored) context.cancelPending();
    return restored;
  }));
  if (followerRestores.some((restored) => !restored)) {
    followers.forEach(clearFollowerSource);
    stage.dataset.mirrorFailure = 'true';
  } else if (snapshot.hasMirrorFailure) stage.dataset.mirrorFailure = snapshot.mirrorFailure;
  else delete stage.dataset.mirrorFailure;
  if (!snapshot.paused) await video.play();
}
