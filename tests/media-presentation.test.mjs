import test from 'node:test';
import assert from 'node:assert/strict';
import {
  alignFollower,
  claimAudioBus,
  claimVideoBus,
  classifyMediaAspect,
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
