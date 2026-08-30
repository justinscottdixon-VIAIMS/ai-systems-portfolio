import test from 'node:test';
import assert from 'node:assert/strict';
import {
  alignFollower,
  captureCinemaSnapshot,
  claimAudioBus,
  claimVideoBus,
  classifyMediaAspect,
  restoreCinemaSnapshot,
  usesMirrorWings,
} from '../src/lib/media-presentation.mjs';

test('classifyMediaAspect identifies portrait, landscape, square, and invalid dimensions', () => {
  assert.equal(classifyMediaAspect(1080, 1920), 'portrait');
  assert.equal(classifyMediaAspect(1920, 1080), 'landscape');
  assert.equal(classifyMediaAspect(1080, 1080), 'square');
  assert.equal(classifyMediaAspect(0, 1080), 'unknown');
  assert.equal(classifyMediaAspect(Number.NaN, 1080), 'unknown');
  assert.equal(classifyMediaAspect(undefined, undefined), 'unknown');
});

test('usesMirrorWings enables portrait and square composition only', () => {
  assert.equal(usesMirrorWings('portrait'), true);
  assert.equal(usesMirrorWings('square'), true);
  assert.equal(usesMirrorWings('landscape'), false);
  assert.equal(usesMirrorWings('unknown'), false);
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
  let currentTime = overrides.currentTime ?? 0;
  return {
    readyState: overrides.readyState ?? 4,
    paused: overrides.paused ?? true,
    muted: overrides.muted ?? true,
    metadataListenerRegisteredBeforeSourceChange: null,
    get src() {
      return src;
    },
    set src(value) {
      this.metadataListenerRegisteredBeforeSourceChange = listeners.has('loadedmetadata');
      src = value;
      this.readyState = 0;
    },
    get currentTime() {
      return currentTime;
    },
    set currentTime(value) {
      currentTime = value;
    },
    addEventListener(event, listener, { once }) {
      listeners.set(event, { listener, once });
    },
    emitLoadedMetadata() {
      this.readyState = 1;
      const registered = listeners.get('loadedmetadata');
      registered?.listener();
      if (registered?.once) listeners.delete('loadedmetadata');
    },
    load() {},
    pause() {
      this.paused = true;
    },
    async play() {
      this.paused = false;
    },
  };
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
  const stage = { dataset: { mediaAspect: 'portrait' } };
  const snapshot = captureCinemaSnapshot(video, stage);
  video.src = 'music-video.mp4'; video.currentTime = 0; video.paused = true; video.muted = true; stage.dataset.mediaAspect = 'landscape';
  await restoreCinemaSnapshot(video, stage, snapshot);
  assert.equal(video.src, 'cinema.mp4');
  assert.equal(video.currentTime, 27.5);
  assert.equal(video.muted, false);
  assert.equal(video.paused, false);
  assert.equal(stage.dataset.mediaAspect, 'portrait');
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
});
