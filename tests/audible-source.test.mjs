import test from 'node:test';
import assert from 'node:assert/strict';
import * as audibleSource from '../src/lib/audible-source.mjs';

const {
  claimCinemaAudio,
  createAudibleSource,
  removeAudibleProvider,
  restorePriorAudio,
  selectAudibleTrack,
} = audibleSource;

test('audible element kind maps only ambient and Music Audio states', () => {
  assert.equal(typeof audibleSource.audibleElementKind, 'function');
  assert.equal(audibleSource.audibleElementKind(null), null);
  assert.equal(audibleSource.audibleElementKind(createAudibleSource()), null);
  assert.equal(audibleSource.audibleElementKind(createAudibleSource({ provider: 'cinema', mode: 'video' })), null);
  assert.equal(audibleSource.audibleElementKind(createAudibleSource({ provider: 'music', id: 'song-video', mode: 'video' })), null);
  assert.equal(audibleSource.audibleElementKind(createAudibleSource({ provider: 'media', id: 'media-video', mode: 'video' })), null);
  assert.equal(audibleSource.audibleElementKind(createAudibleSource({ provider: 'ambient', id: 'viaims-ambient', mode: 'audio' })), 'ambient');
  assert.equal(audibleSource.audibleElementKind(createAudibleSource({ provider: 'music', id: 'song-a', mode: 'audio' })), 'music');
});

test('ambient starts as the reversible audible source after entry', () => {
  const state = createAudibleSource({ provider: 'ambient', id: 'viaims-ambient', mode: 'audio' });
  assert.deepEqual(state, {
    current: { provider: 'ambient', id: 'viaims-ambient', mode: 'audio', currentTime: 0 },
    suspended: null,
  });
});

test('claiming Cinema suspends the exact ambient or Music position', () => {
  const music = selectAudibleTrack(createAudibleSource(), {
    provider: 'music', id: 'song-a', mode: 'audio', currentTime: 38.25,
  });
  const cinema = claimCinemaAudio(music);
  assert.deepEqual(cinema.current, { provider: 'cinema', id: null, mode: 'video', currentTime: 0 });
  assert.deepEqual(cinema.suspended, { provider: 'music', id: 'song-a', mode: 'audio', currentTime: 38.25 });
});

test('releasing Cinema restores the exact prior source and position', () => {
  const ambient = createAudibleSource({ provider: 'ambient', id: 'viaims-ambient', mode: 'audio', currentTime: 12.5 });
  const restored = restorePriorAudio(claimCinemaAudio(ambient));
  assert.deepEqual(restored.current, { provider: 'ambient', id: 'viaims-ambient', mode: 'audio', currentTime: 12.5 });
  assert.equal(restored.suspended, null);
});

test('manual Music selection replaces ambient authority and clears stale suspension', () => {
  const state = selectAudibleTrack(claimCinemaAudio(createAudibleSource({
    provider: 'ambient', id: 'viaims-ambient', mode: 'audio', currentTime: 9,
  })), { provider: 'music', id: 'song-b', mode: 'audio', currentTime: 0 });
  assert.equal(state.current.provider, 'music');
  assert.equal(state.current.id, 'song-b');
  assert.equal(state.suspended, null);
});

test('claim and restore are idempotent outside their valid state', () => {
  const empty = createAudibleSource();
  assert.deepEqual(restorePriorAudio(empty), empty);
  const cinema = claimCinemaAudio(empty);
  assert.deepEqual(claimCinemaAudio(cinema), cinema);
});

test('ambient runtime failure removes current or suspended ambient authority', () => {
  const currentAmbient = createAudibleSource({
    provider: 'ambient', id: 'viaims-ambient', mode: 'audio', currentTime: 12,
  });
  assert.deepEqual(removeAudibleProvider(currentAmbient, 'ambient'), createAudibleSource());

  const suspendedAmbient = claimCinemaAudio(currentAmbient);
  assert.deepEqual(removeAudibleProvider(suspendedAmbient, 'ambient'), {
    current: { provider: 'cinema', id: null, mode: 'video', currentTime: 0 },
    suspended: null,
  });

  const music = selectAudibleTrack(currentAmbient, {
    provider: 'music', id: 'song-a', mode: 'audio', currentTime: 4,
  });
  assert.deepEqual(removeAudibleProvider(music, 'ambient'), music);
});
