import test from 'node:test';
import assert from 'node:assert/strict';
import {
  alignFollower,
  alignMirrorFollowers,
  bindMirrorFollowerFailures,
  captureCinemaSnapshot,
  claimAudioBus,
  claimVideoBus,
  classifyMediaAspect,
  commitMirrorFollowers,
  prepareMirrorFollowers,
  restoreCinemaSnapshot,
} from '../src/lib/media-presentation.mjs';

test('classifyMediaAspect identifies portrait, landscape, square, and invalid dimensions', () => {
  assert.equal(classifyMediaAspect(1080, 1920), 'portrait');
  assert.equal(classifyMediaAspect(1920, 1080), 'landscape');
  assert.equal(classifyMediaAspect(1080, 1080), 'square');
  assert.equal(classifyMediaAspect(0, 1080), 'unknown');
  assert.equal(classifyMediaAspect(Number.NaN, 1080), 'unknown');
  assert.equal(classifyMediaAspect(undefined, undefined), 'unknown');
});

function media(overrides = {}) {
  return {
    currentTime: 0,
    paused: true,
    muted: true,
    playCalls: 0,
    pauseCalls: 0,
    async play() {
      this.playCalls += 1;
      this.paused = false;
    },
    pause() {
      this.pauseCalls += 1;
      this.paused = true;
    },
    ...overrides,
  };
}

function eventCapableMedia(overrides = {}) {
  const listeners = new Map();
  let src = overrides.src ?? '';
  let currentSrc = overrides.currentSrc ?? src;
  let currentTime = overrides.currentTime ?? 0;
  return {
    readyState: overrides.readyState ?? 4,
    paused: overrides.paused ?? true,
    muted: overrides.muted ?? true,
    playCalls: 0,
    loadCalls: 0,
    sourceSetCalls: 0,
    metadataListenerRegisteredBeforeSourceChange: null,
    get src() {
      return src;
    },
    set src(value) {
      this.metadataListenerRegisteredBeforeSourceChange = listeners.has('loadedmetadata');
      this.sourceSetCalls += 1;
      src = value;
      this.readyState = 0;
      overrides.onSetSource?.call(this, value);
    },
    get currentSrc() {
      return currentSrc;
    },
    get currentTime() {
      return currentTime;
    },
    set currentTime(value) {
      currentTime = value;
    },
    addEventListener(event, listener, { once = false } = {}) {
      const registered = listeners.get(event) ?? new Set();
      registered.add({ listener, once });
      listeners.set(event, registered);
    },
    removeEventListener(event, listener) {
      const registered = listeners.get(event);
      for (const entry of registered ?? []) {
        if (entry.listener === listener) registered.delete(entry);
      }
    },
    emit(event) {
      for (const entry of [...(listeners.get(event) ?? [])]) {
        entry.listener();
        if (entry.once) listeners.get(event)?.delete(entry);
      }
    },
    emitLoadedMetadata(source = src) {
      currentSrc = source;
      this.readyState = 1;
      this.emit('loadedmetadata');
    },
    emitError(source = src) {
      currentSrc = source;
      this.emit('error');
    },
    emitAbort(source = currentSrc) {
      currentSrc = source;
      this.emit('abort');
    },
    listenerCount(event) {
      return listeners.get(event)?.size ?? 0;
    },
    load() {
      this.loadCalls += 1;
      overrides.onLoad?.call(this);
    },
    pause() {
      this.paused = true;
    },
    async play() {
      this.playCalls += 1;
      this.paused = false;
    },
  };
}

function sourceManagedMedia(overrides = {}) {
  return {
    ...media(overrides),
    sourceRemoved: false,
    removeAttribute(attribute) {
      if (attribute === 'src') {
        this.sourceRemoved = true;
        this.src = '';
      }
    },
  };
}

function eventCapableFollower(overrides = {}) {
  const listeners = new Map();
  const follower = sourceManagedMedia(overrides);
  follower.addEventListener = (event, listener) => {
    const callbacks = listeners.get(event) ?? new Set();
    callbacks.add(listener);
    listeners.set(event, callbacks);
  };
  follower.removeEventListener = (event, listener) => {
    listeners.get(event)?.delete(listener);
  };
  follower.emit = (event) => {
    for (const listener of [...(listeners.get(event) ?? [])]) listener();
  };
  follower.listenerCount = (event) => listeners.get(event)?.size ?? 0;
  return follower;
}

function sourceReplacingFollower(overrides = {}) {
  const follower = eventCapableFollower(overrides);
  let src = overrides.src ?? '';
  let currentSrc = overrides.currentSrc ?? src;
  Object.defineProperties(follower, {
    src: {
      configurable: true,
      get() {
        return src;
      },
      set(value) {
        src = value;
        this.emit('abort');
      },
    },
    currentSrc: {
      configurable: true,
      get() {
        return currentSrc;
      },
    },
  });
  follower.load = () => {
    currentSrc = src;
    follower.emit('loadedmetadata');
  };
  follower.useSource = (value) => {
    src = value;
    currentSrc = value;
  };
  return follower;
}

function synchronouslySettlingFollower(overrides = {}) {
  const follower = sourceReplacingFollower(overrides);
  follower.load = () => {
    follower.useSource(follower.src);
    follower.emit('loadedmetadata');
  };
  return follower;
}

async function settlesWithin(promise, timeoutMs) {
  return Promise.race([
    promise.then(() => true),
    new Promise((resolve) => setTimeout(() => resolve(false), timeoutMs)),
  ]);
}

async function outcomeWithin(promise, timeoutMs) {
  return Promise.race([
    promise.then(
      () => 'resolved',
      (error) => `rejected:${error instanceof Error ? error.message : String(error)}`,
    ),
    new Promise((resolve) => setTimeout(() => resolve('pending'), timeoutMs)),
  ]);
}

test('alignFollower corrects drift only beyond the threshold', () => {
  const master = media({ currentTime: 18 });
  const near = media({ currentTime: 17.8 });
  const far = media({ currentTime: 17.6 });
  assert.equal(alignFollower(master, near, 0.3), false);
  assert.equal(near.currentTime, 17.8);
  assert.equal(alignFollower(master, far, 0.3), true);
  assert.equal(far.currentTime, 18);
});

test('claimAudioBus starts audio and mutes video without pausing video motion', async () => {
  const video = media({ paused: false, muted: false });
  const audio = media();
  await claimAudioBus(video, audio);
  assert.equal(video.paused, false);
  assert.equal(video.muted, true);
  assert.equal(audio.paused, false);
  assert.equal(audio.playCalls, 1);
});

test('claimAudioBus restores the prior video mute state when audio play rejects', async () => {
  const video = media({ paused: false, muted: false });
  const audio = media({
    async play() {
      throw new Error('decode failed');
    },
  });
  await assert.rejects(() => claimAudioBus(video, audio), /decode failed/);
  assert.equal(video.muted, false);
  assert.equal(video.paused, false);
});

test('claimVideoBus pauses audio before unmuting video', () => {
  const video = media({ paused: false, muted: true });
  const audio = media({ paused: false });
  claimVideoBus(video, audio);
  assert.equal(audio.paused, true);
  assert.equal(audio.pauseCalls, 1);
  assert.equal(video.muted, false);
  assert.equal(video.paused, false);
});

test('captureCinemaSnapshot and restoreCinemaSnapshot preserve exact stage state', async () => {
  const video = media({ src: 'cinema.mp4', currentTime: 27.5, paused: false, muted: false });
  const stage = {
    dataset: {
      mediaAspect: 'portrait',
      stageProvider: 'cinema',
      mirrorWings: 'on',
    },
  };
  const snapshot = captureCinemaSnapshot(video, stage);
  assert.equal(snapshot.stageProvider, 'cinema');
  assert.equal(snapshot.mirrorWings, 'on');
  video.src = 'music-video.mp4'; video.currentTime = 0; video.paused = true; video.muted = true; stage.dataset.mediaAspect = 'landscape';
  stage.dataset.stageProvider = 'music-video';
  stage.dataset.mirrorWings = 'off';
  await restoreCinemaSnapshot(video, stage, snapshot);
  assert.equal(video.src, 'cinema.mp4');
  assert.equal(video.currentTime, 27.5);
  assert.equal(video.muted, false);
  assert.equal(video.paused, false);
  assert.equal(stage.dataset.mediaAspect, 'portrait');
  assert.equal(stage.dataset.stageProvider, 'cinema');
  assert.equal(stage.dataset.mirrorWings, 'on');
});

test('restoreCinemaSnapshot can keep an audible Cinema snapshot muted before resuming motion', async () => {
  let mutedAtPlay = null;
  const video = media({
    src: 'cinema.mp4', currentTime: 0, paused: true, muted: true,
    async play() {
      this.playCalls += 1;
      mutedAtPlay = this.muted;
      this.paused = false;
    },
  });
  const stage = { dataset: { mediaAspect: 'landscape' } };
  const snapshot = {
    src: 'cinema.mp4', currentTime: 27.5, paused: false, muted: false,
    aspect: 'portrait', stageProvider: 'cinema', mirrorWings: 'on',
    hasMirrorFailure: false, mirrorFailure: undefined, followers: [],
  };

  await restoreCinemaSnapshot(video, stage, snapshot, [], { masterMuted: true });

  assert.equal(video.muted, true);
  assert.equal(mutedAtPlay, true);
  assert.equal(video.paused, false);
  assert.equal(snapshot.muted, false);
});

test('captureCinemaSnapshot and restoreCinemaSnapshot preserve a prior mirror failure', async () => {
  const video = media({ src: 'cinema.mp4' });
  const stage = { dataset: { mediaAspect: 'portrait', mirrorFailure: 'true' } };
  const snapshot = captureCinemaSnapshot(video, stage);
  delete stage.dataset.mirrorFailure;
  await restoreCinemaSnapshot(video, stage, snapshot);
  assert.equal(snapshot.mirrorFailure, 'true');
  assert.equal(stage.dataset.mirrorFailure, 'true');
});

test('restoreCinemaSnapshot removes a lease-time mirror failure absent from the snapshot', async () => {
  const video = media({ src: 'cinema.mp4' });
  const stage = { dataset: { mediaAspect: 'portrait' } };
  const snapshot = captureCinemaSnapshot(video, stage);
  stage.dataset.mirrorFailure = 'true';
  await restoreCinemaSnapshot(video, stage, snapshot);
  assert.equal('mirrorFailure' in stage.dataset, false);
});

test('restoreCinemaSnapshot waits for changed-source metadata before seeking', async () => {
  const video = eventCapableMedia({ src: 'lease-video.mp4', currentTime: 0, paused: true, muted: true });
  const stage = { dataset: { mediaAspect: 'landscape' } };
  const snapshot = { src: 'cinema.mp4', currentTime: 27.5, paused: true, muted: false, aspect: 'portrait', hasMirrorFailure: false };
  const restoring = restoreCinemaSnapshot(video, stage, snapshot);
  assert.equal(video.metadataListenerRegisteredBeforeSourceChange, true);
  assert.equal(video.currentTime, 0);
  video.emitLoadedMetadata();
  await restoring;
  assert.equal(video.currentTime, 27.5);
  assert.equal(video.listenerCount('loadedmetadata'), 0);
  assert.equal(video.listenerCount('error'), 0);
  assert.equal(video.listenerCount('abort'), 0);
});

test('changed master source metadata error rejects restoration and cleans listeners', async () => {
  const video = eventCapableMedia({ src: 'lease-video.mp4', currentTime: 0, paused: false, muted: false });
  const stage = { dataset: { mediaAspect: 'landscape' } };
  const snapshot = { src: 'cinema.mp4', currentTime: 27.5, paused: false, muted: true, aspect: 'portrait', hasMirrorFailure: false };
  const restoring = restoreCinemaSnapshot(video, stage, snapshot, [], { masterMetadataTimeoutMs: 50 });
  video.emitError('cinema.mp4');
  assert.match(await outcomeWithin(restoring, 40), /^rejected:Cinema metadata error/);
  assert.equal(video.currentTime, 0);
  assert.equal(video.listenerCount('loadedmetadata'), 0);
  assert.equal(video.listenerCount('error'), 0);
  assert.equal(video.listenerCount('abort'), 0);
});

test('source-mismatched loadedmetadata cannot settle changed master restoration', async () => {
  const video = eventCapableMedia({ src: 'lease-video.mp4', currentTime: 0, paused: false, muted: false });
  const stage = { dataset: { mediaAspect: 'landscape' } };
  const snapshot = { src: 'cinema.mp4', currentTime: 27.5, paused: true, muted: true, aspect: 'portrait', hasMirrorFailure: false };
  const restoring = restoreCinemaSnapshot(video, stage, snapshot, [], { masterMetadataTimeoutMs: 50 });
  video.emitLoadedMetadata('stale-lease-video.mp4');
  await Promise.resolve();
  assert.equal(video.currentTime, 0);
  assert.equal(video.listenerCount('loadedmetadata'), 1);
  video.emitLoadedMetadata('cinema.mp4');
  await restoring;
  assert.equal(video.currentTime, 27.5);
  assert.equal(video.listenerCount('loadedmetadata'), 0);
  assert.equal(video.listenerCount('error'), 0);
  assert.equal(video.listenerCount('abort'), 0);
});

test('requested master source is restored even when currentSrc still reports the prior lease', async () => {
  const video = eventCapableMedia({
    src: 'lease-b.mp4', currentSrc: 'lease-a.mp4', currentTime: 0, paused: false, muted: false,
  });
  const stage = { dataset: { mediaAspect: 'landscape' } };
  const snapshot = { src: 'lease-a.mp4', currentTime: 18.25, paused: false, muted: false, aspect: 'portrait', hasMirrorFailure: false };
  const restoring = restoreCinemaSnapshot(video, stage, snapshot, [], { masterMetadataTimeoutMs: 50 });
  assert.equal(video.metadataListenerRegisteredBeforeSourceChange, true);
  assert.equal(video.src, 'lease-a.mp4');
  assert.equal(video.currentTime, 0);
  video.emitLoadedMetadata('lease-a.mp4');
  await restoring;
  assert.equal(video.currentTime, 18.25);
  assert.equal(video.listenerCount('loadedmetadata'), 0);
  assert.equal(video.listenerCount('error'), 0);
  assert.equal(video.listenerCount('abort'), 0);
});

test('synchronous outgoing abort before target request is armed does not reject restoration', async () => {
  const video = eventCapableMedia({
    src: 'lease-b.mp4',
    currentSrc: 'lease-a.mp4',
    currentTime: 0,
    paused: false,
    muted: false,
    onSetSource(value) {
      if (value === 'lease-a.mp4') this.emit('abort');
    },
    onLoad() {
      this.emitLoadedMetadata('lease-a.mp4');
    },
  });
  const stage = { dataset: { mediaAspect: 'landscape' } };
  const snapshot = { src: 'lease-a.mp4', currentTime: 18.25, paused: false, muted: false, aspect: 'portrait', hasMirrorFailure: false };
  await assert.doesNotReject(() => restoreCinemaSnapshot(video, stage, snapshot, [], { masterMetadataTimeoutMs: 20 }));
  assert.equal(video.metadataListenerRegisteredBeforeSourceChange, true);
  assert.equal(video.sourceSetCalls, 1);
  assert.equal(video.loadCalls, 1);
  assert.equal(video.currentSrc, 'lease-a.mp4');
  assert.equal(video.currentTime, 18.25);
  assert.equal(video.playCalls, 1);
  assert.equal(video.listenerCount('loadedmetadata'), 0);
  assert.equal(video.listenerCount('error'), 0);
  assert.equal(video.listenerCount('abort'), 0);
});

test('stale selected source and readiness force an already-requested target to reload before seek and play', async () => {
  const video = eventCapableMedia({
    src: 'cinema-a.mp4',
    currentSrc: 'lease-b.mp4',
    readyState: 0,
    currentTime: 0,
    paused: false,
    muted: false,
    onLoad() {
      this.emitLoadedMetadata('cinema-a.mp4');
    },
  });
  const stage = { dataset: { mediaAspect: 'landscape' } };
  const snapshot = { src: 'cinema-a.mp4', currentTime: 27.5, paused: false, muted: true, aspect: 'portrait', hasMirrorFailure: false };
  await restoreCinemaSnapshot(video, stage, snapshot, [], { masterMetadataTimeoutMs: 20 });
  assert.equal(video.metadataListenerRegisteredBeforeSourceChange, true);
  assert.equal(video.sourceSetCalls, 1);
  assert.equal(video.loadCalls, 1);
  assert.equal(video.currentSrc, 'cinema-a.mp4');
  assert.equal(video.currentTime, 27.5);
  assert.equal(video.muted, true);
  assert.equal(video.playCalls, 1);
  assert.equal(video.listenerCount('loadedmetadata'), 0);
  assert.equal(video.listenerCount('error'), 0);
  assert.equal(video.listenerCount('abort'), 0);
});

test('target-source master abort rejects restoration and cleans listeners', async () => {
  const video = eventCapableMedia({ src: 'lease-video.mp4', currentTime: 0, paused: false, muted: false });
  const stage = { dataset: { mediaAspect: 'landscape' } };
  const snapshot = { src: 'cinema.mp4', currentTime: 27.5, paused: false, muted: true, aspect: 'portrait', hasMirrorFailure: false };
  const restoring = restoreCinemaSnapshot(video, stage, snapshot, [], { masterMetadataTimeoutMs: 50 });
  video.emitAbort('cinema.mp4');
  assert.match(await outcomeWithin(restoring, 40), /^rejected:Cinema metadata aborted/);
  assert.equal(video.currentTime, 0);
  assert.equal(video.listenerCount('loadedmetadata'), 0);
  assert.equal(video.listenerCount('error'), 0);
  assert.equal(video.listenerCount('abort'), 0);
});

test('changed master source metadata timeout rejects without hanging', async () => {
  const video = eventCapableMedia({ src: 'lease-video.mp4', currentTime: 0, paused: false, muted: false });
  const stage = { dataset: { mediaAspect: 'landscape' } };
  const snapshot = { src: 'cinema.mp4', currentTime: 27.5, paused: false, muted: true, aspect: 'portrait', hasMirrorFailure: false };
  const restoring = restoreCinemaSnapshot(video, stage, snapshot, [], { masterMetadataTimeoutMs: 5 });
  assert.match(await outcomeWithin(restoring, 40), /^rejected:Cinema metadata timeout/);
  assert.equal(video.currentTime, 0);
  assert.equal(video.listenerCount('loadedmetadata'), 0);
  assert.equal(video.listenerCount('error'), 0);
  assert.equal(video.listenerCount('abort'), 0);
});

test('captureCinemaSnapshot and restoreCinemaSnapshot preserve two active mirror followers', async () => {
  const video = media({ src: 'cinema.mp4', currentTime: 27.5, paused: false, muted: false });
  const stage = { dataset: { mediaAspect: 'portrait' } };
  const followers = [
    media({ src: 'left.mp4', currentTime: 11.25, paused: false, muted: true, hidden: false }),
    media({ src: 'right.mp4', currentTime: 18.5, paused: false, muted: false, hidden: false }),
  ];
  const snapshot = captureCinemaSnapshot(video, stage, null, followers);
  video.src = 'lease.mp4'; video.currentTime = 0; video.paused = true; video.muted = true;
  for (const follower of followers) {
    follower.src = 'lease-follower.mp4'; follower.currentTime = 0; follower.paused = true; follower.muted = true; follower.hidden = true;
  }
  await restoreCinemaSnapshot(video, stage, snapshot, followers);
  assert.deepEqual(snapshot.followers, [
    { src: 'left.mp4', currentTime: 11.25, paused: false, muted: true, hidden: false },
    { src: 'right.mp4', currentTime: 18.5, paused: false, muted: false, hidden: false },
  ]);
  assert.deepEqual(followers.map(({ src, currentTime, paused, muted, hidden }) => ({ src, currentTime, paused, muted, hidden })), snapshot.followers);
});

test('restoreCinemaSnapshot returns failed hidden followers to their source-free snapshot', async () => {
  const video = media({ src: 'cinema.mp4', currentTime: 27.5, paused: false, muted: false });
  const stage = { dataset: { mediaAspect: 'portrait', mirrorFailure: 'true' } };
  const followers = [
    sourceManagedMedia({ src: '', currentTime: 0, paused: true, muted: true, hidden: true }),
    sourceManagedMedia({ src: '', currentTime: 0, paused: true, muted: true, hidden: true }),
  ];
  const snapshot = captureCinemaSnapshot(video, stage, null, followers);
  for (const follower of followers) {
    follower.src = 'lease-follower.mp4'; follower.currentTime = 9; follower.paused = false; follower.muted = false; follower.hidden = false;
  }
  delete stage.dataset.mirrorFailure;
  await restoreCinemaSnapshot(video, stage, snapshot, followers);
  for (const follower of followers) {
    assert.equal(follower.sourceRemoved, true);
    assert.equal(follower.src, '');
    assert.equal(follower.paused, true);
    assert.equal(follower.hidden, true);
  }
  assert.equal(stage.dataset.mirrorFailure, 'true');
});

test('a follower play rejection does not prevent Cinema restoration', async () => {
  const video = media({ src: 'cinema.mp4', currentTime: 27.5, paused: false, muted: false });
  const stage = { dataset: { mediaAspect: 'portrait' } };
  const follower = media({
    src: 'left.mp4', currentTime: 11.25, paused: false, muted: true, hidden: false,
    async play() {
      this.playCalls += 1;
      throw new Error('decorative autoplay denied');
    },
  });
  const snapshot = captureCinemaSnapshot(video, stage, null, [follower]);
  video.src = 'lease.mp4'; video.currentTime = 0; video.paused = true; video.muted = true;
  follower.src = 'lease-follower.mp4'; follower.currentTime = 0; follower.paused = true; follower.muted = false; follower.hidden = true;
  await assert.doesNotReject(() => restoreCinemaSnapshot(video, stage, snapshot, [follower]));
  assert.equal(video.src, 'cinema.mp4');
  assert.equal(video.currentTime, 27.5);
  assert.equal(video.paused, false);
  assert.equal(follower.playCalls, 1);
});

test('a follower metadata error isolates failed mirrors and resumes Cinema', async () => {
  const video = media({ src: 'cinema.mp4', currentTime: 27.5, paused: false, muted: false });
  const stage = { dataset: { mediaAspect: 'portrait' } };
  const follower = eventCapableFollower({ src: 'left.mp4', currentTime: 11.25, paused: false, muted: true, hidden: false });
  const snapshot = captureCinemaSnapshot(video, stage, null, [follower]);
  video.src = 'lease.mp4'; video.currentTime = 0; video.paused = true; video.muted = true;
  follower.src = 'lease-follower.mp4'; follower.currentTime = 0; follower.paused = true; follower.hidden = true;
  const restoring = restoreCinemaSnapshot(video, stage, snapshot, [follower]);
  await Promise.resolve();
  assert.equal(follower.listenerCount('loadedmetadata'), 1);
  assert.equal(follower.listenerCount('error'), 1);
  assert.equal(follower.listenerCount('abort'), 1);
  follower.emit('error');
  await restoring;
  assert.equal(video.src, 'cinema.mp4');
  assert.equal(video.paused, false);
  assert.equal(follower.sourceRemoved, true);
  assert.equal(follower.src, '');
  assert.equal(follower.paused, true);
  assert.equal(stage.dataset.mirrorFailure, 'true');
  assert.equal(follower.listenerCount('loadedmetadata'), 0);
  assert.equal(follower.listenerCount('error'), 0);
  assert.equal(follower.listenerCount('abort'), 0);
});

test('a follower metadata timeout isolates failed mirrors and resumes Cinema', async () => {
  const video = media({ src: 'cinema.mp4', currentTime: 27.5, paused: false, muted: false });
  const stage = { dataset: { mediaAspect: 'portrait' } };
  const follower = eventCapableFollower({ src: 'left.mp4', currentTime: 11.25, paused: false, muted: true, hidden: false });
  const snapshot = captureCinemaSnapshot(video, stage, null, [follower]);
  video.src = 'lease.mp4'; video.currentTime = 0; video.paused = true; video.muted = true;
  follower.src = 'lease-follower.mp4'; follower.currentTime = 0; follower.paused = true; follower.hidden = true;
  const restoring = restoreCinemaSnapshot(video, stage, snapshot, [follower], { followerMetadataTimeoutMs: 5 });
  assert.equal(await settlesWithin(restoring, 40), true);
  assert.equal(video.src, 'cinema.mp4');
  assert.equal(video.paused, false);
  assert.equal(follower.sourceRemoved, true);
  assert.equal(follower.src, '');
  assert.equal(follower.paused, true);
  assert.equal(stage.dataset.mirrorFailure, 'true');
  assert.equal(follower.listenerCount('loadedmetadata'), 0);
  assert.equal(follower.listenerCount('error'), 0);
  assert.equal(follower.listenerCount('abort'), 0);
});

test('an outgoing-source abort during follower replacement does not fail restored mirrors', async () => {
  const video = media({ src: 'cinema.mp4', currentTime: 27.5, paused: false, muted: false });
  const stage = { dataset: { mediaAspect: 'portrait' } };
  const follower = sourceReplacingFollower({ src: 'cinema-wing.mp4', currentTime: 11.25, paused: false, muted: true, hidden: false });
  const snapshot = captureCinemaSnapshot(video, stage, null, [follower]);
  follower.useSource('lease-wing.mp4'); follower.currentTime = 0; follower.paused = true; follower.hidden = true;
  await restoreCinemaSnapshot(video, stage, snapshot, [follower], { followerMetadataTimeoutMs: 20 });
  assert.equal(video.paused, false);
  assert.equal(follower.sourceRemoved, false);
  assert.equal(follower.src, 'cinema-wing.mp4');
  assert.equal(follower.currentSrc, 'cinema-wing.mp4');
  assert.equal(follower.paused, false);
  assert.equal('mirrorFailure' in stage.dataset, false);
  assert.equal(follower.listenerCount('loadedmetadata'), 0);
  assert.equal(follower.listenerCount('error'), 0);
  assert.equal(follower.listenerCount('abort'), 0);
});

test('synchronous follower listener settlement leaves no later registrations behind', async () => {
  const video = media({ src: 'cinema.mp4', currentTime: 27.5, paused: false, muted: false });
  const stage = { dataset: { mediaAspect: 'portrait' } };
  const follower = synchronouslySettlingFollower({ src: 'cinema-wing.mp4', currentTime: 11.25, paused: false, muted: true, hidden: false });
  const snapshot = captureCinemaSnapshot(video, stage, null, [follower]);
  follower.src = 'lease-wing.mp4'; follower.currentTime = 0; follower.paused = true; follower.hidden = true;
  await restoreCinemaSnapshot(video, stage, snapshot, [follower], { followerMetadataTimeoutMs: 20 });
  assert.equal(follower.listenerCount('loadedmetadata'), 0);
  assert.equal(follower.listenerCount('error'), 0);
  assert.equal(follower.listenerCount('abort'), 0);
  assert.equal(video.paused, false);
  assert.equal('mirrorFailure' in stage.dataset, false);
});

test('stale follower metadata cannot settle restoration for the outgoing source', async () => {
  const video = media({ src: 'cinema.mp4', paused: true });
  const stage = { dataset: { mediaAspect: 'portrait' } };
  const follower = sourceReplacingFollower({ src: 'cinema-wing.mp4', currentTime: 8, paused: true });
  const snapshot = captureCinemaSnapshot(video, stage, null, [follower]);
  follower.useSource('lease-wing.mp4');
  follower.load = () => {};

  const restoring = restoreCinemaSnapshot(video, stage, snapshot, [follower], { followerMetadataTimeoutMs: 50 });
  follower.emit('loadedmetadata');
  assert.equal(await settlesWithin(restoring, 5), false);
  follower.useSource('cinema-wing.mp4');
  follower.emit('loadedmetadata');
  await restoring;
  assert.equal(stage.dataset.mirrorFailure, undefined);
});

test('follower-local seek failure remains isolated from authoritative Cinema restoration', async () => {
  const video = media({ src: 'cinema.mp4', paused: true });
  const stage = { dataset: { mediaAspect: 'portrait' } };
  const follower = media({ src: 'cinema.mp4', paused: true });
  const snapshot = captureCinemaSnapshot(video, stage, null, [follower]);
  Object.defineProperty(follower, 'currentTime', { set() { throw new Error('follower seek failed'); } });
  await assert.doesNotReject(() => restoreCinemaSnapshot(video, stage, snapshot, [follower]));
  assert.equal(stage.dataset.mirrorFailure, 'true');
  assert.equal(follower.src, '');
});

test('coordinated Mirror Wing preparation clears both followers when either is not ready', async () => {
  const master = media({ src: 'cinema.mp4', paused: true, currentTime: 12 });
  const ready = eventCapableFollower({ src: '', currentSrc: '', paused: true });
  const failed = eventCapableFollower({ src: '', currentSrc: '', paused: true });
  ready.load = () => { ready.currentSrc = 'cinema.mp4'; ready.emit('loadedmetadata'); };
  failed.load = () => { failed.currentSrc = 'cinema.mp4'; failed.emit('error'); };
  const prepared = await prepareMirrorFollowers(master, [ready, failed], { metadataTimeoutMs: 20 });
  assert.equal(prepared, false);
  assert.equal(ready.src, '');
  assert.equal(failed.src, '');
});

test('Mirror Wing preparation keeps both followers hidden and paused until an atomic commit', async () => {
  const master = media({ src: 'cinema.mp4', paused: false, currentTime: 12 });
  const left = synchronouslySettlingFollower({ src: '', currentSrc: '', paused: true, hidden: false });
  const right = synchronouslySettlingFollower({ src: '', currentSrc: '', paused: true, hidden: false });

  assert.equal(await prepareMirrorFollowers(master, [left, right]), true);
  assert.equal(left.hidden, true);
  assert.equal(right.hidden, true);
  assert.equal(left.paused, true);
  assert.equal(right.paused, true);

  assert.equal(await commitMirrorFollowers(master, [left, right], { isCurrent: () => true }), true);
  assert.equal(left.hidden, false);
  assert.equal(right.hidden, false);
  assert.equal(left.playCalls, 1);
  assert.equal(right.playCalls, 1);
});

test('a stale in-flight Mirror Wing activation never reveals or restarts followers', async () => {
  let releasePlay;
  let current = true;
  const master = media({ src: 'cinema.mp4', paused: false });
  const left = media({ src: 'cinema.mp4', hidden: true, play: async function () {
    this.playCalls += 1;
    await new Promise((resolve) => { releasePlay = resolve; });
    this.paused = false;
  } });
  const right = media({ src: 'cinema.mp4', hidden: true });

  const committing = commitMirrorFollowers(master, [left, right], { isCurrent: () => current });
  await Promise.resolve();
  current = false;
  releasePlay();

  assert.equal(await committing, false);
  assert.equal(left.hidden, true);
  assert.equal(right.hidden, true);
  assert.equal(left.paused, true);
  assert.equal(right.paused, true);
});

test('an older activation cannot hide followers after a newer generation commits', async () => {
  let releaseOldPlay;
  let playAttempt = 0;
  let owner = 'old';
  const master = media({ src: 'cinema.mp4', paused: false });
  const followers = [media({ src: 'cinema.mp4', hidden: true }), media({ src: 'cinema.mp4', hidden: true })];
  followers[0].play = async function () {
    this.playCalls += 1;
    playAttempt += 1;
    if (playAttempt === 1) await new Promise((resolve) => { releaseOldPlay = resolve; });
    this.paused = false;
  };

  const oldCommit = commitMirrorFollowers(master, followers, {
    isCurrent: () => owner === 'old',
    shouldCleanupStale: () => owner === null,
  });
  await Promise.resolve();
  owner = 'new';
  assert.equal(await commitMirrorFollowers(master, followers, { isCurrent: () => owner === 'new' }), true);
  releaseOldPlay();
  assert.equal(await oldCommit, false);
  assert.equal(followers.every((follower) => follower.hidden === false), true);
  assert.equal(followers.every((follower) => follower.paused === false), true);
});

test('an older rejected activation cannot hide followers after a newer generation commits', async () => {
  let rejectOldPlay;
  let playAttempt = 0;
  let owner = 'old';
  const master = media({ src: 'cinema.mp4', paused: false });
  const followers = [media({ src: 'cinema.mp4', hidden: true }), media({ src: 'cinema.mp4', hidden: true })];
  followers[0].play = async function () {
    this.playCalls += 1;
    playAttempt += 1;
    if (playAttempt === 1) await new Promise((resolve, reject) => { rejectOldPlay = reject; });
    this.paused = false;
  };

  const oldCommit = commitMirrorFollowers(master, followers, {
    isCurrent: () => owner === 'old',
    shouldCleanupStale: () => owner === null,
  });
  await Promise.resolve();
  owner = 'new';
  assert.equal(await commitMirrorFollowers(master, followers, { isCurrent: () => owner === 'new' }), true);
  rejectOldPlay(new Error('old source aborted'));
  assert.equal(await oldCommit, false);
  assert.equal(followers.every((follower) => follower.hidden === false), true);
  assert.equal(followers.every((follower) => follower.paused === false), true);
});

test('Mirror Wing alignment isolates a throwing follower seek and fails the balanced pair', () => {
  const master = media({ currentTime: 20 });
  const left = media({ currentTime: 0 });
  Object.defineProperty(left, 'currentTime', { configurable: true, get: () => 0, set() { throw new Error('seek'); } });
  const right = media({ currentTime: 0 });
  let failures = 0;

  assert.equal(alignMirrorFollowers(master, [left, right], { active: true, onFailure: () => { failures += 1; } }), false);
  assert.equal(failures, 1);
});

test('a persistent follower media error routes through balanced failure isolation', () => {
  const left = eventCapableFollower();
  const right = eventCapableFollower();
  let failures = 0;
  bindMirrorFollowerFailures([left, right], () => { failures += 1; });

  right.emit('error');
  assert.equal(failures, 1);
});
