import test from 'node:test';
import assert from 'node:assert/strict';
import { createFullscreenSession } from '../src/lib/fullscreen-session.mjs';

test('playing fullscreen hides controls only after the current three-second token', () => {
  const session = createFullscreenSession();
  const first = session.enter();
  const second = session.interact();
  assert.equal(session.onHideTimer(first.token).controlsVisible, true);
  assert.equal(session.onHideTimer(second.token).controlsVisible, false);
  assert.equal(second.hideDelayMs, 3000);
  assert.equal(second.titleFadeMs, 1250);
});

test('paused fullscreen remains visible and exit returns inline', () => {
  const session = createFullscreenSession();
  session.enter();
  session.setPaused(true);
  assert.equal(session.onHideTimer(session.snapshot().token).controlsVisible, true);
  assert.equal(session.exit().mode, 'inline');
  assert.equal(session.exit().mode, 'inline');
});

test('interaction invalidates a stale hide timer', () => {
  const session = createFullscreenSession();
  const entered = session.enter();
  const interacted = session.interact();
  assert.notEqual(entered.token, interacted.token);
  assert.equal(session.onHideTimer(entered.token).controlsVisible, true);
});
