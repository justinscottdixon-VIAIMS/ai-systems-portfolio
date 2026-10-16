import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { createMusicQueue, advanceMusicQueue, selectMusicItem, setRepeatMode } from '../src/lib/music-queue.mjs';
import { activeTransportPolicy, createEndedEventToken, isCurrentEndedEventToken } from '../src/lib/active-transport.mjs';
const source = await readFile(new URL('../src/components/HybridMediaEngine.astro', import.meta.url), 'utf8');
function named(name) {
  const start = source.search(new RegExp(`\\t(?:async )?function ${name}\\(`));
  assert.ok(start >= 0);
  const end = source.slice(start + 1).search(/\n\t(?:async )?function /);
  assert.ok(end >= 0);
  return source.slice(start, start + 1 + end);
}
const handlers = source.slice(source.indexOf("\tmusicAudio.addEventListener('ended'"), source.indexOf("\tmv.addEventListener('error'"));
const tracks = [
  { productId: 'a', kind: 'audio', audioSrc: '/a.mp3' },
  { productId: 'v', kind: 'video', videoSrc: '/v.mp4' },
  { productId: 'b', kind: 'audio', audioSrc: '/b.mp3' },
];
function harness({ repeat = 'all', id = 'a' } = {}) {
  const media = src => ({ src, addEventListener(type, fn) { this[type] = fn; } });
  const ctx = {
    referenceReturnState: {}, musicQueue: setRepeatMode(selectMusicItem(createMusicQueue(tracks), id), repeat),
    productById: new Map(tracks.map(t => [t.productId, t])), advanceMusicQueue, selectMusicItem,
    createEndedEventToken, isCurrentEndedEventToken,
    introSession: { phase: 'ready' }, musicAudio: media('/a.mp3'), mv: media('/v.mp4'),
    session: { playback: { provider: 'music', id, mode: id === 'v' ? 'video' : 'audio' }, lease: id === 'v' ? {} : null },
    transitionQueue: Promise.resolve(),
    enqueueTransition(fn) { this.transitionQueue = this.transitionQueue.then(fn); return this.transitionQueue; },
    async activateMusicAudio(id, { nextMusicQueue }) { ctx.musicQueue = nextMusicQueue; ctx.session.playback = { provider: 'music', id, mode: 'audio' }; ctx.session.lease = null; },
    async activateNativeLease(provider, id, src, title, { nextMusicQueue }) { ctx.musicQueue = nextMusicQueue; ctx.session.playback = { provider, id, mode: 'video' }; ctx.session.lease = {}; },
    async returnMusicQueueToCinema() { ctx.session.playback = { provider: 'cinema', id: 'film', mode: 'video' }; ctx.session.lease = null; },
  };
  ctx.enqueueTransition = ctx.enqueueTransition.bind(ctx);
  runInNewContext(named('advanceMusic') + handlers, ctx);
  return ctx;
}
test('natural completion advances audio → video → audio → wraps while a dossier remains open', async () => {
  const ctx = harness();
  for (const [element, expected] of [['musicAudio', 'v'], ['mv', 'b'], ['musicAudio', 'a']]) {
    ctx[element].ended(); await ctx.transitionQueue;
    assert.equal(ctx.session.playback.id, expected);
    assert.ok(ctx.referenceReturnState);
  }
});
for (const id of ['a', 'v']) test(`Repeat One repeats ${id} with a dossier open`, async () => {
  const ctx = harness({ repeat: 'one', id });
  let calls = 0; const activate = id === 'v' ? 'activateNativeLease' : 'activateMusicAudio';
  const original = ctx[activate]; ctx[activate] = (...args) => { calls++; return original(...args); };
  ctx[id === 'v' ? 'mv' : 'musicAudio'].ended(); await ctx.transitionQueue;
  assert.equal(calls, 1); assert.equal(ctx.session.playback.id, id);
});
test('Repeat Off returns at queue end without closing the dossier', async () => {
  const ctx = harness({ repeat: 'off', id: 'b' });
  ctx.musicAudio.ended(); await ctx.transitionQueue;
  assert.equal(ctx.session.playback.provider, 'cinema'); assert.ok(ctx.referenceReturnState);
});
test('a stale queued ended event cannot advance a newly selected track', async () => {
  const ctx = harness();
  ctx.musicAudio.ended(); ctx.session.playback = { provider: 'music', id: 'b', mode: 'audio' };
  await ctx.transitionQueue; assert.equal(ctx.session.playback.id, 'b');
});
for (const lease of [null, {}]) test(`Credentials loop policy follows actual stage ownership, lease=${Boolean(lease)}`, () => {
  const ctx = { referenceReturnState: {}, session: { lease }, mv: { loop: !lease },
    transportPlayback: () => ({ provider: 'music', id: 'v', mode: 'video' }), activeTransportPolicy,
    renderQueueControls() {}, transportControls: [], entryControlsLocked: false, syncCinemaCueAvailability() {}, syncActivePlayButton() {}, renderFullscreenSession() {} };
  runInNewContext(named('applyActiveTransportPolicy'), ctx);
  ctx.session.lease = lease ? null : {};
  ctx.applyActiveTransportPolicy();
  assert.equal(ctx.mv.loop, Boolean(lease), 'only background Cinema may loop during dossier reading');
});
test('closing a dossier after progression restores the current identity without restarting playback', () => {
  const title = { textContent: 'Second track' }, moves = [], refreshed = [];
  const ctx = { referenceReturnState: { masterLoop: false, ui: { title: 'First track' }, transport: { provider: 'music', id: 'a', mode: 'audio' } },
    referenceStage: { dataset: {}, hidden: false }, referencePanels: [{ dataset: { referencePanel: 'dossier' } }], referenceIndex: 0, referenceSlideIndex: 2,
    stage: { dataset: {} }, playerDock: { dataset: {} }, playerIdentity: {}, playerTransport: {},
    playerTransportHome: { append(...nodes) { moves.push(nodes); } }, fadeTheaterView() {}, restoreVideoFromPip: {}, mv: { loop: true },
    session: { activeTab: 'music' }, root: { querySelector: () => ({ setAttribute() {} }) }, referenceTriggers: [],
    restoreControllerUi(ui) { title.textContent = ui.title; }, transportPlayback: () => ({ provider: 'music', id: 'b', mode: 'audio' }),
    renderTransportDeckIdentity(provider) { refreshed.push(provider); title.textContent = 'Second track'; },
  };
  runInNewContext(named('closeReference'), ctx); ctx.closeReference();
  assert.equal(title.textContent, 'Second track'); assert.equal(ctx.mv.loop, false);
  assert.equal(ctx.referenceReturnState, null); assert.equal(moves.length, 1); assert.deepEqual(refreshed, ['music']);
});

test('Credentials directory stays in the theater and previews without opening or restarting playback', () => {
  const choices = ['first', 'second'].map(id => ({ dataset: { previewReference: id }, setAttribute(key, value) { this[key] = value; }, focus() { this.focused = true; } }));
  const previews = ['first', 'second'].map(id => ({ dataset: { directoryPreview: id }, hidden: true }));
  const ctx = {
    referencePanels: [{ dataset: { referencePanel: 'first' } }], referenceIndex: 0,
    referenceStage: { dataset: {} }, referenceStatus: {},
    root: { querySelectorAll(selector) { return selector === '[data-preview-reference]' ? choices : previews; } },
  };
  // Extract only the two functions; the following listener block is tested through the browser.
  const start = source.indexOf('\tfunction previewReferenceDirectory(');
  const end = source.indexOf("\n\tcloseReferenceButton?.addEventListener", start);
  runInNewContext(source.slice(start, end), ctx);
  ctx.showReferenceDirectory();
  assert.equal(ctx.referenceStage.dataset.view, 'directory');
  assert.equal(choices[0].focused, true);
  assert.equal(previews[0].hidden, false);
  ctx.previewReferenceDirectory('second');
  assert.equal(previews[0].hidden, true);
  assert.equal(previews[1].hidden, false);
  assert.equal(choices[1]['aria-pressed'], 'true');
  assert.equal(ctx.referenceIndex, 0, 'previewing must not change the active dossier');
  assert.equal(ctx.referenceStatus.textContent, '02 / 02 · BROWSE');
});

test('Credentials tab opens the directory, while a named dossier opens directly', () => {
  const calls = [];
  const triggers = ['', 'studio-evolution'].map(id => ({ dataset:{openReference:id}, addEventListener(type,fn) { this.click=fn; } }));
  const start = source.indexOf('\tfor (const trigger of referenceTriggers) {\n\t\ttrigger.addEventListener');
  const end = source.indexOf('\n\tfunction previewReferenceDirectory',start);
  const ctx = {referenceTriggers:triggers,openReference(id) { calls.push(['open',id]); },showReferenceDirectory() { calls.push(['directory']); }};
  runInNewContext(source.slice(start,end),ctx);
  triggers[0].click();
  assert.deepEqual(calls,[['open',''],['directory']]);
  calls.length=0;
  triggers[1].click();
  assert.deepEqual(calls,[['open','studio-evolution']]);
});
