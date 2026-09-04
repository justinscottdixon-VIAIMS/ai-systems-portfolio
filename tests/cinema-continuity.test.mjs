import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceCinema,
  createCinemaContinuity,
  createCinemaEndedToken,
  isCurrentCinemaEndedToken,
  selectCinema,
} from '../src/lib/cinema-continuity.mjs';

const items = [
  { id: 'atlas-1', src: 'https://cdn.example/1.mp4' },
  { id: 'atlas-2', src: 'https://cdn.example/2.mp4' },
  { id: 'atlas-3', src: 'https://cdn.example/3.mp4' },
];

test('Cinema selection and natural ending wrap independently of audible ownership', () => {
  let cinema = createCinemaContinuity(items);
  assert.equal(cinema.currentId, 'atlas-1');
  cinema = selectCinema(cinema, 2);
  assert.equal(cinema.currentId, 'atlas-3');
  cinema = advanceCinema(cinema, 1);
  assert.equal(cinema.currentId, 'atlas-1');
});

test('Cinema ended token depends on Cinema identity and source, not Music playback', () => {
  const cinema = createCinemaContinuity(items);
  const token = createCinemaEndedToken(cinema, items[0].src);
  const audiblePlayback = { provider: 'music', id: 'song-a', mode: 'audio' };
  assert.equal(isCurrentCinemaEndedToken(token, cinema, items[0].src), true);
  assert.equal(audiblePlayback.provider, 'music');
  assert.equal(isCurrentCinemaEndedToken(token, selectCinema(cinema, 1), items[1].src), false);
});

test('stale ended events cannot advance a newly selected Cinema item', () => {
  const first = createCinemaContinuity(items);
  const stale = createCinemaEndedToken(first, items[0].src);
  const second = selectCinema(first, 1);
  assert.equal(isCurrentCinemaEndedToken(stale, second, items[1].src), false);
});

test('empty Cinema libraries remain safe and inert', () => {
  const cinema = createCinemaContinuity([]);
  assert.equal(cinema.currentId, null);
  assert.equal(advanceCinema(cinema, 1).currentId, null);
});
