import test from 'node:test';
import assert from 'node:assert/strict';
import {
  playlistDragTarget,
  playlistScrollTarget,
  playlistWheelTarget,
} from '../src/lib/playlist-scroll.mjs';

const base = { scrollTop: 108, rowStep: 54, viewportHeight: 276, scrollHeight: 920 };

test('playlist arrow keys move exactly one provider row', () => {
  assert.equal(playlistScrollTarget({ ...base, key: 'ArrowDown' }), 162);
  assert.equal(playlistScrollTarget({ ...base, key: 'ArrowUp' }), 54);
});

test('playlist page keys move one visible tray and clamp to its range', () => {
  assert.equal(playlistScrollTarget({ ...base, key: 'PageDown' }), 384);
  assert.equal(playlistScrollTarget({ ...base, key: 'PageUp' }), 0);
  assert.equal(playlistScrollTarget({ ...base, key: 'End' }), 644);
  assert.equal(playlistScrollTarget({ ...base, key: 'Home' }), 0);
});

test('wheel targets normalize pixel line and page delta modes', () => {
  assert.equal(playlistWheelTarget({ ...base, deltaY: 40, deltaMode: 0 }), 148);
  assert.equal(playlistWheelTarget({ ...base, deltaY: 2, deltaMode: 1 }), 216);
  assert.equal(playlistWheelTarget({ ...base, deltaY: 1, deltaMode: 2 }), 384);
});

test('wheel targets return null when the playlist cannot move in that direction', () => {
  assert.equal(playlistWheelTarget({ ...base, scrollTop: 0, deltaY: -1, deltaMode: 1 }), null);
  assert.equal(playlistWheelTarget({ ...base, scrollTop: 644, deltaY: 1, deltaMode: 2 }), null);
});

test('playlist targets clamp at both boundaries and ignore unrelated keys', () => {
  assert.equal(playlistScrollTarget({ ...base, scrollTop: 640, key: 'ArrowDown' }), 644);
  assert.equal(playlistScrollTarget({ ...base, scrollTop: 2, key: 'ArrowUp' }), 0);
  assert.equal(playlistScrollTarget({ ...base, key: 'Enter' }), null);
});

test('dragging the playlist thumb maps rail travel to the full scroll range', () => {
  assert.equal(playlistDragTarget({
    startScrollTop: 108,
    deltaY: 50,
    viewportHeight: 276,
    scrollHeight: 920,
    railHeight: 300,
    thumbHeight: 100,
  }), 269);
  assert.equal(playlistDragTarget({
    startScrollTop: 108,
    deltaY: -200,
    viewportHeight: 276,
    scrollHeight: 920,
    railHeight: 300,
    thumbHeight: 100,
  }), 0);
  assert.equal(playlistDragTarget({
    startScrollTop: 600,
    deltaY: 200,
    viewportHeight: 276,
    scrollHeight: 920,
    railHeight: 300,
    thumbHeight: 100,
  }), 644);
});
