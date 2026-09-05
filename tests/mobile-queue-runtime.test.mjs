import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { eligibleVideoItems, isMobileViewport } from '../src/lib/mobile-media.mjs';
import { createCinemaContinuity, selectCinema } from '../src/lib/cinema-continuity.mjs';
import { activateSource, createPlaybackSession } from '../src/lib/playback-session.mjs';
import { createAudibleSource, removeAudibleProvider } from '../src/lib/audible-source.mjs';
import { activeTransportPolicy } from '../src/lib/active-transport.mjs';

const source = await readFile(new URL('../src/components/HybridMediaEngine.astro', import.meta.url), 'utf8');
function implementation(start, end) {
  return source.slice(source.indexOf(`\tfunction ${start}`), source.indexOf(`\tfunction ${end}`));
}
const landscape = { id: 'wide', src: '/wide.mp4', title: 'Wide', aspect: 'landscape' };
const portrait = { id: 'tall', src: '/tall.mp4', title: 'Tall', aspect: 'portrait' };

function runtime({ items = [landscape], width = 390, initialWidth = width, music = false, lease = false, locked = false } = {}) {
  const videoPlaylist = eligibleVideoItems(items, initialWidth);
  const cinema = createCinemaContinuity(videoPlaylist);
  let session = createPlaybackSession({ cinemaId: cinema.currentId });
  if (music) session = activateSource(session, { provider: 'music', id: 'song', mode: 'audio' });
  if (lease) session = activateSource(session, { provider: 'media', id: 'leased', mode: 'video', snapshot: { id: cinema.currentId } });
  const mv = {
    src: lease ? '/leased.mp4' : locked ? '/welcome.mp4' : '/wide.mp4', muted: true, paused: false, loads: 0,
    getAttribute(name) { return this[name] ?? null; },
    removeAttribute(name) { delete this[name]; },
    load() { this.loads++; }, pause() { this.paused = true; },
  };
  const cinemaButtons = items.map(item => ({
    dataset: { cinemaId: item.id }, classList: { toggle() {} },
    setAttribute(name, value) { this[name] = value; },
  }));
  const context = {
    window: { innerWidth: width }, root: { querySelectorAll: () => [] },
    stage: { dataset: { stageProvider: locked ? 'welcome' : 'cinema', mediaAspect: 'landscape', visualOwner: music ? 'music-tag' : 'cinema', visualTag: music ? 'VIZ-A' : '' } },
    mv, cinemaButtons, videoPlaylist, cinema, session, allCinemaItems: items, allMediaItems: [], mediaItems: [], productById: new Map(),
    entryControlsLocked: locked, audible: createAudibleSource(music ? { provider: 'music', id: 'song', mode: 'audio' } : null),
    retainedCinema: null, rebuildMusicQueue() {},
    nowPlayingTitle: { textContent: 'Wide' }, nowPlayingStatus: { textContent: 'CINEMA READY' }, activeSourceKind: {},
    retryCinema: { hidden: true, setAttribute() {} },
    eligibleVideoItems, isMobileViewport, createCinemaContinuity, selectCinema, activateSource, removeAudibleProvider,
    pauseVideoStack() { mv.pause(); }, hideMirrorWings() {},
    applyActiveTransportPolicy() {}, renderCinemaAudioInvitation() {}, syncCinemaCueAvailability() {}, syncFullscreenEligibility() {},
  };
  runInNewContext(
    implementation('rebuildEligibleVideoQueues(', 'applyMirrorWingGeometry(')
    + implementation('setStageProvider(', 'activeAuthoritativeMedia()')
    + implementation('currentCinema()', 'renderMusicAudioIdentity(')
    + implementation('updateCinemaCueState()', 'updateProviderCueState('), context);
  return context;
}

for (const initialWidth of [390, 1000]) {
  test(`empty mobile queue clears ineligible media and identity after width ${initialWidth}`, () => {
    const ctx = runtime({ initialWidth });
    ctx.rebuildEligibleVideoQueues();
    assert.equal(ctx.mv.getAttribute('src'), null);
    assert.equal(ctx.mv.paused, true);
    assert.equal(ctx.session.playback.id, null);
    assert.equal(activeTransportPolicy(ctx.session.playback).playPause, false);
    assert.equal(ctx.nowPlayingTitle.textContent, 'No Media Loaded');
    assert.match(ctx.nowPlayingStatus.textContent, /NO PORTRAIT CINEMA AVAILABLE/);
    assert.equal(ctx.cinemaButtons[0]['aria-current'], 'false');
  });
}

test('mobile startup reconciles server source to first eligible portrait', () => {
  const ctx = runtime({ items: [landscape, portrait] });
  ctx.rebuildEligibleVideoQueues();
  assert.equal(ctx.mv.src, portrait.src);
  assert.equal(ctx.session.playback.id, portrait.id);
  assert.equal(ctx.nowPlayingTitle.textContent, portrait.title);
});

test('responsive Cinema replacement stays muted while Music owns audio', () => {
  const ctx = runtime({
    items: [landscape, portrait],
    initialWidth: 1000,
    width: 390,
    music: true,
  });
  ctx.mv.muted = false;
  ctx.rebuildEligibleVideoQueues();
  assert.equal(ctx.audible.current.provider, 'music');
  assert.equal(ctx.mv.muted, true);
});

test('returning to desktop restores an available Cinema source after empty mobile queue', () => {
  const ctx = runtime();
  ctx.rebuildEligibleVideoQueues();
  ctx.window.innerWidth = 1000;
  ctx.rebuildEligibleVideoQueues();
  assert.equal(ctx.mv.src, landscape.src);
  assert.equal(ctx.session.playback.id, landscape.id);
  assert.equal(activeTransportPolicy(ctx.session.playback).playPause, true);
});

test('clearing empty Cinema preserves independent Music identity and tagged presentation', () => {
  const ctx = runtime({ music: true });
  const playback = ctx.session.playback;
  ctx.stage.dataset.mediaAspect = 'portrait';
  ctx.rebuildEligibleVideoQueues();
  assert.equal(ctx.mv.getAttribute('src'), null);
  assert.equal(ctx.session.playback, playback);
  assert.equal(ctx.audible.current.id, 'song');
  assert.equal(ctx.stage.dataset.mediaAspect, 'portrait');
  assert.equal(ctx.stage.dataset.visualTag, 'VIZ-A');
});

for (const mode of ['lease', 'locked']) {
  test(`queue rebuilding does not replace the ${mode} stage source`, () => {
    const ctx = runtime({ [mode]: true, initialWidth: 1000, items: [landscape, portrait] });
    const original = ctx.mv.src;
    ctx.rebuildEligibleVideoQueues();
    assert.equal(ctx.mv.src, original);
    assert.equal(ctx.mv.paused, false);
  });
}

test('accepted catalogue removal preserves loaded Cinema while navigation uses only the new queue', () => {
  const ctx = runtime({ items: [landscape, portrait], width: 1000 });
  const playback = ctx.session.playback;
  ctx.mv.currentTime = 42;
  ctx.allCinemaItems = [portrait];
  ctx.rebuildEligibleVideoQueues({ preserveLoaded: true });
  assert.equal(ctx.mv.src, landscape.src);
  assert.equal(ctx.mv.currentTime, 42);
  assert.equal(ctx.mv.loads, 0);
  assert.equal(ctx.session.playback, playback);
  assert.equal(ctx.currentCinema().id, landscape.id);
  assert.deepEqual(Array.from(ctx.videoPlaylist, ({ id }) => id), ['tall']);
  assert.equal(ctx.cinemaButtons[0]['aria-current'], 'false');
});

test('accepted empty catalogue retains independent Music audio and its tagged visual', () => {
  const ctx = runtime({ items: [landscape], width: 1000, music: true });
  const playback = ctx.session.playback;
  ctx.allCinemaItems = [];
  ctx.rebuildEligibleVideoQueues({ preserveLoaded: true });
  assert.equal(ctx.mv.src, landscape.src);
  assert.equal(ctx.session.playback, playback);
  assert.equal(ctx.audible.current.id, 'song');
  assert.equal(ctx.stage.dataset.visualOwner, 'music-tag');
  assert.equal(ctx.videoPlaylist.length, 0);
});
