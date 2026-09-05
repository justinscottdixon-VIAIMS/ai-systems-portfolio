import test from 'node:test';
import assert from 'node:assert/strict';
import { probeCatalogueItems } from '../src/lib/media-metadata-probe.mjs';

const catalogueItem = (id, kind, patch = {}) => ({
  id,
  versionId: 'etag-1',
  pathname: id,
  folder: kind === 'audio' ? 'music' : 'cinema',
  kind,
  title: kind === 'audio' ? 'Song' : 'Film',
  src: `https://media.example.test/${id}`,
  size: 1024,
  uploadedAt: '2026-09-04T12:00:00.000Z',
  playlistOrder: 0,
  ...patch,
});

function fakeTimers() {
  let nextId = 0;
  const pending = new Map();
  const cleared = [];
  return {
    setTimeout(callback, delay) {
      const handle = ++nextId;
      pending.set(handle, { callback, delay });
      return handle;
    },
    clearTimeout(handle) {
      cleared.push(handle);
      pending.delete(handle);
    },
    runAll() {
      for (const [handle, timer] of [...pending]) {
        pending.delete(handle);
        timer.callback();
      }
    },
    pending,
    cleared,
  };
}

function fakeMedia({ event = 'loadedmetadata', duration = 30, width = 0, height = 0 } = {}) {
  const listeners = new Map();
  const added = [];
  const removed = [];
  let loadCount = 0;
  let srcRemovalCount = 0;
  const element = {
    preload: '',
    src: '',
    duration,
    videoWidth: width,
    videoHeight: height,
    addEventListener(type, listener, options) {
      added.push([type, options]);
      listeners.set(type, listener);
    },
    removeEventListener(type, listener) {
      removed.push(type);
      if (listeners.get(type) === listener) listeners.delete(type);
    },
    removeAttribute(name) {
      assert.equal(name, 'src');
      srcRemovalCount += 1;
      this.src = '';
    },
    load() {
      loadCount += 1;
      if (loadCount === 1 && event) listeners.get(event)?.();
    },
  };
  return {
    element,
    listeners,
    added,
    removed,
    get loadCount() { return loadCount; },
    get srcRemovalCount() { return srcRemovalCount; },
  };
}

async function withTimers(run) {
  const timers = fakeTimers();
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  globalThis.setTimeout = timers.setTimeout;
  globalThis.clearTimeout = timers.clearTimeout;
  try {
    return await run(timers);
  } finally {
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  }
}

function assertCleaned(fake, timers) {
  assert.deepEqual(fake.added, [['loadedmetadata', { once: true }], ['error', { once: true }]]);
  assert.deepEqual(fake.removed, ['loadedmetadata', 'error']);
  assert.equal(fake.listeners.size, 0);
  assert.equal(fake.element.src, '');
  assert.equal(fake.srcRemovalCount, 1);
  assert.equal(fake.loadCount, 2);
  assert.equal(timers.pending.size, 0);
}

test('accepts playable items in endpoint order and cleans native probe resources', async () => {
  await withTimers(async (timers) => {
    const video = catalogueItem('Cinema/film.mp4', 'video');
    const audio = catalogueItem('Music/song.mp3', 'audio');
    const videoElement = fakeMedia({ width: 720, height: 1280 });
    const audioElement = fakeMedia({ duration: 123.5 });
    const elements = { video: videoElement, audio: audioElement };

    const result = await probeCatalogueItems([video, audio], {
      createMediaElement: (kind) => elements[kind].element,
      cache: new Map(),
      timeoutMs: 50,
    });

    assert.deepEqual(result, {
      accepted: [
        { ...video, width: 720, height: 1280, aspect: 'portrait' },
        audio,
      ],
      rejected: [],
    });
    assertCleaned(videoElement, timers);
    assertCleaned(audioElement, timers);
    assert.equal(timers.cleared.length, 2);
  });
});

test('rejects invalid metadata, errors, and timeouts with cleanup on every path', async () => {
  await withTimers(async (timers) => {
    const cases = [
      ['Music/zero.mp3', 'audio', fakeMedia({ duration: 0 }), 'invalid-duration'],
      ['Music/infinite.mp3', 'audio', fakeMedia({ duration: Infinity }), 'invalid-duration'],
      ['Cinema/unknown.mp4', 'video', fakeMedia({ width: 0, height: 1080 }), 'unknown-dimensions'],
      ['Cinema/fractional.mp4', 'video', fakeMedia({ width: 720.5, height: 1080 }), 'unknown-dimensions'],
      ['Cinema/broken.mp4', 'video', fakeMedia({ event: 'error' }), 'metadata-error'],
      ['Music/hung.mp3', 'audio', fakeMedia({ event: null }), 'metadata-timeout'],
    ];
    const byKind = new Map(cases.map(([id, kind, fake]) => [`${id}\u0000${kind}`, fake]));
    const promise = probeCatalogueItems(
      cases.map(([id, kind]) => catalogueItem(id, kind)),
      {
        createMediaElement: (kind) => {
          const match = cases.find(([id, candidateKind, fake]) => candidateKind === kind && fake.loadCount === 0);
          return byKind.get(`${match[0]}\u0000${kind}`).element;
        },
        cache: new Map(),
        timeoutMs: 50,
      },
    );

    assert.equal(timers.pending.size, 1);
    timers.runAll();
    assert.deepEqual(await promise, {
      accepted: [],
      rejected: cases.map(([id, , , reason]) => ({ id, reason })),
    });
    for (const [, , fake] of cases) assertCleaned(fake, timers);
    assert.equal(timers.cleared.length, cases.length);
  });
});

test('reuses settled acceptance and rejection only for the same id and version', async () => {
  await withTimers(async (timers) => {
    const cache = new Map();
    const firstVideo = fakeMedia({ width: 720, height: 1280 });
    const replacementVideo = fakeMedia({ width: 1920, height: 1080 });
    const brokenAudio = fakeMedia({ event: 'error' });
    const video = catalogueItem('Cinema/film.mp4', 'video');
    const createQueue = [firstVideo, replacementVideo, brokenAudio];
    let createCount = 0;
    const createMediaElement = () => createQueue[createCount++].element;

    const first = await probeCatalogueItems([video], { createMediaElement, cache, timeoutMs: 50 });
    assert.deepEqual(first.accepted[0], { ...video, width: 720, height: 1280, aspect: 'portrait' });
    assert.equal(cache.has('Cinema/film.mp4\u0000etag-1'), true);

    const reordered = { ...video, title: 'Renamed', playlistOrder: 4 };
    const cached = await probeCatalogueItems([reordered], { createMediaElement, cache, timeoutMs: 50 });
    assert.deepEqual(cached.accepted[0], {
      ...reordered,
      width: 720,
      height: 1280,
      aspect: 'portrait',
    });
    assert.equal(createCount, 1);

    const replacement = { ...video, versionId: 'etag-2' };
    const changed = await probeCatalogueItems([replacement], { createMediaElement, cache, timeoutMs: 50 });
    assert.deepEqual(changed.accepted[0], {
      ...replacement,
      width: 1920,
      height: 1080,
      aspect: 'landscape',
    });
    assert.equal(createCount, 2);

    const broken = catalogueItem('Music/broken.mp3', 'audio');
    const rejected = await probeCatalogueItems([broken], { createMediaElement, cache, timeoutMs: 50 });
    assert.deepEqual(rejected.rejected, [{ id: broken.id, reason: 'metadata-error' }]);
    const rejectedAgain = await probeCatalogueItems(
      [{ ...broken, title: 'Updated title' }],
      { createMediaElement, cache, timeoutMs: 50 },
    );
    assert.deepEqual(rejectedAgain.rejected, [{ id: broken.id, reason: 'metadata-error' }]);
    assert.equal(createCount, 3);

    for (const fake of createQueue) assertCleaned(fake, timers);
    assert.equal(timers.cleared.length, 3);
  });
});

test('aborting an awaiting metadata probe cleans its resources and leaves that version retryable', async () => {
  await withTimers(async (timers) => {
    const cache = new Map(), controller = new AbortController();
    const pending = fakeMedia({ event: null });
    const item = catalogueItem('Cinema/film.mp4', 'video');
    const result = probeCatalogueItems([item], {
      createMediaElement: () => pending.element, cache, signal: controller.signal, timeoutMs: 50,
    });
    controller.abort();
    assert.equal(timers.pending.size, 0);
    assertCleaned(pending, timers);
    await result;
    assert.equal(cache.size, 0);
    const retry = fakeMedia({ width: 720, height: 1280 });
    const accepted = await probeCatalogueItems([item], { createMediaElement: () => retry.element, cache });
    assert.equal(accepted.accepted.length, 1);
    assertCleaned(retry, timers);
  });
});
