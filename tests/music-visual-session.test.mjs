import test from 'node:test';
import assert from 'node:assert/strict';
import { createMusicVisualSession } from '../src/lib/music-visual-session.mjs';

const voidVisual = { tag: 'VIZ-VOID', src: 'void.mp4', aspect: 'portrait' };

test('consecutive songs with the same tag keep one seamless visual generation', () => {
  const session = createMusicVisualSession();
  const first = session.activate(voidVisual);
  const second = session.activate(voidVisual);
  assert.equal(second.action, 'keep');
  assert.equal(second.token, first.token);
});

test('untagged advance prepares next Cinema then performs one stale-safe fade', () => {
  const session = createMusicVisualSession();
  session.activate(voidVisual);
  const transition = session.releaseToCinema('cinema-next');
  assert.equal(transition.action, 'fade-to-cinema');
  assert.equal(session.completeFade(transition.token).owner, 'cinema');
  assert.equal(session.completeFade(transition.token - 1).owner, 'cinema');
});

test('different tag replaces the generation and current failure isolates only that visual', () => {
  const session = createMusicVisualSession();
  const first = session.activate(voidVisual);
  const second = session.activate({ tag: 'VIZ-GRID', src: 'grid.mp4', aspect: 'portrait' });
  assert.equal(second.action, 'replace');
  assert.notEqual(second.token, first.token);
  assert.equal(session.fail(first.token).owner, 'music-tag');
  assert.equal(session.fail(second.token).owner, 'cinema');
});

test('stale fade cannot clear a newly activated visual', () => {
  const session = createMusicVisualSession();
  session.activate(voidVisual);
  const fade = session.releaseToCinema('cinema-next');
  session.activate({ tag: 'VIZ-GRID', src: 'grid.mp4', aspect: 'portrait' });
  assert.equal(session.completeFade(fade.token).visual.tag, 'VIZ-GRID');
});
