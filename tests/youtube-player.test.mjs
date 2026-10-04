import test from 'node:test';
import assert from 'node:assert/strict';

import { startYoutubePlayback } from '../src/lib/youtube-player.mjs';

test('YouTube mute is applied and confirmed before autoplay', async () => {
  const calls = [];
  let muted = false;
  const player = { mute() { calls.push('mute'); muted = true; }, isMuted() { return muted; }, playVideo() { calls.push('play'); } };
  await startYoutubePlayback(player, true);
  assert.deepEqual(calls, ['mute', 'play']);
});

test('YouTube does not autoplay if mute was not applied', async () => {
  let played = false;
  await startYoutubePlayback({ mute() {}, isMuted() { return false; }, playVideo() { played = true; } }, true, { wait: async () => {} });
  assert.equal(played, false);
});

test('YouTube honors an explicitly audible master before playback', async () => {
  const calls = [];
  await startYoutubePlayback({ unMute() { calls.push('unmute'); }, playVideo() { calls.push('play'); } }, false);
  assert.deepEqual(calls, ['unmute', 'play']);
});

test('YouTube waits for the iframe mute acknowledgement', async () => {
  let muted = false;
  let waits = 0;
  let played = false;
  await startYoutubePlayback({ mute() {}, isMuted() { return muted; }, playVideo() { assert.equal(muted, true); played = true; } }, true, {
    wait: async () => { waits++; muted = true; },
  });
  assert.equal(waits, 1);
  assert.equal(played, true);
});

test('a superseded YouTube selection cannot start after its mute acknowledgement', async () => {
  let current = true;
  let played = false;
  await startYoutubePlayback({ mute() {}, isMuted() { return false; }, playVideo() { played = true; } }, true, {
    isCurrent: () => current,
    wait: async () => { current = false; },
  });
  assert.equal(played, false);
});
