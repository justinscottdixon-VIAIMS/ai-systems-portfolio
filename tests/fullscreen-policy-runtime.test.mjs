import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { activeTransportPolicy } from '../src/lib/active-transport.mjs';
import { createFullscreenSession } from '../src/lib/fullscreen-session.mjs';

const source = await readFile(new URL('../src/components/HybridMediaEngine.astro', import.meta.url), 'utf8');
const render = source.slice(source.indexOf('\tfunction renderFullscreenSession()'), source.indexOf('\tasync function enterFullscreenMode()'));
for (const [name, playback, lease, locked, expected] of [
  ['Cinema', { provider: 'cinema', id: 'c', mode: 'video' }, null, false, [false, false, false, false]],
  ['Media lease', { provider: 'media', id: 'm', mode: 'video' }, {}, false, [true, false, true, false]],
  // Music video belongs to the combined Music queue; ordinary Media leases stay isolated above.
  ['Music video lease', { provider: 'music', id: 's', mode: 'video' }, {}, false, [false, false, false, false]],
  ['empty', { provider: 'cinema', id: null, mode: 'video' }, null, false, [true, true, true, true]],
  ['entry locked', { provider: 'cinema', id: 'c', mode: 'video' }, null, true, [true, true, true, true]],
]) {
  for (const muted of [true, false]) {
  test(`inline and fullscreen controls render ${name}, muted=${muted}`, () => {
    const button = () => ({ disabled: false, dataset: {}, attributes: {}, setAttribute(k, v) { this.attributes[k] = v; } });
    const controls = Array.from({ length: 4 }, button);
    const [fullscreenPrev, fullscreenPlay, fullscreenNext, fullscreenMute] = controls;
    const activeMute = button();
    runInNewContext(`${render}\nrenderFullscreenSession();`, {
      fullscreenPrev, fullscreenPlay, fullscreenNext, fullscreenMute, activeMute,
      fullscreenSession: createFullscreenSession(), fullscreenShell: { dataset: {} },
      fullscreenTitle: {}, nowPlayingTitle: { textContent: 'Selected' },
      activeAuthoritativeMedia: () => ({ paused: true, muted }),
      activeTransportPolicy, session: { playback, lease }, entryControlsLocked: locked,
      scheduleFullscreenHide() {},
    });
    assert.deepEqual(controls.map((c) => c.disabled), expected);
    assert.deepEqual(controls.map((c) => c.attributes['aria-disabled']), expected.map(String));
    assert.equal(activeMute.disabled, expected[3]);
    assert.equal(activeMute.attributes['aria-label'], muted ? 'Unmute active item' : 'Mute active item');
    assert.equal(activeMute.attributes['aria-pressed'], String(muted));
    assert.equal(activeMute.textContent, muted ? 'UNMUTE' : 'MUTE');
  });
  }
}

test('inline mute shares the queued authoritative mute handler', () => {
  assert.match(source, /<button id="active-mute"[^>]*aria-label="Unmute active item"[^>]*disabled/);
  assert.ok(source.includes("activeMute.addEventListener('click', requestFullscreenMute)"));
});
