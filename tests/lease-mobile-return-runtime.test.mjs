import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { activateSource, createPlaybackSession, releaseStageLease } from '../src/lib/playback-session.mjs';
import { createCinemaContinuity, selectCinema } from '../src/lib/cinema-continuity.mjs';
import { createAudibleSource, removeAudibleProvider } from '../src/lib/audible-source.mjs';
import { restoreCinemaSnapshot } from '../src/lib/media-presentation.mjs';

const source = await readFile(new URL('../src/components/HybridMediaEngine.astro', import.meta.url), 'utf8');
const restore = source.slice(source.indexOf('\tasync function restoreLeasedCinema('), source.indexOf('\tasync function recoverMasterVideoFailure('));
const wide = { id: 'wide', src: 'https://EXAMPLE.com/wide.mp4', aspect: 'landscape' };
const tall = { id: 'tall', src: 'https://example.com/tall.mp4', aspect: 'portrait' };

for (const music of [false, true]) {
  for (const [name, queue, expected, time] of [
    ['eligible snapshot', [wide, tall], wide, 42],
    ['portrait fallback', [tall], tall, 0],
    ['empty mobile queue', [], null, 0],
  ]) {
    test(`lease return uses ${name} with Music=${music}`, async () => {
      const snapshot = { ...wide, src: new URL(wide.src).href, currentTime: 42, paused: false, muted: music, stageProvider: 'cinema', mirrorWings: 'off', followers: [] };
      const session = activateSource(createPlaybackSession({ cinemaId: wide.id }), { provider: 'media', id: 'lease', mode: 'video', snapshot });
      const suspendedForStageLease = createAudibleSource({ provider: music ? 'music' : 'cinema', id: music ? 'song' : wide.id, mode: music ? 'audio' : 'video' });
      const played = [];
      const mv = {
        _src: 'https://example.com/leased.mp4', muted: false, paused: false, currentTime: 7,
        get src() { return this._src; },
        set src(value) { this._src = new URL(value).href; },
        pause() { this.paused = true; },
        async play() { this.paused = false; played.push(this.src); },
        removeAttribute(key) { if (key === 'src') this._src = undefined; },
        load() { this.currentTime = 0; },
      };
      const context = {
        mv, stage: { dataset: {} }, wings: [], session, suspendedForStageLease,
        URL, document: { baseURI: 'https://example.com/' },
        videoPlaylist: queue, cinema: createCinemaContinuity(queue), audible: createAudibleSource(),
        activateSource, releaseStageLease, selectCinema, createAudibleSource, removeAudibleProvider, restoreCinemaSnapshot,
        captureControllerState: () => ({ session, suspendedForStageLease }),
        async rollbackControllerState(prior, error) { return error; },
        pauseVideoStack() { mv.pause(); }, hideMirrorWings() {},
        reconcileMirrorWings() {}, async resumeAudibleState() {}, updateCinemaCueState() {},
        renderMusicAudioIdentity() {}, renderCinemaIdentity() {}, returnButton: {},
      };
      // Bind only DOM adapters; execute the actual controller and snapshot restore.
      context.setStageProvider = provider => { context.stage.dataset.stageProvider = provider; context.stage.dataset.mediaAspect = 'unknown'; };
      context.currentCinema = () => queue[context.cinema.cursor] ?? null;
      runInNewContext(restore, context);
      await context.restoreLeasedCinema();
      assert.equal(mv.src ?? null, expected ? new URL(expected.src).href : null);
      assert.equal(mv.currentTime, time);
      assert.equal(context.session.lease, null);
      assert.equal(context.session.playback.id, music ? 'song' : expected?.id ?? null);
      assert.equal(mv.muted, expected ? music : true);
      if (music) assert.equal(context.audible.current.id, 'song');
      if (!expected) {
        assert.equal(mv.paused, true);
        assert.equal(played.length, 0);
        if (!music) assert.equal(context.audible.current, null);
      } else assert.deepEqual(played, [new URL(expected.src).href]);
    });
  }
}
