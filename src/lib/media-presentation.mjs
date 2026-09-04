export function classifyMediaAspect(width, height) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return 'unknown';
  }
  if (width < height) return 'portrait';
  if (width > height) return 'landscape';
  return 'square';
}

export function alignFollower(master, follower, threshold = 0.3) {
  if (!Number.isFinite(master.currentTime) || !Number.isFinite(follower.currentTime)) return false;
  if (Math.abs(follower.currentTime - master.currentTime) <= threshold) return false;
  follower.currentTime = master.currentTime;
  return true;
}

export function alignMirrorFollowers(master, followers, {
  active = false,
  threshold = 0.3,
  onFailure = () => {},
} = {}) {
  if (!active) return false;
  try {
    for (const follower of followers) alignFollower(master, follower, threshold);
    return true;
  } catch {
    onFailure();
    return false;
  }
}

export function bindMirrorFollowerFailures(followers, onFailure) {
  for (const follower of followers) follower.addEventListener?.('error', onFailure);
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

const DEFAULT_MASTER_METADATA_TIMEOUT_MS = 5_000;
const DEFAULT_FOLLOWER_METADATA_TIMEOUT_MS = 5_000;

function currentMediaSource(media) {
  return media.currentSrc || media.src || '';
}

function waitForMasterMetadata(video, restoredSrc, timeoutMs) {
  let arm;
  const promise = new Promise((resolve, reject) => {
    let settled = false;
    let armed = false;
    let timeoutId;
    const registered = [];
    const finish = (error = null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      for (const [event, listener] of registered) {
        video.removeEventListener?.(event, listener);
      }
      if (error) reject(error);
      else resolve();
    };
    const isRestoredSource = () => currentMediaSource(video) === restoredSrc;
    const listeners = {
      loadedmetadata: () => {
        if (armed && isRestoredSource()) finish();
      },
      error: () => {
        if (armed && isRestoredSource()) finish(new Error(`Cinema metadata error: ${restoredSrc}`));
      },
      abort: () => {
        if (armed && isRestoredSource()) finish(new Error(`Cinema metadata aborted: ${restoredSrc}`));
      },
    };
    for (const [event, listener] of Object.entries(listeners)) {
      if (settled) break;
      video.addEventListener(event, listener);
      registered.push([event, listener]);
      if (settled) video.removeEventListener?.(event, listener);
    }
    arm = () => {
      if (settled || armed) return;
      armed = true;
      timeoutId = setTimeout(
        () => finish(new Error(`Cinema metadata timeout: ${restoredSrc}`)),
        timeoutMs,
      );
    };
  });
  return { promise, arm };
}

function waitForFollowerMetadata(follower, restoredSrc, timeoutMs) {
  let arm;
  let cancel;
  const promise = new Promise((resolve) => {
    let settled = false;
    let armed = false;
    let timeoutId;
    const registered = [];
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      for (const [event, listener] of registered) {
        follower.removeEventListener?.(event, listener);
      }
      resolve(result);
    };
    const isRestoredSource = () => currentMediaSource(follower) === restoredSrc;
    const listeners = {
      loadedmetadata: () => {
        if (armed && isRestoredSource()) finish('loadedmetadata');
      },
      error: () => {
        if (armed && isRestoredSource()) finish('error');
      },
      abort: () => {
        if (armed && isRestoredSource()) finish('abort');
      },
    };
    for (const [event, listener] of Object.entries(listeners)) {
      if (settled) break;
      follower.addEventListener(event, listener);
      registered.push([event, listener]);
      if (settled) follower.removeEventListener?.(event, listener);
    }
    arm = () => {
      if (settled || armed) return;
      armed = true;
      timeoutId = setTimeout(() => finish('timeout'), timeoutMs);
    };
    cancel = () => finish('cancelled');
  });
  return { promise, arm, cancel };
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

function safelyClearFollowerSource(follower) {
  try {
    clearFollowerSource(follower);
  } catch {
    // Decorative follower cleanup must never affect authoritative playback.
  }
}

async function restoreFollowerSnapshot(follower, snapshot, timeoutMs, context) {
  let metadataWait = null;
  try {
    if (!snapshot) return false;
    const sourceChanged = currentMediaSource(follower) !== snapshot.src;
    const metadataNotReady = Number.isFinite(follower.readyState) && follower.readyState < 1;
    const requestNeeded = sourceChanged || metadataNotReady;
    metadataWait = requestNeeded && snapshot.src && typeof follower.addEventListener === 'function'
      ? waitForFollowerMetadata(follower, snapshot.src, timeoutMs)
      : null;
    if (metadataWait) context.addCancellation(metadataWait.cancel);
    follower.pause();
    if (sourceChanged) {
      if (snapshot.src) follower.src = snapshot.src;
      else if (typeof follower.removeAttribute === 'function') follower.removeAttribute('src');
      else follower.src = '';
    }
    if (requestNeeded) {
      metadataWait?.arm();
      follower.load?.();
    }
    const metadataResult = metadataWait ? await metadataWait.promise : 'loadedmetadata';
    if (metadataResult !== 'loadedmetadata' && requestNeeded && snapshot.src) return false;
    follower.currentTime = snapshot.currentTime;
    follower.muted = snapshot.muted;
    follower.hidden = snapshot.hidden;
    if (!snapshot.paused) {
      await follower.play();
    }
    return true;
  } catch {
    return false;
  } finally {
    if (metadataWait) context.removeCancellation(metadataWait.cancel);
  }
}

export async function prepareMirrorFollowers(master, followers, {
  metadataTimeoutMs = DEFAULT_FOLLOWER_METADATA_TIMEOUT_MS,
  isCurrent = () => true,
} = {}) {
  const source = currentMediaSource(master);
  if (!source || followers.length === 0) return false;
  const context = createFollowerRestoreContext();
  const snapshots = followers.map(() => ({
    src: source,
    currentTime: master.currentTime,
    paused: true,
    muted: true,
    hidden: true,
  }));
  const results = await Promise.all(followers.map(async (follower, index) => {
    const restored = await restoreFollowerSnapshot(follower, snapshots[index], metadataTimeoutMs, context);
    if (!restored) context.cancelPending();
    return restored;
  }));
  if (!isCurrent()) return false;
  if (results.some((restored) => !restored)) {
    followers.forEach(safelyClearFollowerSource);
    return false;
  }
  return true;
}

function safelyPauseAndHideFollower(follower) {
  try {
    follower.hidden = true;
    follower.pause();
  } catch {
    // Decorative follower isolation must never affect authoritative playback.
  }
}

export async function commitMirrorFollowers(master, followers, {
  isCurrent = () => true,
  shouldCleanupStale = () => true,
} = {}) {
  try {
    for (const follower of followers) {
      follower.hidden = true;
      follower.pause();
    }
    if (!master.paused) await Promise.all(followers.map((follower) => follower.play()));
    if (!isCurrent()) {
      if (shouldCleanupStale()) followers.forEach(safelyPauseAndHideFollower);
      return false;
    }
    if (master.paused) followers.forEach((follower) => follower.pause());
    for (const follower of followers) follower.hidden = false;
    return true;
  } catch {
    if (isCurrent() || shouldCleanupStale()) followers.forEach(safelyPauseAndHideFollower);
    return false;
  }
}

export function captureCinemaSnapshot(video, stage, id = null, followers = []) {
  return {
    id,
    src: video.currentSrc || video.src,
    currentTime: video.currentTime,
    paused: video.paused,
    muted: video.muted,
    aspect: stage.dataset.mediaAspect,
    stageProvider: stage.dataset.stageProvider,
    mirrorWings: stage.dataset.mirrorWings,
    hasMirrorFailure: Object.hasOwn(stage.dataset, 'mirrorFailure'),
    mirrorFailure: stage.dataset.mirrorFailure,
    followers: followers.map(captureFollowerSnapshot),
  };
}

export async function restoreCinemaSnapshot(video, stage, snapshot, followers = [], {
	masterMuted = snapshot.muted,
  masterMetadataTimeoutMs = DEFAULT_MASTER_METADATA_TIMEOUT_MS,
  followerMetadataTimeoutMs = DEFAULT_FOLLOWER_METADATA_TIMEOUT_MS,
} = {}) {
  const requestedSource = video.src || video.currentSrc || '';
  const selectedSourceMismatch = typeof video.currentSrc === 'string' && video.currentSrc !== snapshot.src;
  const metadataNotReady = Number.isFinite(video.readyState) && video.readyState < 1;
  const requestNeeded = requestedSource !== snapshot.src || selectedSourceMismatch || metadataNotReady;
  const metadataWait = requestNeeded && typeof video.addEventListener === 'function'
    ? waitForMasterMetadata(video, snapshot.src, masterMetadataTimeoutMs)
    : null;
  video.pause();
  if (requestNeeded) {
    video.src = snapshot.src;
    metadataWait?.arm();
    video.load?.();
  }
  if (metadataWait) await metadataWait.promise;
  video.currentTime = snapshot.currentTime;
  video.muted = masterMuted;
  stage.dataset.mediaAspect = snapshot.aspect;
  stage.dataset.stageProvider = snapshot.stageProvider ?? 'cinema';
  stage.dataset.mirrorWings = snapshot.mirrorWings ?? 'off';
  const context = createFollowerRestoreContext();
  const followerRestores = await Promise.all(followers.map(async (follower, index) => {
    const restored = await restoreFollowerSnapshot(follower, snapshot.followers?.[index], followerMetadataTimeoutMs, context);
    if (!restored) context.cancelPending();
    return restored;
  }));
  if (followerRestores.some((restored) => !restored)) {
    followers.forEach(safelyClearFollowerSource);
    stage.dataset.mirrorFailure = 'true';
  } else if (snapshot.hasMirrorFailure) stage.dataset.mirrorFailure = snapshot.mirrorFailure;
  else delete stage.dataset.mirrorFailure;
  if (!snapshot.paused) await video.play();
}
