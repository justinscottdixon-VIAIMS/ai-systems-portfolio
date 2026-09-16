import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { createFullscreenSession } from '../src/lib/fullscreen-session.mjs';

const source = await readFile(new URL('../src/components/HybridMediaEngine.astro', import.meta.url), 'utf8');
const bindings = source.slice(source.indexOf("\tmv.addEventListener('play'"), source.indexOf("\tmusicAudio.addEventListener('loadedmetadata'"));
const authoritative = source.slice(source.indexOf('\tfunction activeAuthoritativeMedia()'), source.indexOf('\tfunction syncTransportTime()'));

for (const provider of ['music', 'cinema']) {
  for (const event of ['play', 'pause']) {
    test(`background ${event} preserves fullscreen state owned by ${provider}`, () => {
      const element = (paused) => ({ paused, listeners: {}, addEventListener(name, fn) { this.listeners[name] = fn; } });
      const musicAudio = element(event === 'play');
      const mv = element(event === 'play');
      const fullscreenSession = createFullscreenSession();
      fullscreenSession.enter();
      fullscreenSession.setPaused(event === 'play');
      const context = {
        musicAudio, mv, fullscreenSession,
        session: { playback: { provider, mode: provider === 'music' ? 'audio' : 'video' } },
        playMirrorWings() {}, pauseMirrorWings() {}, syncActivePlayButton() {}, syncMusicRowActions() {},
        suppressMusicVisualMediaSync: true,
        renderFullscreenSession() {},
      };
      runInNewContext(authoritative + bindings, context);
      const background = provider === 'music' ? mv : musicAudio;
      background.paused = event === 'pause';
      background.listeners[event]();
      const snapshot = fullscreenSession.snapshot();
      assert.equal(snapshot.paused, event === 'play');
      fullscreenSession.onHideTimer(snapshot.token);
      assert.equal(fullscreenSession.snapshot().controlsVisible, event === 'play');
    });
  }
}
