import test from 'node:test';
import assert from 'node:assert/strict';
import {
  activateSource,
  createPlaybackSession,
  releaseStageLease,
  selectBrowseTab,
} from '../src/lib/playback-session.mjs';

const snapshot = { src: 'cinema.mp4', currentTime: 42, paused: false, muted: false, aspect: 'portrait' };

test('changing tabs never changes active playback', () => {
  const session = createPlaybackSession({ cinemaId: 'atlas' });
  const browsed = selectBrowseTab(session, 'youtube');
  assert.equal(browsed.activeTab, 'youtube');
  assert.deepEqual(browsed.playback, session.playback);
});

test('Music audio owns the audible bus without taking the stage', () => {
  const session = activateSource(createPlaybackSession({ cinemaId: 'atlas' }), { provider: 'music', id: 'north', mode: 'audio' });
  assert.equal(session.playback.audibleOwner, 'music');
  assert.equal(session.playback.stageOwner, 'cinema');
  assert.equal(session.lease, null);
});

test('Music audio requires releasing an active stage lease first', () => {
  const leased = activateSource(createPlaybackSession({ cinemaId: 'atlas' }), { provider: 'music', id: 'north', mode: 'video', snapshot });
  assert.throws(
    () => activateSource(leased, { provider: 'music', id: 'north', mode: 'audio' }),
    /releaseStageLease/,
  );
});

test('Music video and Media acquire a lease while direct switching retains the snapshot', () => {
  let session = activateSource(createPlaybackSession({ cinemaId: 'atlas' }), { provider: 'music', id: 'north', mode: 'video', snapshot });
  assert.equal(session.playback.stageOwner, 'music');
  assert.deepEqual(session.lease.snapshot, snapshot);
  session = activateSource(session, { provider: 'media', id: 'reel', mode: 'video' });
  assert.equal(session.playback.stageOwner, 'media');
  assert.deepEqual(session.lease.snapshot, snapshot);
});

test('release restores Cinema ownership and exposes the saved snapshot', () => {
  const leased = activateSource(createPlaybackSession({ cinemaId: 'atlas' }), { provider: 'music', id: 'north', mode: 'video', snapshot });
  const released = releaseStageLease(leased);
  assert.equal(released.session.playback.stageOwner, 'cinema');
  assert.equal(released.session.playback.audibleOwner, snapshot.muted ? null : 'cinema');
  assert.deepEqual(released.snapshot, snapshot);
});

test('YouTube is audible but explicitly not meterable', () => {
  const session = activateSource(createPlaybackSession({ cinemaId: 'atlas' }), { provider: 'youtube', id: 'mix', mode: 'external', snapshot });
  assert.equal(session.playback.audibleOwner, 'youtube');
  assert.equal(session.playback.meterSource, null);
  assert.equal(session.playback.meterStatus, 'external-unavailable');
});
