# Tabbed Media Library and Adaptive Music Player Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the rejected Mastering Console Shelf with an accessible Stage Command Header and tabbed `Cinema | Music | Media | YouTube` library backed by independent catalogs, a product-aware Music queue, and reversible native stage leases.

**Architecture:** Preserve the approved Cinematic Mirror Wings and current manifest ingestion, but move catalog projection, queue state, and stage leases into browser-neutral modules with Node tests. `HybridMediaEngine.astro` remains the page composition root and binds the native `<video>` and `<audio>` elements to those modules. Provider-specific curated data lives separately so Cinema, Music, Media, and YouTube never collapse into one hierarchy.

**Tech Stack:** Astro 7, Tailwind CSS 4, native HTML5 media, Web Audio API, YouTube IFrame Player API, ECMAScript modules, Node 22 built-in test runner.

## Global Constraints

- Keep commit `84816cd` Cinematic Mirror Wings behavior intact; the sharp Cinema master remains undistorted, uncropped, centered, and the only semantic native video.
- The Mastering Console Shelf from `beecd4b` is rejected and must be replaced, not expanded.
- Tab selection changes browse state only; playback changes only after explicit item activation.
- Cinema, Music, Media, and YouTube keep independent schemas, selections, and queues.
- Music uses one stable track/product identity with a required audio master and optional music-video asset.
- Music-video and owned-Media activation use a reversible stage lease; the exact Cinema source, time, play/pause, mute, and mirror state must restore on release.
- The embedded music-video or owned-Media soundtrack is authoritative and meterable while that native source is active.
- YouTube playback must remain fully visible and unobscured; YouTube is always labeled `External Source · Metering Unavailable`.
- Reserve truthful meter bays in the approved header, but keep them explicitly `METERS PENDING` in this foundation; do not animate or simulate values. Meter engine implementation is outside this visual-gate plan.
- Expose stable product IDs and store URLs in DOM data without implementing persistence, cart mutation, checkout, or downloads in this foundation.
- Do not fabricate production music-video, Media, or YouTube content. Empty provider states are valid until real IDs/assets are supplied; automated fixtures must exercise every behavior.
- Do not change Vercel Blob ingestion, immutable media URLs, Publications & Credits, production hosting, DNS, deployment, or media acquisition.
- Run every implementation step in strict RED/GREEN order and commit only after its focused and complete tests pass.
- After Task 3, stop for focused tests, full tests, build verification, macOS Safari/Chromium review, remote phone review when needed, and Justin's explicit visual approval. Do not begin any follow-up meter, persistence, commerce, or live YouTube plan before that approval.

---

## File map

| File | Responsibility |
| --- | --- |
| `src/lib/media-library.mjs` | Project manifest and curated-provider data into independent Cinema, Music, Media, and YouTube catalogs |
| `src/lib/music-queue.mjs` | Product-stable selection, Audio/Video mode, shuffle, repeat, and deterministic advance |
| `src/lib/playback-session.mjs` | Browse state, audible owner, Cinema snapshot, reversible stage-lease transitions |
| `src/data/curated-media.json` | Explicit owned-Media and YouTube entries; initially empty rather than fabricated |
| `src/components/HybridMediaEngine.astro` | Stage Command Header, native media elements, tabbed library, provider panels, store action, external-player host |
| `src/styles/hybrid-media-engine.css` | Existing mirror stage plus command header, meters, tabs, panels, mobile layout, YouTube source-card states |
| `tests/media-library.test.mjs` | Catalog separation and stable product identity |
| `tests/music-queue.test.mjs` | Queue, shuffle, repeat, and mode transitions |
| `tests/playback-session.test.mjs` | Browse/play independence and exact lease snapshot/restore rules |
| `tests/hybrid-media-engine.test.mjs` | Astro/CSS source contracts for approved hierarchy, accessibility, and provider states |

---

### Task 1: Define independent catalogs and the product-stable Music queue

**Files:**
- Create: `src/lib/media-library.mjs`
- Create: `src/lib/music-queue.mjs`
- Create: `src/data/curated-media.json`
- Create: `tests/media-library.test.mjs`
- Create: `tests/music-queue.test.mjs`

**Interfaces:**
- Consumes: the parsed version-1 manifest shape from `parseMediaManifest()` and curated data shaped as `{ version: 1, media: [...], youtube: [...] }`.
- Produces: `toMediaLibrary(manifest, curated)`, `createMusicQueue(items)`, `selectMusicMode(queue, productId, mode)`, `advanceMusicQueue(queue, direction, random)`, `setRepeatMode(queue, mode)`, and `toggleShuffle(queue)`.

- [ ] **Step 1: Write failing catalog-projection tests**

Create `tests/media-library.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { toMediaLibrary } from '../src/lib/media-library.mjs';

const manifest = {
  version: 1,
  generatedAt: '2026-08-30T00:00:00.000Z',
  items: [
    { id: 'video-atlas', kind: 'video', title: 'Atlas', src: 'https://cdn.example/atlas.mp4', specs: 'MP4', engine: 'Sora' },
    { id: 'audio-north', kind: 'audio', title: 'Magnetic North', src: 'https://cdn.example/north.wav', specs: '24-bit WAV' },
  ],
};

const curated = {
  version: 1,
  music: [{
    productId: 'audio-north',
    musicVideoSrc: 'https://cdn.example/north-video.mp4',
  }],
  media: [{ id: 'media-reel', title: 'Systems Reel', src: 'https://cdn.example/reel.mp4', specs: 'MP4' }],
  youtube: [{ id: 'youtube-mix', title: 'Mix Walkthrough', videoId: 'M7lc1UVf-VE' }],
};

test('toMediaLibrary keeps four independent providers', () => {
  const library = toMediaLibrary(manifest, curated);
  assert.deepEqual(library.cinema.map((item) => item.id), ['video-atlas']);
  assert.deepEqual(library.music.map((item) => item.productId), ['audio-north']);
  assert.deepEqual(library.media.map((item) => item.id), ['media-reel']);
  assert.deepEqual(library.youtube.map((item) => item.id), ['youtube-mix']);
});

test('one Music product contains audio and optional video modes without entering Cinema', () => {
  const library = toMediaLibrary(manifest, curated);
  assert.equal(library.music[0].audioSrc, 'https://cdn.example/north.wav');
  assert.equal(library.music[0].videoSrc, 'https://cdn.example/north-video.mp4');
  assert.equal(library.music[0].storeHref, '/store?product=audio-north');
  assert.equal(library.cinema.some((item) => item.src === library.music[0].videoSrc), false);
});

test('empty curated providers produce explicit empty arrays without fabricated items', () => {
  const library = toMediaLibrary(manifest, { version: 1, music: [], media: [], youtube: [] });
  assert.deepEqual(library.media, []);
  assert.deepEqual(library.youtube, []);
  assert.equal(library.music[0].videoSrc, null);
});

test('curated entries must reference real Music products and HTTPS media', () => {
  assert.throws(
    () => toMediaLibrary(manifest, { ...curated, music: [{ productId: 'missing' }] }),
    /unknown Music product: missing/,
  );
  assert.throws(
    () => toMediaLibrary(manifest, { ...curated, media: [{ id: 'bad', title: 'Bad', src: '/local.mp4', specs: 'MP4' }] }),
    /must be an HTTPS URL/,
  );
});
```

- [ ] **Step 2: Run the catalog test and verify RED**

Run: `node --test tests/media-library.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/lib/media-library.mjs`.

- [ ] **Step 3: Implement the catalog projector and empty curated data**

Create `src/data/curated-media.json`:

```json
{
  "version": 1,
  "music": [],
  "media": [],
  "youtube": []
}
```

Create `src/lib/media-library.mjs`:

```js
function httpsUrl(value, label) {
  let url;
  try { url = new URL(value); } catch { throw new TypeError(`${label} must be an HTTPS URL`); }
  if (url.protocol !== 'https:') throw new TypeError(`${label} must be an HTTPS URL`);
  return value;
}

function required(value, label) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${label} must be a non-empty string`);
  return value;
}

export function toMediaLibrary(manifest, curated = { version: 1, music: [], media: [], youtube: [] }) {
  if (curated?.version !== 1) throw new TypeError('curated media version must be 1');
  const cinema = manifest.items
    .filter((item) => item.kind === 'video')
    .map((item) => ({ ...item, provider: 'cinema', engine: item.engine ?? 'AI Render' }));
  const audioById = new Map(manifest.items.filter((item) => item.kind === 'audio').map((item) => [item.id, item]));
  const overrides = new Map((curated.music ?? []).map((item) => [item.productId, item]));
  for (const productId of overrides.keys()) {
    if (!audioById.has(productId)) throw new TypeError(`unknown Music product: ${productId}`);
  }
  const music = [...audioById.values()].map((item) => {
    const extra = overrides.get(item.id) ?? {};
    return {
      provider: 'music',
      productId: item.id,
      title: item.title,
      specs: item.specs,
      audioSrc: item.src,
      videoSrc: extra.musicVideoSrc ? httpsUrl(extra.musicVideoSrc, `music ${item.id} video`) : null,
      storeHref: `/store?product=${encodeURIComponent(item.id)}`,
    };
  });
  const media = (curated.media ?? []).map((item, index) => ({
    provider: 'media',
    id: required(item.id, `media[${index}].id`),
    title: required(item.title, `media[${index}].title`),
    src: httpsUrl(item.src, `media[${index}].src`),
    specs: required(item.specs, `media[${index}].specs`),
  }));
  const youtube = (curated.youtube ?? []).map((item, index) => ({
    provider: 'youtube',
    id: required(item.id, `youtube[${index}].id`),
    title: required(item.title, `youtube[${index}].title`),
    videoId: required(item.videoId, `youtube[${index}].videoId`),
  }));
  return { cinema, music, media, youtube };
}
```

- [ ] **Step 4: Run catalog tests and verify GREEN**

Run: `node --test tests/media-library.test.mjs`

Expected: 4 tests pass, 0 fail.

- [ ] **Step 5: Write failing Music queue tests**

Create `tests/music-queue.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceMusicQueue,
  createMusicQueue,
  selectMusicMode,
  setRepeatMode,
  toggleShuffle,
} from '../src/lib/music-queue.mjs';

const tracks = [
  { productId: 'a', audioSrc: 'a.wav', videoSrc: 'a.mp4' },
  { productId: 'b', audioSrc: 'b.wav', videoSrc: null },
  { productId: 'c', audioSrc: 'c.wav', videoSrc: 'c.mp4' },
];

test('queue starts on one product identity in Audio mode', () => {
  const queue = createMusicQueue(tracks);
  assert.equal(queue.currentProductId, 'a');
  assert.equal(queue.mode, 'audio');
  assert.deepEqual(queue.order, ['a', 'b', 'c']);
});

test('mode selection preserves queue position and rejects missing video', () => {
  const queue = selectMusicMode(createMusicQueue(tracks), 'a', 'video');
  assert.equal(queue.currentProductId, 'a');
  assert.equal(queue.mode, 'video');
  assert.throws(() => selectMusicMode(queue, 'b', 'video'), /has no video asset/);
});

test('shuffle preserves the current product and randomizes only upcoming items', () => {
  const selected = selectMusicMode(createMusicQueue(tracks), 'b', 'audio');
  const shuffled = toggleShuffle(selected, () => 0);
  assert.equal(shuffled.currentProductId, 'b');
  assert.equal(shuffled.order[shuffled.cursor], 'b');
  assert.equal(shuffled.shuffle, true);
});

test('Repeat Off ends, Repeat All wraps, and Repeat One retains the current product', () => {
  let queue = selectMusicMode(createMusicQueue(tracks), 'c', 'audio');
  assert.equal(advanceMusicQueue(queue, 1), null);
  queue = setRepeatMode(queue, 'all');
  assert.equal(advanceMusicQueue(queue, 1).currentProductId, 'a');
  queue = setRepeatMode(queue, 'one');
  assert.equal(advanceMusicQueue(queue, 1).currentProductId, 'c');
});
```

- [ ] **Step 6: Run the queue tests and verify RED**

Run: `node --test tests/music-queue.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/lib/music-queue.mjs`.

- [ ] **Step 7: Implement the Music queue**

Create `src/lib/music-queue.mjs`:

```js
const REPEAT = new Set(['off', 'all', 'one']);

function copy(queue, updates) { return { ...queue, ...updates, order: [...(updates.order ?? queue.order)] }; }

export function createMusicQueue(items) {
  const tracks = new Map(items.map((item) => [item.productId, item]));
  const order = items.map((item) => item.productId);
  return { tracks, order, cursor: 0, currentProductId: order[0] ?? null, mode: 'audio', shuffle: false, repeat: 'off' };
}

export function selectMusicMode(queue, productId, mode) {
  const track = queue.tracks.get(productId);
  if (!track) throw new RangeError(`unknown Music product: ${productId}`);
  if (mode !== 'audio' && mode !== 'video') throw new TypeError(`unsupported Music mode: ${mode}`);
  if (mode === 'video' && !track.videoSrc) throw new TypeError(`Music product ${productId} has no video asset`);
  const cursor = queue.order.indexOf(productId);
  return copy(queue, { currentProductId: productId, cursor, mode });
}

export function setRepeatMode(queue, repeat) {
  if (!REPEAT.has(repeat)) throw new TypeError(`unsupported repeat mode: ${repeat}`);
  return copy(queue, { repeat });
}

export function toggleShuffle(queue, random = Math.random) {
  if (queue.shuffle) return copy(queue, { shuffle: false, order: [...queue.tracks.keys()], cursor: [...queue.tracks.keys()].indexOf(queue.currentProductId) });
  const upcoming = queue.order.filter((id) => id !== queue.currentProductId);
  for (let index = upcoming.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [upcoming[index], upcoming[target]] = [upcoming[target], upcoming[index]];
  }
  return copy(queue, { shuffle: true, order: [queue.currentProductId, ...upcoming], cursor: 0 });
}

export function advanceMusicQueue(queue, direction = 1) {
  if (!queue.currentProductId) return null;
  if (queue.repeat === 'one' && direction > 0) return copy(queue, {});
  let cursor = queue.cursor + Math.sign(direction || 1);
  if (cursor < 0 || cursor >= queue.order.length) {
    if (queue.repeat !== 'all') return null;
    cursor = cursor < 0 ? queue.order.length - 1 : 0;
  }
  return copy(queue, { cursor, currentProductId: queue.order[cursor], mode: 'audio' });
}
```

- [ ] **Step 8: Run focused and complete tests**

Run: `node --test tests/media-library.test.mjs tests/music-queue.test.mjs`

Expected: 8 tests pass, 0 fail.

Run: `npm test`

Expected: complete suite passes with 0 failures.

- [ ] **Step 9: Commit Task 1**

```bash
git add src/lib/media-library.mjs src/lib/music-queue.mjs src/data/curated-media.json tests/media-library.test.mjs tests/music-queue.test.mjs
git commit -m "feat: define independent media catalogs"
```

---

### Task 2: Add browse-independent playback state and reversible stage leases

**Files:**
- Create: `src/lib/playback-session.mjs`
- Create: `tests/playback-session.test.mjs`
- Modify: `src/lib/media-presentation.mjs`
- Modify: `tests/media-presentation.test.mjs`

**Interfaces:**
- Consumes: provider names `cinema | music | media | youtube`, native media-like objects, and the existing aspect classifier.
- Produces: `createPlaybackSession()`, `selectBrowseTab()`, `activateSource()`, `releaseStageLease()`, `captureCinemaSnapshot(video, stage)`, and `restoreCinemaSnapshot(video, stage, snapshot)`.

- [ ] **Step 1: Write failing session-state tests**

Create `tests/playback-session.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  activateSource,
  createPlaybackSession,
  releaseStageLease,
  selectBrowseTab,
} from '../src/lib/playback-session.mjs';

const snapshot = { src: 'cinema.mp4', currentTime: 42, paused: false, muted: false, aspect: 'portrait' };

test('changing tabs never changes active playback', () => {
  const session = createPlaybackSession({ cinemaId: 'atlas' });
  const browsed = selectBrowseTab(session, 'youtube');
  assert.equal(browsed.activeTab, 'youtube');
  assert.deepEqual(browsed.playback, session.playback);
});

test('Music audio owns the audible bus without taking the stage', () => {
  const session = activateSource(createPlaybackSession({ cinemaId: 'atlas' }), { provider: 'music', id: 'north', mode: 'audio' });
  assert.equal(session.playback.audibleOwner, 'music');
  assert.equal(session.playback.stageOwner, 'cinema');
  assert.equal(session.lease, null);
});

test('Music video and Media acquire a lease while direct switching retains the snapshot', () => {
  let session = activateSource(createPlaybackSession({ cinemaId: 'atlas' }), { provider: 'music', id: 'north', mode: 'video', snapshot });
  assert.equal(session.playback.stageOwner, 'music');
  assert.deepEqual(session.lease.snapshot, snapshot);
  session = activateSource(session, { provider: 'media', id: 'reel', mode: 'video' });
  assert.equal(session.playback.stageOwner, 'media');
  assert.deepEqual(session.lease.snapshot, snapshot);
});

test('release restores Cinema ownership and exposes the saved snapshot', () => {
  const leased = activateSource(createPlaybackSession({ cinemaId: 'atlas' }), { provider: 'music', id: 'north', mode: 'video', snapshot });
  const released = releaseStageLease(leased);
  assert.equal(released.session.playback.stageOwner, 'cinema');
  assert.equal(released.session.playback.audibleOwner, snapshot.muted ? null : 'cinema');
  assert.deepEqual(released.snapshot, snapshot);
});

test('YouTube is audible but explicitly not meterable', () => {
  const session = activateSource(createPlaybackSession({ cinemaId: 'atlas' }), { provider: 'youtube', id: 'mix', mode: 'external', snapshot });
  assert.equal(session.playback.audibleOwner, 'youtube');
  assert.equal(session.playback.meterSource, null);
  assert.equal(session.playback.meterStatus, 'external-unavailable');
});
```

- [ ] **Step 2: Run session tests and verify RED**

Run: `node --test tests/playback-session.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement immutable session transitions**

Create `src/lib/playback-session.mjs`:

```js
const TABS = new Set(['cinema', 'music', 'media', 'youtube']);

export function createPlaybackSession({ cinemaId, cinemaMuted = true } = {}) {
  return {
    activeTab: 'cinema',
    playback: {
      provider: 'cinema', id: cinemaId ?? null, mode: 'video', stageOwner: 'cinema',
      audibleOwner: cinemaMuted ? null : 'cinema', meterSource: cinemaMuted ? null : 'cinema', meterStatus: cinemaMuted ? 'idle' : 'native',
    },
    lease: null,
  };
}

export function selectBrowseTab(session, activeTab) {
  if (!TABS.has(activeTab)) throw new TypeError(`unsupported media tab: ${activeTab}`);
  return { ...session, activeTab };
}

export function activateSource(session, activation) {
  if (!TABS.has(activation.provider)) throw new TypeError(`unsupported provider: ${activation.provider}`);
  if (activation.provider === 'music' && activation.mode === 'audio') {
    return { ...session, playback: { provider: 'music', id: activation.id, mode: 'audio', stageOwner: 'cinema', audibleOwner: 'music', meterSource: 'music', meterStatus: 'native' } };
  }
  if (activation.provider === 'cinema') {
    return { ...session, lease: null, playback: { provider: 'cinema', id: activation.id, mode: 'video', stageOwner: 'cinema', audibleOwner: activation.muted ? null : 'cinema', meterSource: activation.muted ? null : 'cinema', meterStatus: activation.muted ? 'idle' : 'native' } };
  }
  const lease = session.lease ?? { snapshot: activation.snapshot };
  if (!lease.snapshot) throw new TypeError('stage lease requires a Cinema snapshot');
  const external = activation.provider === 'youtube';
  return {
    ...session,
    lease,
    playback: { provider: activation.provider, id: activation.id, mode: activation.mode, stageOwner: activation.provider, audibleOwner: activation.provider, meterSource: external ? null : activation.provider, meterStatus: external ? 'external-unavailable' : 'native' },
  };
}

export function releaseStageLease(session) {
  if (!session.lease) return { session, snapshot: null };
  const snapshot = session.lease.snapshot;
  return {
    snapshot,
    session: { ...session, lease: null, playback: { provider: 'cinema', id: snapshot.id ?? null, mode: 'video', stageOwner: 'cinema', audibleOwner: snapshot.muted ? null : 'cinema', meterSource: snapshot.muted ? null : 'cinema', meterStatus: snapshot.muted ? 'idle' : 'native' } },
  };
}
```

- [ ] **Step 4: Run session tests and verify GREEN**

Run: `node --test tests/playback-session.test.mjs`

Expected: 5 tests pass, 0 fail.

- [ ] **Step 5: Add failing exact Cinema snapshot/restore tests**

Append to `tests/media-presentation.test.mjs`:

```js
test('captureCinemaSnapshot and restoreCinemaSnapshot preserve exact stage state', async () => {
  const video = media({ src: 'cinema.mp4', currentTime: 27.5, paused: false, muted: false });
  const stage = { dataset: { mediaAspect: 'portrait' } };
  const snapshot = captureCinemaSnapshot(video, stage);
  video.src = 'music-video.mp4'; video.currentTime = 0; video.paused = true; video.muted = true; stage.dataset.mediaAspect = 'landscape';
  await restoreCinemaSnapshot(video, stage, snapshot);
  assert.equal(video.src, 'cinema.mp4');
  assert.equal(video.currentTime, 27.5);
  assert.equal(video.muted, false);
  assert.equal(video.paused, false);
  assert.equal(stage.dataset.mediaAspect, 'portrait');
});
```

Add `captureCinemaSnapshot` and `restoreCinemaSnapshot` to the existing import list.

- [ ] **Step 6: Run the snapshot test and verify RED**

Run: `node --test tests/media-presentation.test.mjs`

Expected: FAIL because the two exports do not exist.

- [ ] **Step 7: Implement exact snapshot and restoration helpers**

Append to `src/lib/media-presentation.mjs`:

```js
export function captureCinemaSnapshot(video, stage, id = null) {
  return { id, src: video.currentSrc || video.src, currentTime: video.currentTime, paused: video.paused, muted: video.muted, aspect: stage.dataset.mediaAspect };
}

export async function restoreCinemaSnapshot(video, stage, snapshot) {
  video.pause();
  video.src = snapshot.src;
  video.load?.();
  if (typeof video.readyState === 'number' && video.readyState < 1) {
    await new Promise((resolve) => video.addEventListener('loadedmetadata', resolve, { once: true }));
  }
  video.currentTime = snapshot.currentTime;
  video.muted = snapshot.muted;
  stage.dataset.mediaAspect = snapshot.aspect;
  if (!snapshot.paused) await video.play();
}
```

- [ ] **Step 8: Run focused and complete tests**

Run: `node --test tests/playback-session.test.mjs tests/media-presentation.test.mjs`

Expected: focused tests pass with 0 failures.

Run: `npm test`

Expected: complete suite passes with 0 failures.

- [ ] **Step 9: Commit Task 2**

```bash
git add src/lib/playback-session.mjs tests/playback-session.test.mjs src/lib/media-presentation.mjs tests/media-presentation.test.mjs
git commit -m "feat: add reversible media stage leases"
```

---

### Task 3: Replace the rejected console with the Stage Command Header and tabbed library

**Files:**
- Modify: `src/components/HybridMediaEngine.astro`
- Modify: `src/styles/hybrid-media-engine.css`
- Modify: `tests/hybrid-media-engine.test.mjs`

**Interfaces:**
- Consumes: `toMediaLibrary()`, Music queue functions, playback-session functions, existing mirror helpers, `manifest`, and `curated-media.json`.
- Produces: `[data-stage-command-header]`, `[data-media-library]`, `role="tablist"`, four provider tabpanels, `#music-audio`, `#return-to-cinema`, source-card state, and browse/playback separation in the browser controller.

- [ ] **Step 1: Replace the rejected-console source contract with failing approved-hierarchy tests**

Replace the final test in `tests/hybrid-media-engine.test.mjs` with:

```js
test('command header precedes the shared stage and tabbed Media Library', async () => {
  const component = await source(componentPath);
  const header = component.indexOf('data-stage-command-header');
  const stage = component.indexOf('id="master-stage-container"');
  const library = component.indexOf('data-media-library');
  assert.equal(header > -1 && stage > header && library > stage, true);
  assert.doesNotMatch(component, /data-mastering-console/);
  assert.match(component, /id="now-playing-status"[^>]+aria-live="polite"/s);
  assert.match(component, /id="return-to-cinema"/);
  assert.match(component, /id="music-audio"/);
});

test('Media Library exposes four accessible tabs and independent panels', async () => {
  const component = await source(componentPath);
  assert.match(component, /role="tablist"[^>]+aria-label="Media Library"/s);
  for (const provider of ['cinema', 'music', 'media', 'youtube']) {
    assert.match(component, new RegExp(`id="tab-${provider}"[^>]+role="tab"`, 's'));
    assert.match(component, new RegExp(`id="panel-${provider}"[^>]+role="tabpanel"`, 's'));
  }
  assert.match(component, /selectBrowseTab\(/);
});

test('Music rows keep one product identity with distinct Audio and optional Video actions', async () => {
  const component = await source(componentPath);
  assert.match(component, /data-product-id=/);
  assert.match(component, /data-music-mode="audio"/);
  assert.match(component, /data-music-mode="video"/);
  assert.match(component, /id="music-shuffle"/);
  assert.match(component, /id="music-repeat"/);
  assert.match(component, /id="buy-license"/);
  assert.match(component, /id="cart-count"/);
});

test('responsive CSS stacks the command header and keeps a scrollable four-tab bar', async () => {
  const css = await source(stylePath);
  assert.match(css, /\.stage-command-header/);
  assert.match(css, /\.engineering-meters/);
  assert.match(css, /\.media-library__tabs/);
  assert.match(css, /overflow-x:\s*auto/);
  assert.match(css, /@media\s*\(max-width:\s*767px\)/);
});
```

In the existing `hybrid engine imports presentation rules and classifies source metadata` test, replace the two obsolete cue-hook assertions:

```js
assert.match(component, /data-cinema-src=/);
assert.match(component, /data-audio-src=/);
```

Remove its former `/data-v-src=/` and `/data-a-src=/` assertions so the test describes the new provider-specific DOM contract.

- [ ] **Step 2: Run the component contract and verify RED**

Run: `node --test tests/hybrid-media-engine.test.mjs`

Expected: FAIL because the rejected console remains and approved hooks are absent.

- [ ] **Step 3: Project provider data and add the approved semantic skeleton**

At the top of `HybridMediaEngine.astro`, replace `toPlaylists()` usage with:

```astro
---
import { toMediaLibrary } from '../lib/media-library.mjs';
import curatedMedia from '../data/curated-media.json';
import '../styles/hybrid-media-engine.css';

const { manifest } = Astro.props;
const library = toMediaLibrary(manifest, curatedMedia);
const [firstCinema] = library.cinema;
const [firstMusic] = library.music;
---
```

Inside `[data-hybrid-media-engine]`, use this order and retain the existing mirror-wing markup inside the stage:

```astro
<section data-stage-command-header class="stage-command-header" aria-label="Active media controls">
  <div class="stage-command-header__identity">
    <span id="active-source-kind">CINEMA</span>
    <strong id="now-playing-title">{firstCinema?.title ?? 'No Media Loaded'}</strong>
    <span id="now-playing-status" aria-live="polite">CINEMA READY</span>
  </div>
  <div class="stage-command-header__transport" aria-label="Active source transport">
    <button id="active-prev" aria-label="Previous active item">⏮</button>
    <button id="active-play" aria-label="Play active item">PLAY</button>
    <button id="active-next" aria-label="Next active item">⏭</button>
    <button id="music-shuffle" aria-pressed="false">SHUFFLE</button>
    <button id="music-repeat" data-repeat="off">REPEAT OFF</button>
    <button id="return-to-cinema" hidden>RETURN TO CINEMA</button>
  </div>
  <div class="engineering-meters" data-meter-status="pending" aria-label="Stereo engineering meters">
    <span id="meter-status">METERS PENDING</span>
    <div data-meter-channel="left"><span>L</span><meter id="meter-l" min="-60" max="0" value="-60"></meter><output id="meter-l-value">−∞</output><span id="clip-l">CLIP</span></div>
    <div data-meter-channel="right"><span>R</span><meter id="meter-r" min="-60" max="0" value="-60"></meter><output id="meter-r-value">−∞</output><span id="clip-r">CLIP</span></div>
  </div>
  <div class="stage-command-header__commerce"><span>CART</span><output id="cart-count">0</output></div>
</section>

<!-- existing #master-stage-container with #master-video and mirror wings stays here -->
<audio id="music-audio" src={firstMusic?.audioSrc ?? ''} preload="metadata"></audio>

<section data-media-library class="media-library" aria-label="Media Library">
  <div class="media-library__tabs" role="tablist" aria-label="Media Library">
    {(['cinema', 'music', 'media', 'youtube']).map((provider, index) => (
      <button id={`tab-${provider}`} role="tab" aria-selected={index === 0 ? 'true' : 'false'} aria-controls={`panel-${provider}`} tabindex={index === 0 ? '0' : '-1'} data-media-tab={provider}>{provider.toUpperCase()}</button>
    ))}
  </div>
  <div id="panel-cinema" role="tabpanel" aria-labelledby="tab-cinema" data-provider-panel="cinema">
    {library.cinema.map((item, index) => (
      <button class="cinema-cue" data-cinema-index={index} data-cinema-id={item.id} data-cinema-src={item.src} data-cinema-title={item.title} data-cinema-specs={item.specs}>
        <span>{item.title}</span><span>{item.specs}</span>
      </button>
    ))}
  </div>
  <div id="panel-music" role="tabpanel" aria-labelledby="tab-music" data-provider-panel="music" hidden>
    {library.music.map((item) => (
      <article class="music-product" data-product-id={item.productId} data-audio-src={item.audioSrc} data-video-src={item.videoSrc ?? ''} data-title={item.title} data-specs={item.specs} data-store-href={item.storeHref}>
        <div><strong>{item.title}</strong><span>{item.specs}</span></div>
        <button data-music-mode="audio" data-product-id={item.productId}>AUDIO</button>
        {item.videoSrc && <button data-music-mode="video" data-product-id={item.productId}>VIDEO</button>}
      </article>
    ))}
    <button id="buy-license" type="button" data-product-id={firstMusic?.productId ?? ''} data-store-href={firstMusic?.storeHref ?? ''} disabled aria-disabled="true">BUY / LICENSE · STORE PENDING</button>
  </div>
  <div id="panel-media" role="tabpanel" aria-labelledby="tab-media" data-provider-panel="media" hidden>
    {library.media.length === 0
      ? <p>No owned Media published</p>
      : library.media.map((item) => <button class="media-cue" data-media-id={item.id} data-media-src={item.src} data-media-title={item.title}>{item.title}</button>)}
  </div>
  <div id="panel-youtube" role="tabpanel" aria-labelledby="tab-youtube" data-provider-panel="youtube" hidden>
    {library.youtube.length === 0
      ? <p>No YouTube selections published</p>
      : library.youtube.map((item) => <button class="youtube-cue" data-youtube-id={item.id} data-youtube-video-id={item.videoId}>{item.title}</button>)}
    <div id="youtube-source-card" hidden><span>YouTube Presentation</span><button id="present-youtube" disabled>PRESENT SELECTED VIDEO</button></div>
    <div id="youtube-player-host" hidden></div>
    <span>External Source · Metering Unavailable</span>
  </div>
</section>
```

Move the unchanged Enterprise AV card below the Media Library as remaining portfolio content. Remove the duplicate Visual Systems and Spatial DSP cards because their functions now live in Cinema and Music tabs.

- [ ] **Step 4: Add browser tab semantics and explicit activation bindings**

In the component script, import:

```js
import { advanceMusicQueue, createMusicQueue, selectMusicMode, setRepeatMode, toggleShuffle } from '../lib/music-queue.mjs';
import { activateSource, createPlaybackSession, releaseStageLease, selectBrowseTab } from '../lib/playback-session.mjs';
import { captureCinemaSnapshot, restoreCinemaSnapshot } from '../lib/media-presentation.mjs';
```

Bind tabs with a roving tabindex. A click or ArrowLeft/ArrowRight updates `session = selectBrowseTab(session, provider)`, `aria-selected`, `tabindex`, and matching `hidden` panel state only. It must not call `.play()`, `.pause()`, change `src`, toggle `muted`, or call an activation function.

Bind Cinema item activation to release any lease, restore when required, then call the existing `switchVideo()` path. Bind Music Audio to `selectMusicMode(..., 'audio')`, release any lease, restore Cinema, load `#music-audio`, force Cinema muted while preserving its pre-Music mute state, and play the audio. Bind Music Video and Media activation to capture Cinema once, keep the existing snapshot for direct leased-source switches, load the native source into `#master-video`, and expose `Return to Cinema`. Bind `Return to Cinema` and leased native `ended` to one restoration function.

Use this controller state and binding structure inside the existing component script; retain the current mirror-wing helper functions and call `applyMediaAspect()` from the existing `loadedmetadata` listener:

```js
const tabs = [...root.querySelectorAll('[role="tab"]')];
const panels = [...root.querySelectorAll('[role="tabpanel"]')];
const cinemaButtons = [...root.querySelectorAll('.cinema-cue')];
const videoPlaylist = cinemaButtons.map((button) => ({
  id: button.dataset.cinemaId,
  src: button.dataset.cinemaSrc,
  title: button.dataset.cinemaTitle,
  specs: button.dataset.cinemaSpecs,
}));
const musicProducts = [...root.querySelectorAll('.music-product')].map((row) => ({
  productId: row.dataset.productId,
  title: row.dataset.title,
  specs: row.dataset.specs,
  audioSrc: row.dataset.audioSrc,
  videoSrc: row.dataset.videoSrc || null,
  storeHref: row.dataset.storeHref,
}));
const productById = new Map(musicProducts.map((item) => [item.productId, item]));
const musicAudio = root.querySelector('#music-audio');
const nowPlayingTitle = root.querySelector('#now-playing-title');
const nowPlayingStatus = root.querySelector('#now-playing-status');
const activeSourceKind = root.querySelector('#active-source-kind');
const activePlay = root.querySelector('#active-play');
const activePrev = root.querySelector('#active-prev');
const activeNext = root.querySelector('#active-next');
const shuffleButton = root.querySelector('#music-shuffle');
const repeatButton = root.querySelector('#music-repeat');
const returnButton = root.querySelector('#return-to-cinema');
let session = createPlaybackSession({ cinemaId: videoPlaylist[0]?.id, cinemaMuted: mv.muted });
let musicQueue = createMusicQueue(musicProducts);
let savedCinemaMute = null;

function renderTab(activeTab, moveFocus = false) {
  session = selectBrowseTab(session, activeTab);
  tabs.forEach((tab) => {
    const selected = tab.dataset.mediaTab === activeTab;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
    if (selected && moveFocus) tab.focus();
  });
  panels.forEach((panel) => { panel.hidden = panel.dataset.providerPanel !== activeTab; });
}

tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => renderTab(tab.dataset.mediaTab));
  tab.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const delta = event.key === 'ArrowRight' ? 1 : -1;
    const target = tabs[(index + delta + tabs.length) % tabs.length];
    renderTab(target.dataset.mediaTab, true);
  });
});

async function restoreLeasedCinema() {
  const released = releaseStageLease(session);
  session = released.session;
  if (released.snapshot) await restoreCinemaSnapshot(mv, stage, released.snapshot);
  returnButton.hidden = true;
  activeSourceKind.textContent = 'CINEMA';
  nowPlayingStatus.textContent = 'CINEMA RESTORED';
}

async function activateMusicAudio(productId) {
  if (session.lease) await restoreLeasedCinema();
  const product = productById.get(productId);
  musicQueue = selectMusicMode(musicQueue, productId, 'audio');
  if (savedCinemaMute === null) savedCinemaMute = mv.muted;
  mv.muted = true;
  musicAudio.src = product.audioSrc;
  session = activateSource(session, { provider: 'music', id: productId, mode: 'audio' });
  await musicAudio.play();
  activeSourceKind.textContent = 'MUSIC · AUDIO';
  nowPlayingTitle.textContent = product.title;
  nowPlayingStatus.textContent = 'MUSIC AUDIO LIVE · CINEMA AUDIO MUTED';
  activePlay.textContent = 'PAUSE';
}

async function activateNativeLease(provider, id, src, title) {
  const snapshot = session.lease?.snapshot ?? captureCinemaSnapshot(mv, stage, videoPlaylist[currentVidIdx]?.id ?? null);
  musicAudio.pause();
  session = activateSource(session, { provider, id, mode: 'video', snapshot });
  mv.src = src;
  await playVideoStack();
  returnButton.hidden = false;
  activeSourceKind.textContent = provider === 'music' ? 'MUSIC · VIDEO' : 'MEDIA';
  nowPlayingTitle.textContent = title;
  nowPlayingStatus.textContent = `${activeSourceKind.textContent} LIVE`;
  activePlay.textContent = 'PAUSE';
}

async function activateCinema(index) {
  musicAudio.pause();
  if (session.lease) await restoreLeasedCinema();
  switchVideo(index, true);
  session = activateSource(session, { provider: 'cinema', id: videoPlaylist[index].id, mode: 'video', muted: mv.muted });
  savedCinemaMute = null;
  activeSourceKind.textContent = 'CINEMA';
  nowPlayingTitle.textContent = videoPlaylist[index].title;
  nowPlayingStatus.textContent = 'CINEMA LIVE';
}

async function advanceMusic(direction) {
  const next = advanceMusicQueue(musicQueue, direction);
  if (!next) {
    musicAudio.pause();
    if (savedCinemaMute !== null) mv.muted = savedCinemaMute;
    savedCinemaMute = null;
    session = activateSource(session, { provider: 'cinema', id: videoPlaylist[currentVidIdx]?.id ?? null, mode: 'video', muted: mv.muted });
    activeSourceKind.textContent = 'CINEMA';
    nowPlayingStatus.textContent = 'MUSIC QUEUE COMPLETE · CINEMA AUDIO STATE RESTORED';
    return;
  }
  musicQueue = next;
  await activateMusicAudio(next.currentProductId);
}

cinemaButtons.forEach((button) => button.addEventListener('click', () => void activateCinema(Number(button.dataset.cinemaIndex))));
root.querySelectorAll('[data-music-mode="audio"]').forEach((button) => button.addEventListener('click', () => void activateMusicAudio(button.dataset.productId)));
root.querySelectorAll('[data-music-mode="video"]').forEach((button) => button.addEventListener('click', () => {
  const product = productById.get(button.dataset.productId);
  musicQueue = selectMusicMode(musicQueue, product.productId, 'video');
  void activateNativeLease('music', product.productId, product.videoSrc, product.title);
}));
root.querySelectorAll('.media-cue').forEach((button) => button.addEventListener('click', () => void activateNativeLease('media', button.dataset.mediaId, button.dataset.mediaSrc, button.dataset.mediaTitle)));
returnButton.addEventListener('click', () => void restoreLeasedCinema());
musicAudio.addEventListener('ended', () => void advanceMusic(1));
mv.addEventListener('ended', () => { if (session.lease) void restoreLeasedCinema(); else switchVideo(currentVidIdx + 1, true); });
activePlay.addEventListener('click', () => {
  const media = session.playback.provider === 'music' && session.playback.mode === 'audio' ? musicAudio : mv;
  if (media.paused) void media.play(); else media.pause();
});
activePrev.addEventListener('click', () => { if (session.playback.provider === 'music') void advanceMusic(-1); else void activateCinema(currentVidIdx - 1); });
activeNext.addEventListener('click', () => { if (session.playback.provider === 'music') void advanceMusic(1); else void activateCinema(currentVidIdx + 1); });
shuffleButton.addEventListener('click', () => { musicQueue = toggleShuffle(musicQueue); shuffleButton.setAttribute('aria-pressed', String(musicQueue.shuffle)); });
repeatButton.addEventListener('click', () => {
  const next = musicQueue.repeat === 'off' ? 'all' : musicQueue.repeat === 'all' ? 'one' : 'off';
  musicQueue = setRepeatMode(musicQueue, next);
  repeatButton.dataset.repeat = next;
  repeatButton.textContent = `REPEAT ${next.toUpperCase()}`;
});
```

Replace the current unconditional `mv.addEventListener('ended', () => switchVideo(...))` listener with the lease-aware listener above; do not leave both registered. Replace the existing mute-button reference to `dspAudio` with `musicAudio`: deliberately unmuting Cinema pauses Music audio, clears `savedCinemaMute`, updates the active header to Cinema, and leaves Cinema motion running. Remove the rejected `dsp-*` DOM queries and audio handlers after the equivalent Stage Command Header bindings are in place.

Do not bind YouTube playback in this foundation. Its catalog, source-card-ready DOM, external-metering label, and disabled Present action establish the approved boundary without loading the IFrame API.

- [ ] **Step 5: Replace rejected console CSS with the approved responsive hierarchy**

Delete `.mastering-console*` rules. Add:

```css
.stage-command-header { display:grid; grid-template-columns:minmax(0,1.25fr) auto minmax(15rem,1fr) auto; gap:1rem; align-items:center; padding:1rem; border:1px solid rgb(82 71 47); background:linear-gradient(90deg,rgb(181 155 102 / .12),rgb(9 9 11 / .97)); }
.stage-command-header__identity { display:grid; min-width:0; gap:.2rem; font: .6875rem ui-monospace,SFMono-Regular,Menlo,monospace; }
.stage-command-header__identity strong { overflow:hidden; color:white; font-size:.875rem; text-overflow:ellipsis; white-space:nowrap; }
.stage-command-header__transport { display:flex; gap:.4rem; align-items:center; }
.stage-command-header button,.media-library button,.media-library a { min-height:2.25rem; border:1px solid rgb(63 63 70); background:rgb(24 24 27); color:rgb(212 212 216); font:.6875rem ui-monospace,SFMono-Regular,Menlo,monospace; }
.engineering-meters { display:grid; gap:.35rem; font:.625rem ui-monospace,SFMono-Regular,Menlo,monospace; }
.engineering-meters [data-meter-channel] { display:grid; grid-template-columns:1rem 1fr 3rem 2rem; gap:.35rem; align-items:center; }
.engineering-meters [id^="clip-"] { color:rgb(113 113 122); }
.engineering-meters [data-clipped="true"] [id^="clip-"] { color:rgb(248 113 113); }
.media-library { border:1px solid rgb(39 39 42); background:rgb(9 9 11 / .82); }
.media-library__tabs { display:flex; overflow-x:auto; border-bottom:1px solid rgb(39 39 42); }
.media-library__tabs [role="tab"] { flex:1 0 7rem; border-width:0 0 2px; }
.media-library__tabs [aria-selected="true"] { border-color:rgb(181 155 102); background:rgb(181 155 102 / .1); color:white; }
[role="tabpanel"] { padding:1rem; }

@media (max-width:767px) {
  .stage-command-header { grid-template-columns:1fr auto; }
  .stage-command-header__transport,.engineering-meters { grid-column:1 / -1; }
  .stage-command-header__transport { justify-content:center; flex-wrap:wrap; }
  .media-library__tabs { scroll-snap-type:x proximity; }
  .media-library__tabs [role="tab"] { scroll-snap-align:start; }
}
```

- [ ] **Step 6: Run focused tests and iterate to GREEN**

Run: `node --test tests/hybrid-media-engine.test.mjs tests/playback-session.test.mjs tests/music-queue.test.mjs`

Expected: focused tests pass with 0 failures.

- [ ] **Step 7: Run complete verification before the visual gate**

Run: `npm test`

Expected: complete suite passes with 0 failures.

Run: `npm run build`

Expected: Astro production build exits 0.

Run: `git diff --check`

Expected: exits 0 with no output.

- [ ] **Step 8: Perform the required visual review gate and stop**

Start the shadow-worktree dev server and review Safari and Chromium at 1440, 1024, 768, 430, and 390 CSS pixels. Verify portrait and landscape Cinema, tab keyboard/touch navigation, browse-without-interruption, Music Audio playback, empty Media/YouTube states, no overflow, and unchanged Publications & Credits. Provide a temporary remote phone URL only when Justin requests it.

Stop and request Justin's explicit approval of the implemented Stage Command Header and tabbed library. Do not begin any follow-up implementation plan while approval is absent or rejected.

- [ ] **Step 9: Commit Task 3 only after approval**

```bash
git add src/components/HybridMediaEngine.astro src/styles/hybrid-media-engine.css tests/hybrid-media-engine.test.mjs
git commit -m "feat: add tabbed adaptive media library"
```

---

## Foundation verification and delivery gate

- [ ] Run `npm test` and record the fresh passing count.
- [ ] Run `npm run build` and record the successful Astro output.
- [ ] Run `git diff --check` and confirm no output.
- [ ] Run `git status --short --branch` and confirm only intended state.
- [ ] Review Safari and Chromium on macOS at 1440, 1024, 768, 430, and 390 CSS pixels.
- [ ] Verify portrait/square/landscape Cinema, browse-without-interruption, native Music Audio, reversible fixture-backed music-video and owned-Media leases, accessible tabs, truthful empty provider states, and the non-animated `METERS PENDING` label.
- [ ] Provide a temporary remote phone preview only when requested; do not deploy.
- [ ] Stop for Justin's explicit foundation approval. Only after approval, write separate plans for engineering meters and portable commerce/YouTube integration.
- [ ] Do not push, merge, deploy, modify production, change DNS, alter hosting, or ingest media without separate explicit approval.
