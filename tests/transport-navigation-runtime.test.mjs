import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { activeTransportPolicy } from '../src/lib/active-transport.mjs';
import { createMusicQueue, advanceMusicQueue, selectMusicItem, selectMusicMode, toggleShuffle } from '../src/lib/music-queue.mjs';
import { toRuntimeMediaLibrary } from '../src/lib/runtime-media-library.mjs';
import { advanceCinema, createCinemaContinuity, createCinemaEndedToken, isCurrentCinemaEndedToken, selectCinema } from '../src/lib/cinema-continuity.mjs';
import { eligibleVideoItems, isMobileViewport } from '../src/lib/mobile-media.mjs';
import { activateSource, createPlaybackSession, releaseStageLease } from '../src/lib/playback-session.mjs';
import { createAudibleSource, removeAudibleProvider } from '../src/lib/audible-source.mjs';

const source = await readFile(new URL('../src/components/HybridMediaEngine.astro', import.meta.url), 'utf8');
const handlers = source.slice(source.indexOf('\tfunction requestPrevious()'), source.indexOf('\tasync function toggleFullscreenMute()'));

function namedImplementation(name) {
  const start = source.search(new RegExp(`\\t(?:async )?function ${name}\\(`));
  assert.ok(start >= 0, `${name} implementation exists`);
  const rest = source.slice(start + 1);
  const end = rest.search(/\n\t(?:async )?function /);
  return source.slice(start, end < 0 ? undefined : start + 1 + end);
}

function mediaElement(src) {
  return {
    src, currentTime: 42, muted: true, paused: false, loads: 0, plays: 0,
    getAttribute(name) { return this[name] ?? null; },
    removeAttribute(name) { delete this[name]; },
    load() { this.loads++; this.currentTime = 0; },
    async play() { this.plays++; this.paused = false; },
  };
}

function element(tag = 'div') {
  return {
    tag, dataset: {}, children: [], className: '', textContent: '', classList: { toggle() {} },
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = children; },
    setAttribute(name, value) { this[name] = value; },
  };
}

const catalogueItem = (id, folder, kind, patch = {}) => ({
  id, pathname: id, folder, kind, versionId: 'etag-1', title: id,
  src: `https://media.example.test/${id}`, playlistOrder: 0,
  ...(kind === 'video' ? { width: 720, height: 1280, aspect: 'portrait' } : {}), ...patch,
});

function catalogueRuntime(items) {
  const library = toRuntimeMediaLibrary(items);
  const cinemaPlaylist = element(), musicPlaylist = element(), mediaPlaylist = element();
  const descendants = (row) => [row, ...row.children.flatMap(descendants)];
  const allRows = () => [cinemaPlaylist, musicPlaylist, mediaPlaylist].flatMap(descendants);
  const matches = (row, selector) => selector.startsWith('.') ? row.className === selector.slice(1)
    : selector === '[data-music-mode]' ? Boolean(row.dataset.musicMode)
      : selector === '[data-music-mode="audio"]' ? row.dataset.musicMode === 'audio' : false;
  const musicProducts = library.music.map(item => ({ ...item, audioSrc: item.kind === 'audio' ? item.src : null, videoSrc: item.kind === 'video' ? item.src : null, videoAspect: item.aspect }));
  const mv = mediaElement(library.cinema[0]?.src ?? ''), musicAudio = mediaElement(musicProducts[0]?.audioSrc ?? '');
  const context = {
    document: { baseURI: 'https://viaims.test/', createElement: element }, window: { innerWidth: 1000 }, URL,
    root: { querySelectorAll: (selector) => allRows().filter(row => matches(row, selector)) },
    cinemaPlaylist, musicPlaylist, mediaPlaylist, cinemaButtons: [], allCinemaItems: library.cinema, allMediaItems: library.media,
    videoPlaylist: library.cinema, mediaItems: library.media, cinema: createCinemaContinuity(library.cinema),
    musicProducts, productById: new Map(musicProducts.map(item => [item.productId, item])), musicQueue: createMusicQueue(musicProducts),
    mv, musicAudio, musicVisualVideo: mediaElement(''), runtimeCatalogueItems: items, runtimeSourceRecords: new Map(), retainedCinema: null,
    session: createPlaybackSession({ cinemaId: library.cinema[0]?.id }), audible: createAudibleSource(), suspendedForStageLease: null,
    stage: { dataset: { stageProvider: 'cinema', visualOwner: 'cinema' } }, entryControlsLocked: false, entryCueControls: [],
    returnButton: element('button'), retryCinema: element('button'), nowPlayingTitle: element(), nowPlayingStatus: element(), activeSourceKind: element(),
    createMusicQueue, createCinemaContinuity, selectCinema, eligibleVideoItems, isMobileViewport, activateSource, removeAudibleProvider,
    syncEntryControlAvailability() {}, syncCinemaCueAvailability() {}, syncFullscreenEligibility() {}, syncPlaylistRails() {},
    updateProviderCueState() {}, syncMusicRowActions() {}, hideMirrorWings() {}, pauseVideoStack() {}, setStageProvider() {}, renderCinemaIdentity() {},
  };
  const names = ['createCatalogueButton', 'renderCinemaRows', 'renderMusicRows', 'renderMediaRows', 'sameMediaSource', 'captureRuntimeSources', 'reconcileRuntimeSources', 'rebuildMusicQueue', 'applyRuntimeLibrary', 'rebuildEligibleVideoQueues', 'currentCinema', 'updateCinemaCueState', 'restoreMusicSource'];
  runInNewContext(names.map(namedImplementation).join('\n'), context);
  context.renderCinemaRows(); context.renderMusicRows(); context.renderMediaRows();
  return context;
}

function enableLeaseRestoration(ctx) {
  Object.assign(ctx, {
    releaseStageLease, createAudibleSource, wings: [],
    captureControllerState: () => ({ session: ctx.session, audible: ctx.audible, suspendedForStageLease: ctx.suspendedForStageLease }),
    async restoreCinemaSnapshot(video, stage, snapshot) {
      video.src = snapshot.src; video.currentTime = snapshot.currentTime; video.muted = snapshot.muted;
    },
    currentAudibleElement: (state) => state.current?.provider === 'music' && state.current.mode === 'audio' ? ctx.musicAudio : null,
    reconcileMirrorWings() {}, renderMusicAudioIdentity() {},
    async rollbackControllerState(prior, error) { throw error; },
  });
  runInNewContext(namedImplementation('resumeAudibleState') + namedImplementation('restoreLeasedCinema'), ctx);
}

test('accepted library renders literal titles, one action per Music row, and preserves loaded time', async () => {
  const film = catalogueItem('Cinema/film.mp4', 'cinema', 'video');
  const song = catalogueItem('Music/song.mp3', 'music', 'audio');
  const clip = catalogueItem('Music/clip.mov', 'music', 'video', { playlistOrder: 1 });
  const ctx = catalogueRuntime([film, song]);
  const items = [{ ...film, title: '<img src=x onerror=alert(1)>' }, song, clip];
  await ctx.applyRuntimeLibrary(toRuntimeMediaLibrary(items), items);
  assert.equal(ctx.mv.currentTime, 42); assert.equal(ctx.mv.loads, 0);
  assert.equal(ctx.cinemaPlaylist.children[0].children[0].textContent, items[0].title);
  assert.deepEqual(ctx.musicPlaylist.children.map(row => row.children[1].children.length), [1, 1]);
  assert.deepEqual(ctx.musicPlaylist.children.map(row => row.children[1].children[0].textContent), ['PLAY', 'VIDEO']);
  assert.deepEqual(Array.from(ctx.musicQueue.order), [song.id, clip.id]);
  assert.equal(ctx.entryCueControls.length, 5);
});

for (const aspect of ['landscape', 'portrait']) {
  test(`mobile Cinema ${aspect} replacement respects eligibility before loading the new ETag`, async () => {
    const film = catalogueItem('Cinema/film.mp4', 'cinema', 'video');
    const remaining = catalogueItem('Cinema/remaining.mp4', 'cinema', 'video', { playlistOrder: 1 });
    const ctx = catalogueRuntime([film, remaining]);
    ctx.window.innerWidth = 390;
    const replacement = { ...film, versionId: 'etag-2', src: `${film.src}?v=2`, aspect,
      width: aspect === 'landscape' ? 1280 : 720, height: aspect === 'landscape' ? 720 : 1280 };
    await ctx.applyRuntimeLibrary(toRuntimeMediaLibrary([replacement, remaining]), [replacement, remaining]);
    const eligible = aspect === 'portrait';
    assert.equal(ctx.mv.loads, eligible ? 1 : 0);
    assert.equal(ctx.mv.plays, eligible ? 1 : 0);
    assert.equal(ctx.mv.src, eligible ? replacement.src : film.src);
    assert.equal(ctx.mv.currentTime, eligible ? 0 : 42);
    assert.equal(ctx.currentCinema().aspect, 'portrait');
    assert.deepEqual(Array.from(ctx.videoPlaylist, ({ id }) => id), eligible ? [film.id, remaining.id] : [remaining.id]);
    let pending;
    const navigated = [];
    Object.assign(ctx, {
      activeTransportPolicy,
      enqueueMediaControlTransition(fn) { pending = fn(); },
      async activateCinema(index) { navigated.push(ctx.videoPlaylist[index]?.id); },
    });
    runInNewContext(handlers + '\nrequestNext();', ctx);
    await pending;
    assert.deepEqual(navigated, [remaining.id]);
    navigated.length = 0;
    Object.assign(ctx, {
      introSession: { phase: 'ready' }, advanceCinema, createCinemaEndedToken, isCurrentCinemaEndedToken,
      enqueueTransition(fn) { pending = fn(); return pending; },
    });
    let ended;
    ctx.mv.addEventListener = (event, fn) => { if (event === 'ended') ended = fn; };
    runInNewContext(source.slice(source.indexOf("\tmv.addEventListener('ended'"), source.indexOf("\tmv.addEventListener('error'")), ctx);
    ended();
    await pending;
    assert.deepEqual(navigated, [remaining.id]);
  });
}

test('teardown during replacement playback prevents subsequent source and row mutations', async () => {
  const film = catalogueItem('Cinema/film.mp4', 'cinema', 'video');
  const song = catalogueItem('Music/song.mp3', 'music', 'audio');
  const ctx = catalogueRuntime([film, song]);
  const nextItems = [film, song].map((item) => ({ ...item, versionId: 'etag-2', title: 'Replacement' }));
  let release, current = true;
  const gate = new Promise((resolve) => { release = resolve; });
  ctx.mv.play = () => gate;
  const previousRows = ctx.cinemaPlaylist.children;
  const applying = ctx.applyRuntimeLibrary(toRuntimeMediaLibrary(nextItems), nextItems, { isCurrent: () => current });
  assert.equal(ctx.mv.loads, 1);
  current = false;
  release();
  await applying;
  assert.equal(ctx.musicAudio.loads, 0);
  assert.equal(ctx.runtimeCatalogueItems[0].versionId, 'etag-1');
  assert.equal(ctx.cinemaPlaylist.children, previousRows);
});

test('mobile retention remembers loaded bytes when an ineligible replacement keeps the same public URL', async () => {
  const film = catalogueItem('Cinema/film.mp4', 'cinema', 'video');
  const ctx = catalogueRuntime([film]);
  ctx.window.innerWidth = 390;
  const replacement = { ...film, versionId: 'etag-2', aspect: 'landscape', width: 1280, height: 720 };
  for (let refresh = 0; refresh < 2; refresh++) {
    await ctx.applyRuntimeLibrary(toRuntimeMediaLibrary([replacement]), [replacement]);
    assert.equal(ctx.mv.loads, 0);
    assert.equal(ctx.runtimeSourceRecords.get(ctx.mv).versionId, 'etag-1');
  }
  ctx.window.innerWidth = 1000;
  await ctx.applyRuntimeLibrary(toRuntimeMediaLibrary([replacement]), [replacement]);
  assert.equal(ctx.mv.loads, 1);
  assert.equal(ctx.mv.plays, 1);
  assert.equal(ctx.runtimeSourceRecords.get(ctx.mv).versionId, 'etag-2');
});

test('aborting replacement playback releases the catalogue transition before play settles', async () => {
  const film = catalogueItem('Cinema/film.mp4', 'cinema', 'video');
  const ctx = catalogueRuntime([film]);
  const replacement = { ...film, versionId: 'etag-2' };
  const abortController = new AbortController();
  let release, completed = false;
  ctx.mv.play = () => new Promise((resolve) => { release = resolve; });
  const applying = ctx.applyRuntimeLibrary(toRuntimeMediaLibrary([replacement]), [replacement], {
    signal: abortController.signal, isCurrent: () => !abortController.signal.aborted,
  }).then(() => { completed = true; });
  abortController.abort();
  for (let step = 0; step < 12; step++) await Promise.resolve();
  try {
    assert.equal(completed, true);
    assert.equal(ctx.runtimeCatalogueItems[0].versionId, 'etag-1');
  } finally {
    release();
    await applying;
  }
});

test('bootstrap identity migration includes suspended Music audio and keeps its exact media element', async () => {
  const song = catalogueItem('Music/song.mp3', 'music', 'audio');
  const ctx = catalogueRuntime([song]);
  ctx.runtimeCatalogueItems = [];
  ctx.musicProducts = [{ productId: 'bootstrap-song', audioSrc: song.src, title: song.title }];
  ctx.productById = new Map(ctx.musicProducts.map(item => [item.productId, item]));
  ctx.musicQueue = createMusicQueue(ctx.musicProducts);
  ctx.audible = { current: { provider: 'cinema', id: null, mode: 'video', currentTime: 0 }, suspended: { provider: 'music', id: 'bootstrap-song', mode: 'audio', currentTime: 42 } };
  await ctx.applyRuntimeLibrary(toRuntimeMediaLibrary([song]), [song]);
  assert.equal(ctx.audible.suspended.id, song.id);
  assert.equal(ctx.audible.suspended.currentTime, 42);
  assert.equal(ctx.musicAudio.currentTime, 42); assert.equal(ctx.musicAudio.loads, 0);
});

for (const legacyIdentity of ['symbolic', 'audio-pathname', 'video-pathname']) test(`a shared bootstrap Music ID migrates its video lease and suspended audio to their own pathnames, old ID=${legacyIdentity}`, async () => {
  const film = catalogueItem('Cinema/film.mp4', 'cinema', 'video');
  const song = catalogueItem('Music/song.mp3', 'music', 'audio');
  const clip = catalogueItem('Music/song.mov', 'music', 'video', { playlistOrder: 1 });
  const ctx = catalogueRuntime([film, song, clip]);
  const legacyId = legacyIdentity === 'audio-pathname' ? song.id : legacyIdentity === 'video-pathname' ? clip.id : 'bootstrap-song';
  ctx.runtimeCatalogueItems = [];
  ctx.musicProducts = [{ productId: legacyId, title: 'Song', audioSrc: song.src, videoSrc: clip.src, videoAspect: clip.aspect }];
  ctx.productById = new Map([[legacyId, ctx.musicProducts[0]]]);
  ctx.musicQueue = selectMusicMode(createMusicQueue(ctx.musicProducts), legacyId, 'video');
  ctx.session = activateSource(ctx.session, { provider: 'music', id: legacyId, mode: 'video', snapshot: { id: film.id, src: film.src, currentTime: 11, muted: true } });
  ctx.mv.src = clip.src;
  ctx.musicAudio.paused = true;
  ctx.audible = createAudibleSource({ provider: 'music', id: legacyId, mode: 'video', currentTime: 8 });
  ctx.suspendedForStageLease = createAudibleSource({ provider: 'music', id: legacyId, mode: 'audio', currentTime: 42 });
  enableLeaseRestoration(ctx);

  await ctx.applyRuntimeLibrary(toRuntimeMediaLibrary([film, song, clip]), [film, song, clip]);

  assert.equal(ctx.session.playback.id, clip.id);
  assert.equal(ctx.musicQueue.currentProductId, clip.id);
  assert.equal(ctx.musicQueue.mode, 'video');
  assert.equal(ctx.audible.current.id, clip.id);
  assert.equal(ctx.suspendedForStageLease.current.id, song.id);
  assert.equal(ctx.suspendedForStageLease.current.mode, 'audio');
  assert.equal(ctx.suspendedForStageLease.current.currentTime, 42);
  assert.equal(ctx.mv.src, clip.src); assert.equal(ctx.mv.loads, 0);
  assert.equal(ctx.musicAudio.src, song.src); assert.equal(ctx.musicAudio.loads, 0);

  await ctx.restoreLeasedCinema();
  assert.equal(ctx.session.playback.id, song.id);
  assert.equal(ctx.session.playback.mode, 'audio');
  assert.equal(ctx.musicAudio.src, song.src);
  assert.equal(ctx.musicAudio.currentTime, 42);
  assert.equal(ctx.musicAudio.paused, false);
  assert.equal(ctx.mv.src, film.src);
});

for (const bootstrap of [false, true]) test(`removed loaded Music audio can resume without repopulating rows, bootstrap=${bootstrap}`, async () => {
  const song = catalogueItem('Music/song.mp3', 'music', 'audio');
  const ctx = catalogueRuntime([song]);
  if (bootstrap) ctx.runtimeCatalogueItems = [];
  await ctx.applyRuntimeLibrary(toRuntimeMediaLibrary([]), []);
  const restored = ctx.restoreMusicSource(song.id);
  assert.equal(restored.productId, song.id);
  assert.equal(ctx.musicAudio.currentTime, 42); assert.equal(ctx.musicAudio.loads, 0);
  assert.equal(ctx.musicProducts.length, 0); assert.equal(ctx.musicQueue.order.length, 0);
});

test('updated suspended Cinema lease snapshot restarts the accepted ETag at zero', async () => {
  const film = catalogueItem('Cinema/film.mp4', 'cinema', 'video');
  const clip = catalogueItem('Media/clip.mp4', 'media', 'video');
  const ctx = catalogueRuntime([film, clip]);
  ctx.session = activateSource(ctx.session, { provider: 'media', id: clip.id, mode: 'video', snapshot: { id: film.id, src: film.src, currentTime: 42, muted: true } });
  ctx.mv.src = clip.src;
  const items = [{ ...film, versionId: 'etag-2' }, clip];
  await ctx.applyRuntimeLibrary(toRuntimeMediaLibrary(items), items);
  assert.equal(ctx.session.lease.snapshot.currentTime, 0);
  assert.equal(ctx.mv.currentTime, 42); assert.equal(ctx.mv.loads, 0);
});

for (const initialSnapshotVersion of [undefined, 'etag-1']) {
  test(`Cinema removal then changed re-add retains and compares the leased snapshot ETag, initially=${initialSnapshotVersion ?? 'unstamped'}`, async () => {
    const film = catalogueItem('Cinema/film.mp4', 'cinema', 'video');
    const clip = catalogueItem('Media/clip.mp4', 'media', 'video');
    const ctx = catalogueRuntime([film, clip]);
    ctx.session = activateSource(ctx.session, { provider: 'media', id: clip.id, mode: 'video', snapshot: {
      id: film.id, src: film.src, versionId: initialSnapshotVersion, currentTime: 42, muted: true,
    } });
    ctx.mv.src = clip.src;
    enableLeaseRestoration(ctx);

    await ctx.applyRuntimeLibrary(toRuntimeMediaLibrary([clip]), [clip]);
    assert.equal(ctx.session.lease.snapshot.id, film.id);
    assert.equal(ctx.session.lease.snapshot.versionId, film.versionId);
    assert.equal(ctx.session.lease.snapshot.currentTime, 42);

    const revised = { ...film, src: `${film.src}?revision=2`, versionId: 'etag-2' };
    await ctx.applyRuntimeLibrary(toRuntimeMediaLibrary([revised, clip]), [revised, clip]);
    assert.equal(ctx.session.lease.snapshot.versionId, revised.versionId);
    assert.equal(ctx.session.lease.snapshot.currentTime, 0);
    assert.equal(ctx.session.lease.snapshot.src, revised.src);
    assert.equal(ctx.mv.src, clip.src); assert.equal(ctx.mv.currentTime, 42);

    await ctx.restoreLeasedCinema();
    assert.equal(ctx.mv.src, revised.src);
    assert.equal(ctx.mv.currentTime, 0);
    assert.equal(ctx.currentCinema().id, film.id);
  });
}

test('capturing a lease after Cinema removal retains the actually loaded version', async () => {
  const film = catalogueItem('Cinema/film.mp4', 'cinema', 'video');
  const ctx = catalogueRuntime([film]);
  await ctx.applyRuntimeLibrary(toRuntimeMediaLibrary([]), []);
  Object.assign(ctx, {
    wings: [], cinemaMutedBeforeMusicAudio: null,
    captureControllerUi: () => ({}),
    captureCinemaSnapshot: (video, stage, id) => ({ id, src: video.src, currentTime: video.currentTime, muted: video.muted }),
  });
  runInNewContext(namedImplementation('captureControllerState'), ctx);
  const { stageSnapshot } = ctx.captureControllerState();
  assert.equal(stageSnapshot.id, film.id);
  assert.equal(stageSnapshot.versionId, film.versionId);
  assert.equal(stageSnapshot.src, film.src);
  assert.equal(stageSnapshot.currentTime, 42);
});

test('URL-only Music changes preserve the retained source through lease restoration', async () => {
  const film = catalogueItem('Cinema/film.mp4', 'cinema', 'video');
  const song = catalogueItem('Music/song.mp3', 'music', 'audio');
  const clip = catalogueItem('Media/clip.mp4', 'media', 'video');
  const ctx = catalogueRuntime([film, song, clip]);
  let loadedSrc = song.src, sourceAssignments = 0;
  Object.defineProperty(ctx.musicAudio, 'src', {
    get: () => loadedSrc,
    set(value) { sourceAssignments++; loadedSrc = value; ctx.musicAudio.currentTime = 0; },
  });
  ctx.session = activateSource(ctx.session, { provider: 'media', id: clip.id, mode: 'video', snapshot: { id: film.id, src: film.src, currentTime: 11, muted: true } });
  ctx.mv.src = clip.src;
  ctx.musicAudio.paused = true;
  ctx.suspendedForStageLease = createAudibleSource({ provider: 'music', id: song.id, mode: 'audio', currentTime: 42 });
  enableLeaseRestoration(ctx);
  const movedUrl = { ...song, src: 'https://other.example.test/Music/song.mp3' };
  await ctx.applyRuntimeLibrary(toRuntimeMediaLibrary([film, movedUrl, clip]), [film, movedUrl, clip]);
  assert.equal(ctx.productById.get(song.id).audioSrc, movedUrl.src);
  assert.equal(sourceAssignments, 0);

  await ctx.restoreLeasedCinema();
  assert.equal(sourceAssignments, 0);
  assert.equal(ctx.musicAudio.src, song.src);
  assert.equal(ctx.musicAudio.currentTime, 42);
  assert.equal(ctx.musicAudio.plays, 1);
  assert.equal(ctx.session.playback.id, song.id);
});

test('returning from a lease after Cinema removal restores the current queue identity', async () => {
  const oldFilm = catalogueItem('Cinema/old.mp4', 'cinema', 'video');
  const newFilm = catalogueItem('Cinema/new.mp4', 'cinema', 'video');
  const clip = catalogueItem('Media/clip.mp4', 'media', 'video');
  const ctx = catalogueRuntime([oldFilm, clip]);
  ctx.session = activateSource(ctx.session, { provider: 'media', id: clip.id, mode: 'video', snapshot: { id: oldFilm.id, src: oldFilm.src, currentTime: 42, muted: true } });
  ctx.mv.src = clip.src;
  Object.assign(ctx, {
    releaseStageLease, createAudibleSource, wings: [],
    captureControllerState: () => ({ session: ctx.session, suspendedForStageLease: null }),
    async restoreCinemaSnapshot(video, stage, snapshot) { video.src = snapshot.src; video.currentTime = snapshot.currentTime; },
    reconcileMirrorWings() {}, async resumeAudibleState() {}, renderMusicAudioIdentity() {},
    async rollbackControllerState(prior, error) { throw error; },
  });
  runInNewContext(namedImplementation('restoreLeasedCinema'), ctx);
  await ctx.applyRuntimeLibrary(toRuntimeMediaLibrary([newFilm, clip]), [newFilm, clip]);
  await ctx.restoreLeasedCinema();
  assert.equal(ctx.mv.src, newFilm.src);
  assert.equal(ctx.currentCinema().id, newFilm.id);
  assert.equal(ctx.session.playback.id, newFilm.id);
});

test('mixed Music queue completion restores Cinema without replaying its suspended Music audio', async () => {
  const musicAudio = { paused: false, pause() { this.paused = true; } };
  const context = {
    musicAudio, mv: { muted: true, currentTime: 12 }, cinemaMutedBeforeMusicAudio: false,
    session: { playback: { provider: 'music', id: 'Music/last.mov', mode: 'video' }, lease: {} },
    currentCinema: () => ({ id: 'Cinema/film.mp4' }), createAudibleSource, activateSource,
    async restoreLeasedCinema({ resumeAudible = true } = {}) {
      if (resumeAudible) musicAudio.paused = false;
      context.session.lease = null;
    },
    renderCinemaIdentity() {},
  };
  runInNewContext(namedImplementation('returnMusicQueueToCinema'), context);
  await context.returnMusicQueueToCinema();
  assert.equal(musicAudio.paused, true);
  assert.equal(context.mv.muted, false);
  assert.equal(context.audible.current.provider, 'cinema');
});

test('navigation after the final Cinema removal clears the source without attempting empty playback', async () => {
  let plays = 0;
  const context = {
    session: createPlaybackSession({ cinemaId: 'Cinema/removed.mp4' }), videoPlaylist: [], mv: { muted: true },
    audible: createAudibleSource(), activateSource, removeAudibleProvider,
    async switchVideo() {}, currentCinema: () => null, renderCinemaIdentity() {}, renderCinemaAudioInvitation() {},
    async runCommittedPlayback({ commitSelection, startPlayback, onPlaying }) { await commitSelection(); await startPlayback(); await onPlaying(); },
    retryCinema: element('button'), returnButton: element('button'), nowPlayingStatus: element(),
    async playVideoStack() { plays++; },
  };
  runInNewContext(namedImplementation('activateCinema'), context);
  await context.activateCinema(0);
  assert.equal(plays, 0);
  assert.equal(context.session.playback.id, null);
});

for (const change of ['same', 'removed', 'etag', 'url-only']) {
  test(`catalogue ${change} reconciles the actual loaded resource without unrelated audio mutation`, async () => {
    const before = { id: 'Cinema/film.mp4', folder: 'cinema', kind: 'video', src: 'https://media.example.test/Cinema/film.mp4', versionId: 'etag-1' };
    const mv = mediaElement(before.src), musicAudio = mediaElement('/song.mp3');
    const next = change === 'removed' ? [] : [{
      ...before, title: 'Retitled',
      ...(change === 'etag' ? { versionId: 'etag-2' } : {}),
      ...(change === 'url-only' ? { src: 'https://other.example.test/Cinema/film.mp4' } : {}),
    }];
    const context = { mv, runtimeSourceRecords: new Map(), hideMirrorWings() {}, console, document: { baseURI: 'https://viaims.test/' }, window: { innerWidth: 1000 }, eligibleVideoItems, URL };
    runInNewContext(namedImplementation('sameMediaSource') + namedImplementation('reconcileRuntimeSources'), context);
    await context.reconcileRuntimeSources([{ element: mv, mode: 'video', provider: 'cinema', id: before.id, src: before.src, item: before }], next);
    assert.equal(mv.currentTime, change === 'etag' ? 0 : 42);
    assert.equal(mv.loads, change === 'etag' ? 1 : 0);
    assert.equal(mv.plays, change === 'etag' ? 1 : 0);
    assert.equal(mv.muted, true);
    assert.equal(musicAudio.currentTime, 42); assert.equal(musicAudio.loads, 0);
  });
}

test('a removed Music selection advances into the current queue even in Repeat One', async () => {
  const items = [{ productId: 'Music/new.mp3', kind: 'audio', src: '/new.mp3', audioSrc: '/new.mp3' }];
  const calls = [];
  const context = {
    musicQueue: { ...createMusicQueue(items), currentProductId: 'Music/deleted.mp3', cursor: -1, repeat: 'one' },
    productById: new Map(items.map(item => [item.productId, item])), advanceMusicQueue, selectMusicItem,
    async activateMusicAudio(id) { calls.push(id); }, async returnMusicQueueToCinema() { calls.push('return'); },
  };
  runInNewContext(namedImplementation('advanceMusic'), context);
  await context.advanceMusic(1);
  assert.deepEqual(calls, ['Music/new.mp3']);
});

for (const kind of ['audio', 'video']) {
  test(`removing active Music ${kind}, enabling Shuffle and pressing Next selects the remaining row`, async () => {
    const removed = catalogueItem(`Music/removed.${kind === 'audio' ? 'mp3' : 'mp4'}`, 'music', kind);
    const remaining = catalogueItem('Music/remaining.mp3', 'music', 'audio', { playlistOrder: 1 });
    const ctx = catalogueRuntime([removed, remaining]);
    if (kind === 'video') {
      ctx.session = activateSource(ctx.session, { provider: 'music', id: removed.id, mode: 'video', snapshot: {} });
      ctx.mv.src = removed.src;
    }
    const loaded = kind === 'video' ? ctx.mv : ctx.musicAudio;
    await ctx.applyRuntimeLibrary(toRuntimeMediaLibrary([remaining]), [remaining]);
    assert.equal(loaded.src, removed.src);
    assert.equal(loaded.loads, 0);
    const calls = [];
    Object.assign(ctx, {
      selectMusicItem, advanceMusicQueue,
      async activateMusicAudio(id) { calls.push(id); },
      async returnMusicQueueToCinema() { calls.push('return'); },
    });
    runInNewContext(namedImplementation('advanceMusic'), ctx);
    ctx.musicQueue = toggleShuffle(ctx.musicQueue, () => 0);
    await ctx.advanceMusic(1);
    assert.deepEqual(calls, [remaining.id]);
    assert.deepEqual(Array.from(ctx.musicQueue.order), [remaining.id]);
  });
}

for (const [name, direction] of [['requestPrevious', -1], ['requestNext', 1]]) {
  for (const provider of ['music', 'cinema']) {
    test(`${name} dispatches once for ${provider}, including a Music boundary return`, async () => {
      let pending;
      const calls = [];
      const session = { playback: { provider, id: 'selected', mode: provider === 'music' ? 'audio' : 'video' }, lease: null };
      const context = {
        session, cinema: { cursor: 3 }, activeTransportPolicy,
        enqueueMediaControlTransition(fn) { pending = fn(); },
        async advanceMusic(step) {
          calls.push(['music', step]);
          session.playback = { provider: 'cinema', id: 'restored', mode: 'video' };
        },
        async activateCinema(index) { calls.push(['cinema', index]); },
      };
      runInNewContext(`${handlers}\n${name}();`, context);
      await pending;
      assert.deepEqual(calls, [[provider, provider === 'music' ? direction : 3 + direction]]);
    });
  }
}

test('Music Video lease participates in Previous and Next navigation', async () => {
  for (const [name, direction] of [['requestPrevious', -1], ['requestNext', 1]]) {
    let pending;
    const calls = [];
    const session = { playback: { provider: 'music', id: 'Music/clip.mov', mode: 'video' }, lease: { snapshot: {} } };
    runInNewContext(`${handlers}\n${name}();`, {
      session, activeTransportPolicy,
      enqueueMediaControlTransition(fn) { pending = fn(); },
      async advanceMusic(step) { calls.push(step); },
    });
    await pending;
    assert.deepEqual(calls, [direction]);
  }
});

test('Music order dispatches video rows to a native lease and audio rows to Music audio', async () => {
  const start = source.indexOf('\tasync function advanceMusic(direction)');
  const end = source.indexOf('\n\tasync function ', start + 1);
  const items = [
    { productId: 'Music/song.mp3', kind: 'audio', src: '/song.mp3', audioSrc: '/song.mp3' },
    { productId: 'Music/clip.mov', kind: 'video', src: '/clip.mov', videoSrc: '/clip.mov', title: 'Clip' },
    { productId: 'Music/last.mp3', kind: 'audio', src: '/last.mp3', audioSrc: '/last.mp3' },
  ];
  const calls = [];
  const context = {
    musicQueue: createMusicQueue(items), productById: new Map(items.map(item => [item.productId, item])),
    session: { playback: { provider: 'music', id: items[0].productId, mode: 'audio' } },
    advanceMusicQueue, selectMusicItem,
    async activateNativeLease(provider, id, src, title, { nextMusicQueue }) { calls.push(['video', id]); context.musicQueue = nextMusicQueue; },
    async activateMusicAudio(id, { nextMusicQueue }) { calls.push(['audio', id]); context.musicQueue = nextMusicQueue; },
    async returnMusicQueueToCinema() { calls.push(['return']); },
  };
  runInNewContext(source.slice(start, end), context);
  await context.advanceMusic(1); await context.advanceMusic(1); await context.advanceMusic(1);
  assert.deepEqual(calls, [['video', items[1].productId], ['audio', items[2].productId], ['return']]);
});
