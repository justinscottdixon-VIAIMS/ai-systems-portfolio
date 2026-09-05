# Vercel Blob Folder Catalogue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make eligible files placed in the approved Vercel Blob folders appear in the existing player without Supabase, a custom upload page, or a website rebuild.

**Architecture:** A pure server module turns complete paginated Blob listings and optional order sidecars into one allowlisted catalogue envelope. A small Vercel Function exposes that envelope. The browser validates media through native metadata probes, accepts complete fingerprinted snapshots, rebuilds the three player lists, and preserves valid active playback.

**Tech Stack:** Node >=22.12, native ESM, Astro 7 static output, Vercel Functions, `@vercel/blob` 2.8.0, browser `HTMLMediaElement`, `node:test`, and `node:assert/strict`; no new dependencies.

## Global Constraints

- Authoritative specification: `docs/superpowers/specs/2026-09-04-vercel-blob-folder-catalog-design.md`.
- Work only in `site/.worktrees/adaptive-media-shadow`; preserve `.DS_Store` and all unrelated player changes.
- Use the existing public Blob store and Vercel project. Do not create or connect Supabase, a database, private intake storage, custom authentication, a worker, or an owner administration page.
- Discover only direct child objects under `Cinema/`, `Music/`, `Media/`, and `Music-Visuals/`. Ignore nested objects and dot-prefixed files.
- `Cinema/` and `Media/` accept `.mp4`, `.mov`, `.webm`. `Music/` accepts `.wav`, `.mp3`, `.m4a`, `.flac`, `.aac`, `.mov`, `.mp4`. `Music-Visuals/` accepts `.mp4`, `.mov`, `.webm` using the existing `VIZ-<NAME>` filename rule.
- Every Music audio or video file is an independent row. Do not pair matching stems. Preserve one combined sidecar/display/navigation order across both kinds.
- The Blob list API is authoritative for pathname, URL, byte size, uploaded time, and ETag. Infer kind from the allowlisted extension; native browser metadata proves playback support.
- Unknown video dimensions fail closed. Mobile Cinema and Music video eligibility remains portrait-only. Do not re-encode media.
- A malformed sidecar or incomplete listing rejects the whole endpoint response. The browser retains its last accepted catalogue.
- Refresh on first visible load, focus regain, and at least every 15 seconds while visible. Permit one request at a time and never resurrect bootstrap data after accepting a server catalogue.
- Do not mutate Blob storage, credentials, hosting, deployment, or production. Stop if the provider asks for a new paid resource or plan change.
- Use `apply_patch` for edits. Do not commit until the owner separately authorizes a commit.

---

### Task 1: Close the two open playback findings

**Files:**
- Modify: `src/components/HybridMediaEngine.astro:615-664`
- Modify: `src/components/HybridMediaEngine.astro:965-972`
- Modify: `tests/mobile-queue-runtime.test.mjs`
- Create: `tests/lease-failure-status-runtime.test.mjs`

**Interfaces:**
- Consumes: existing `audible`, `restoreLeasedCinema()`, `rebuildEligibleVideoQueues()` and presentation helpers.
- Produces: queue rebuilds that preserve one audible authority and failure labels that report the actual restore result.

- [ ] **Step 1: Add a failing queue-authority regression**

Extend the runtime fixture so `mv.muted`, `audible.current`, and Music playback are observable. Add this assertion:

```js
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
```

- [ ] **Step 2: Add failing failure-status regressions**

Extract `recoverMasterVideoFailure()` with the existing VM-test pattern and cover a restore returning `snapshot: null`:

```js
test('failed Music video does not claim an unavailable Cinema visual was restored', async () => {
  const status = { textContent: '' };
  await runRecovery({
    failedPlayback: { provider: 'music', id: 'mv', mode: 'video' },
    restored: { snapshot: null },
    audibleProvider: 'music',
    status,
  });
  assert.match(status.textContent, /MUSIC VIDEO UNAVAILABLE/);
  assert.match(status.textContent, /CINEMA UNAVAILABLE/);
  assert.doesNotMatch(status.textContent, /CINEMA VISUAL RESTORED/);
});
```

- [ ] **Step 3: Verify both reproductions fail**

Run:

```bash
node --test tests/mobile-queue-runtime.test.mjs tests/lease-failure-status-runtime.test.mjs
```

Expected: the new mute assertion fails because `mv.muted` remains false, and the status assertion fails because the code says `CINEMA VISUAL RESTORED`.

- [ ] **Step 4: Make the minimal controller corrections**

Before assigning and loading a replacement Cinema source in `rebuildEligibleVideoQueues()`, enforce the current audible owner:

```js
if (audible.current?.provider !== 'cinema') mv.muted = true;
if (selected) mv.src = selected.src;
else mv.removeAttribute('src');
mv.load();
```

Use the restore result rather than overwriting its truth:

```js
const restored = await restoreLeasedCinema();
const failedLabel = failedPlayback.provider === 'music'
  ? 'MUSIC VIDEO UNAVAILABLE'
  : 'MEDIA UNAVAILABLE';
const cinemaLabel = restored.snapshot ? 'CINEMA VISUAL RESTORED' : 'CINEMA UNAVAILABLE';
if (audible.current?.provider === 'music') {
  renderMusicAudioIdentity(audible.current.id, `${failedLabel} · MUSIC AUDIO RESTORED · ${cinemaLabel}`);
} else {
  renderCinemaIdentity(`${failedLabel} · ${restored.snapshot ? 'CINEMA RESTORED' : 'CINEMA UNAVAILABLE'}`);
}
```

- [ ] **Step 5: Verify the focused corrections**

Run the focused command from Step 3. Expected: all focused tests pass.

- [ ] **Step 6: Record a local checkpoint**

Run `git diff --check`. Do not stage or commit.

---

### Task 2: Build the complete Blob folder catalogue

**Files:**
- Create: `src/lib/blob-folder-catalogue.mjs`
- Create: `tests/blob-folder-catalogue.test.mjs`
- Reuse: `src/lib/playlist-order.mjs`
- Reuse: `src/lib/music-title.mjs`

**Interfaces:**
- Consumes: injected `listPage({ prefix, cursor, limit })` and `readText(url)` functions.
- Produces: `listCompletePrefix({ prefix, listPage })` and `buildBlobFolderCatalogue({ listPage, readText })`.
- Envelope: `{ authoritative: true, fingerprint: string, items: BlobCatalogueItem[] }`.
- Item: `{ id, versionId, pathname, folder, kind, title, src, size, uploadedAt, playlistOrder, visualTag? }`.

- [ ] **Step 1: Write failing pagination and isolation tests**

Create fixture pages and assert every cursor is consumed exactly once:

```js
test('lists every page and keeps only direct children of the requested prefix', async () => {
  const calls = [];
  const listPage = async ({ prefix, cursor }) => {
    calls.push([prefix, cursor ?? null]);
    return cursor
      ? { blobs: [blob(`${prefix}Two.mp4`, 'e2')], hasMore: false }
      : { blobs: [blob(`${prefix}One.mp4`, 'e1'), blob(`${prefix}nested/skip.mp4`, 'e3')], hasMore: true, cursor: 'next' };
  };
  const result = await listCompletePrefix({ prefix: 'Cinema/', listPage });
  assert.deepEqual(result.map(({ pathname }) => pathname), ['Cinema/One.mp4', 'Cinema/Two.mp4']);
  assert.deepEqual(calls, [['Cinema/', null], ['Cinema/', 'next']]);
});
```

Add cases for `hasMore` without a cursor, repeated cursors, malformed `blobs`, duplicate pathname/ETag entries, wrong-prefix entries, zero bytes, unsafe URLs, dotfiles, and unsupported extensions. Every malformed complete listing must reject.

- [ ] **Step 2: Write failing provider, format, sidecar, and fingerprint tests**

Use one fixture containing all accepted extensions, including `Music/Film.mov` and `Music/Film.mp4`. Assert:

```js
assert.deepEqual(
  envelope.items.filter((item) => item.folder === 'music').map((item) => [item.pathname, item.kind]),
  [
    ['Music/Song.wav', 'audio'],
    ['Music/Film.mov', 'video'],
    ['Music/Film.mp4', 'video'],
  ],
);
assert.equal(envelope.authoritative, true);
assert.match(envelope.fingerprint, /^[a-f0-9]{64}$/);
```

Add exact tests for listed-first order, natural unlisted order, invalid JSON, duplicate/missing/traversal sidecar entries, independent provider order, canonical `VIZ-` tags, missing ETag, and identical normalized inputs producing the same fingerprint regardless of page boundaries.

- [ ] **Step 3: Verify the catalogue tests fail because the module is absent**

Run:

```bash
node --test tests/blob-folder-catalogue.test.mjs
```

Expected: fail with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 4: Implement strict listing pagination**

Create `listCompletePrefix` with this control flow:

```js
export async function listCompletePrefix({ prefix, listPage }) {
  const blobs = [];
  const cursors = new Set();
  let cursor;
  do {
    const page = await listPage({ prefix, cursor, limit: 1000 });
    if (!page || !Array.isArray(page.blobs) || typeof page.hasMore !== 'boolean') {
      throw new TypeError(`${prefix} returned a malformed Blob page`);
    }
    blobs.push(...page.blobs);
    if (!page.hasMore) break;
    if (typeof page.cursor !== 'string' || page.cursor.length === 0 || cursors.has(page.cursor)) {
      throw new TypeError(`${prefix} returned an invalid pagination cursor`);
    }
    cursors.add(page.cursor);
    cursor = page.cursor;
  } while (true);
  return normalizeDirectChildren(prefix, blobs);
}
```

`normalizeDirectChildren()` must ignore direct dotfiles and nested paths, reject any returned object outside the prefix, and reject duplicate pathnames before extension filtering.

- [ ] **Step 5: Implement provider projection and ordering**

Define the exact configuration in the module:

```js
export const BLOB_FOLDERS = Object.freeze([
  { prefix: 'Cinema/', folder: 'cinema', extensions: new Map([['.mp4', 'video'], ['.mov', 'video'], ['.webm', 'video']]) },
  { prefix: 'Music/', folder: 'music', extensions: new Map([['.wav', 'audio'], ['.mp3', 'audio'], ['.m4a', 'audio'], ['.flac', 'audio'], ['.aac', 'audio'], ['.mov', 'video'], ['.mp4', 'video']]) },
  { prefix: 'Media/', folder: 'media', extensions: new Map([['.mp4', 'video'], ['.mov', 'video'], ['.webm', 'video']]) },
  { prefix: 'Music-Visuals/', folder: 'music-visuals', extensions: new Map([['.mp4', 'video'], ['.mov', 'video'], ['.webm', 'video']]) },
]);
```

For Cinema, Music, and Media, read the optional direct-child `playlist-order.json`, parse its UTF-8 JSON array, and pass it with the eligible filenames to `resolvePlaylistOrder`. Assign the resulting zero-based `playlistOrder`. Music Visuals use natural filename order and the existing visual-tag parser.

Create item identity directly from Blob metadata:

```js
const item = Object.freeze({
  id: blob.pathname,
  versionId: blob.etag,
  pathname: blob.pathname,
  folder: config.folder,
  kind,
  title: config.folder === 'music'
    ? parseMusicIdentity(filename).title
    : path.posix.basename(filename, extension).replaceAll('_', ' ').trim(),
  src: url.href,
  size: blob.size,
  uploadedAt: new Date(blob.uploadedAt).toISOString(),
  playlistOrder,
  ...(visualTag ? { visualTag } : {}),
});
```

- [ ] **Step 6: Implement deterministic envelope hashing**

Sort items by folder configuration order and `playlistOrder`, serialize only the public normalized items, and compute:

```js
const fingerprint = createHash('sha256')
  .update(JSON.stringify(items))
  .digest('hex');
return Object.freeze({ authoritative: true, fingerprint, items: Object.freeze(items) });
```

- [ ] **Step 7: Verify the pure server catalogue**

Run `node --test tests/blob-folder-catalogue.test.mjs`. Expected: all tests pass.

- [ ] **Step 8: Record a local checkpoint**

Run `git diff --check`. Do not stage or commit.

---

### Task 3: Expose the read-only Vercel Function

**Files:**
- Create: `api/media-catalog.mjs`
- Create: `tests/media-catalog-endpoint.test.mjs`

**Interfaces:**
- Consumes: `buildBlobFolderCatalogue()` and `@vercel/blob` `list()`.
- Produces: `createMediaCatalogueHandler({ listPage, readText })` and the default Vercel handler.
- HTTP contract: GET returns status 200 plus the complete envelope; all other methods return 405; listing/sidecar failures return a generic 503 without internal details.

- [ ] **Step 1: Write failing handler tests**

Use lightweight request/response fakes. Assert GET success, `Allow: GET`, generic failure output, JSON content type, and shared 15-second cache headers:

```js
assert.equal(response.statusCode, 200);
assert.equal(response.headers['cache-control'], 'public, s-maxage=15, must-revalidate');
assert.deepEqual(response.body, envelope);
```

Assert the injected `listPage` receives no client-supplied prefix, token, or cursor.

- [ ] **Step 2: Verify the endpoint test fails because the module is absent**

Run `node --test tests/media-catalog-endpoint.test.mjs`. Expected: `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement the injectable handler**

Use the existing environment token only inside the default dependency:

```js
import { list } from '@vercel/blob';
import { buildBlobFolderCatalogue } from '../src/lib/blob-folder-catalogue.mjs';

export function createMediaCatalogueHandler({ listPage, readText }) {
  return async function mediaCatalogue(request, response) {
    if (request.method !== 'GET') {
      response.setHeader('Allow', 'GET');
      return response.status(405).json({ error: 'Method not allowed' });
    }
    try {
      const catalogue = await buildBlobFolderCatalogue({ listPage, readText });
      response.setHeader('Cache-Control', 'public, s-maxage=15, must-revalidate');
      return response.status(200).json(catalogue);
    } catch (error) {
      console.error('media catalogue unavailable', error);
      response.setHeader('Cache-Control', 'no-store');
      return response.status(503).json({ error: 'Media catalogue unavailable' });
    }
  };
}

const listPage = (options) => list({ ...options, token: process.env.BLOB_READ_WRITE_TOKEN });
const readText = async (url) => {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`sidecar fetch failed: ${response.status}`);
  const text = await response.text();
  if (text.length > 65_536) throw new Error('sidecar exceeds 64 KiB');
  return text;
};

export default createMediaCatalogueHandler({ listPage, readText });
```

Do not serialize `error.message`, Blob credentials, or request headers to the client.

- [ ] **Step 4: Verify endpoint behavior**

Run:

```bash
node --test tests/blob-folder-catalogue.test.mjs tests/media-catalog-endpoint.test.mjs
```

Expected: all tests pass with injected fakes and no network requests.

- [ ] **Step 5: Build the static site with the Function directory present**

Run `npm run build`. Expected: Astro static build passes; `api/media-catalog.mjs` remains available to Vercel as a Function source.

- [ ] **Step 6: Record a local checkpoint**

Run `git diff --check`. Do not stage or commit.

---

### Task 4: Replace database revisions with Blob fingerprints and native probes

**Files:**
- Modify: `src/lib/catalogue-refresh.mjs`
- Modify: `tests/catalogue-refresh.test.mjs`
- Create: `src/lib/media-metadata-probe.mjs`
- Create: `tests/media-metadata-probe.test.mjs`

**Interfaces:**
- Consumes: endpoint envelopes and injected `createMediaElement(kind)`.
- Produces: fingerprint-based refresh state and `probeCatalogueItems(items, { createMediaElement, cache, timeoutMs })`.
- Probe result: `{ accepted: ProbedItem[], rejected: { id, reason }[] }` where videos gain `width`, `height`, and `aspect`; audio retains its catalogue fields.

- [ ] **Step 1: Rewrite refresh tests around fingerprints**

Replace numeric revision fixtures with 64-character fingerprints:

```js
const fp = (character) => character.repeat(64);
const live = (fingerprint, items) => ({ authoritative: true, fingerprint, items });
```

Assert malformed fingerprints reject, identical fingerprint plus identical data is unchanged, identical fingerprint plus different data is a conflict, a new fingerprint is accepted, failures retain last accepted state, and bootstrap never becomes authoritative again.

- [ ] **Step 2: Write failing metadata-probe tests**

Create fake audio/video elements that fire `loadedmetadata`, `error`, or never settle. Cover positive duration, zero/nonfinite duration, positive video dimensions, unknown dimensions, error, timeout, and cache reuse by `{ id, versionId }`.

```js
assert.deepEqual(result.accepted[0], {
  ...video,
  width: 720,
  height: 1280,
  aspect: 'portrait',
});
assert.deepEqual(result.rejected, [{ id: 'broken', reason: 'metadata-error' }]);
```

- [ ] **Step 3: Verify focused tests fail**

Run:

```bash
node --test tests/catalogue-refresh.test.mjs tests/media-metadata-probe.test.mjs
```

Expected: refresh assertions fail against numeric revisions and the probe module is missing.

- [ ] **Step 4: Implement fingerprint refresh validation**

The state shape becomes:

```js
Object.freeze({ authoritative: false, fingerprint: null, items })
```

Accept only `/^[a-f0-9]{64}$/`. Remove numeric stale ordering. Because requests are single-flight, a different valid fingerprint replaces the accepted state; the same fingerprint must describe byte-for-byte identical projected items or return `fingerprint-conflict`.

- [ ] **Step 5: Implement native metadata probing with cleanup**

For each uncached item, create `audio` or `video`, set `preload = 'metadata'`, register one-shot `loadedmetadata` and `error` listeners, assign `src`, and call `load()`. On every settlement, clear the timer, remove listeners, remove `src`, and call `load()` again. Reject video unless both dimensions are positive integers; reject audio unless duration is finite and greater than zero.

Cache settled accepted/rejected results under:

```js
const cacheKey = `${item.id}\u0000${item.versionId}`;
```

Return accepted items in the endpoint order so sidecar display and navigation order stay aligned.

- [ ] **Step 6: Verify refresh and probe contracts**

Run the focused command from Step 3. Expected: all tests pass.

- [ ] **Step 7: Record a local checkpoint**

Run `git diff --check`. Do not stage or commit.

---

### Task 5: Support independent audio and video items in Music

**Files:**
- Modify: `src/lib/music-queue.mjs`
- Modify: `tests/music-queue.test.mjs`
- Create: `src/lib/runtime-media-library.mjs`
- Create: `tests/runtime-media-library.test.mjs`

**Interfaces:**
- Consumes: probed Blob catalogue items plus bootstrap library records.
- Produces: `toRuntimeMediaLibrary(items)` returning `{ cinema, music, media, musicVisuals }` and a mixed-kind Music queue.
- Music item: `{ productId, kind, title, src, specs, aspect?, visual? }`.

- [ ] **Step 1: Add failing mixed-kind Music queue tests**

Use this order:

```js
const mixed = [
  { productId: 'song.wav', kind: 'audio', src: 'song.wav' },
  { productId: 'film.mov', kind: 'video', src: 'film.mov' },
  { productId: 'clip.mp4', kind: 'video', src: 'clip.mp4' },
];
```

Assert the initial mode matches the first item kind, `advanceMusicQueue()` selects video for the second and third items, previous/next follow the exact combined order, repeat behavior remains intact, and shuffle does not lose each item's mode.

- [ ] **Step 2: Add failing runtime-library tests**

Assert Cinema and Media contain video items, Music contains independent audio/`.mov`/`.mp4` rows in source order, Music Visuals never become rows, and `VIZ-` audio tags attach only to matching validated Music Visuals. Missing optional visuals must leave the Music row playable without a visual.

- [ ] **Step 3: Verify the focused tests fail**

Run:

```bash
node --test tests/music-queue.test.mjs tests/runtime-media-library.test.mjs
```

Expected: the current queue resets every advance to audio and the runtime library module is absent.

- [ ] **Step 4: Generalize the Music queue without pairing files**

Store each item with its own `kind` and replace mode inference with:

```js
function itemMode(item) {
  if (item.kind === 'audio') return 'audio';
  if (item.kind === 'video') return 'video';
  throw new TypeError(`unsupported Music kind: ${item.kind}`);
}
```

`createMusicQueue()` initializes to `itemMode(items[0])`. `selectMusicItem(queue, productId)` selects the item's required mode. `advanceMusicQueue()` preserves the selected item's required mode instead of forcing `audio`. Keep `selectMusicMode()` temporarily only for bootstrap paired records until Task 6 removes that caller.

- [ ] **Step 5: Implement the runtime library projection**

Sort on `playlistOrder` and return detached frozen provider arrays. For Music, use `src` directly for both kinds and attach a matching visual only when `item.visualTag` resolves in `musicVisuals`. Generate factual specs from the extension and dimensions, without claiming mastering or engine details absent from Blob metadata.

- [ ] **Step 6: Verify the mixed Music model**

Run the focused command from Step 3. Expected: all tests pass.

- [ ] **Step 7: Record a local checkpoint**

Run `git diff --check`. Do not stage or commit.

---

### Task 6: Integrate refresh and dynamic rows into the player

**Files:**
- Create: `src/lib/runtime-catalogue-controller.mjs`
- Create: `tests/runtime-catalogue-controller.test.mjs`
- Modify: `src/components/HybridMediaEngine.astro`
- Modify: `tests/hybrid-media-engine.test.mjs`
- Modify: `tests/transport-navigation-runtime.test.mjs`
- Modify: `tests/mobile-queue-runtime.test.mjs`

**Interfaces:**
- Consumes: `/api/media-catalog`, `refreshCatalogue()`, `probeCatalogueItems()`, `toRuntimeMediaLibrary()` and the existing playback controllers.
- Produces: `createRuntimeCatalogueController({ fetchCatalogue, probeItems, now, visible })` with `start()`, `focus()`, `visibilityChanged()`, `refresh()`, and `stop()`.
- Player hook: `applyRuntimeLibrary(nextLibrary)` replaces rows and reconciles active playback once per accepted fingerprint.

- [ ] **Step 1: Write failing scheduler/controller tests**

Use fake time, fetch, and probes. Assert immediate visible fetch, no hidden fetch, 15-second refresh, focus refresh, one in-flight request, generic fetch/JSON/probe failure retention, no bootstrap resurrection, timer cleanup, and no apply callback for an unchanged fingerprint.

```js
const controller = createRuntimeCatalogueController({
  fetchCatalogue,
  probeItems,
  applyCatalogue: (items) => applied.push(items),
  now: () => clock,
  visible: () => visible,
  setTimer: fakeTimers.set,
  clearTimer: fakeTimers.clear,
});
controller.start();
assert.equal(fetchCalls, 1);
```

- [ ] **Step 2: Add failing component contract tests**

Assert the component imports the controller and runtime library, uses event delegation on the three playlist containers, changes catalogue arrays/maps from `const` to `let`, and binds `focus`, `visibilitychange`, and teardown exactly once. Assert dynamic text is assigned through `textContent`, never `innerHTML`.

- [ ] **Step 3: Verify focused tests fail**

Run:

```bash
node --test tests/runtime-catalogue-controller.test.mjs tests/hybrid-media-engine.test.mjs tests/transport-navigation-runtime.test.mjs tests/mobile-queue-runtime.test.mjs
```

Expected: controller module missing and component integration assertions fail.

- [ ] **Step 4: Implement the small refresh controller**

`refresh()` must call `fetch('/api/media-catalog', { headers: { accept: 'application/json' }, cache: 'no-cache' })`, require `response.ok`, decode JSON, validate the envelope, probe all candidates with cache reuse, and call `applyCatalogue()` only after the complete probe settles. Always clear `inFlight` in `finally` and schedule the next visible check from the request start time.

- [ ] **Step 5: Make playlist collections replaceable**

Change `cinemaButtons`, `allCinemaItems`, `allMediaItems`, `musicProducts`, and `productById` to `let`. Keep `tabs`, player controls, YouTube data, experience media, and curated welcome/ambient sources unchanged.

Add `renderCinemaRows()`, `renderMusicRows()`, and `renderMediaRows()` using `document.createElement`, `textContent`, and explicit `dataset` assignments. A Music audio row gets one `PLAY` button; a Music video row gets one `VIDEO` button. Do not create a URL, element name, attribute name, or HTML fragment from unchecked remote text.

- [ ] **Step 6: Replace per-row listeners with delegated handlers**

Bind one click listener to each persistent playlist container and resolve the nearest supported button with `event.target.closest(...)`. Route Cinema to `activateCinema`, audio Music to the audio path, video Music to the native Music lease, and Media to the native Media lease. Rebuild `entryCueControls`, the Music queue, lookup maps, and scroll rails after each accepted catalogue.

- [ ] **Step 7: Reconcile accepted changes with active playback**

Before replacing arrays, capture the actual `{ provider, id, src }`. After replacement:

- preserve current time and media element when that exact pathname and ETag remain;
- leave a removed currently loaded resource playing, but remove it from navigation immediately;
- select the current eligible queue on the next navigation or ended event;
- reset an updated same-path item to time zero only when its ETag changed;
- keep unrelated Music audio and Cinema visual authority intact;
- rerun responsive video eligibility after probed dimensions enter the library.

Do not allow the bootstrap DOM/library to repopulate after the controller accepts its first server envelope.

- [ ] **Step 8: Bind lifecycle events**

Create one controller after the existing player initialization:

```js
runtimeCatalogue.start();
window.addEventListener('focus', runtimeCatalogue.focus);
document.addEventListener('visibilitychange', runtimeCatalogue.visibilityChanged);
window.addEventListener('pagehide', runtimeCatalogue.stop, { once: true });
```

The controller must remain quiet in the public UI on endpoint failure; retain the last accepted rows and log one concise diagnostic without secrets.

- [ ] **Step 9: Verify dynamic catalogue integration**

Run the focused command from Step 3. Expected: all focused tests pass.

- [ ] **Step 10: Record a local checkpoint**

Run `git diff --check`. Do not stage or commit.

---

### Task 7: Remove the unused Supabase implementation path

**Files:**
- Delete: `database/drafts/2026-09-04-catalogue.UNAPPLIED.sql`
- Delete: `src/lib/catalogue-repository.mjs`
- Delete: `src/lib/public-catalogue.mjs`
- Delete: `src/lib/publishing-policy.mjs`
- Delete: `src/lib/upload-state.mjs`
- Delete: `tests/catalogue-flow-contract.test.mjs`
- Delete: `tests/catalogue-management.test.mjs`
- Delete: `tests/catalogue-repository.test.mjs`
- Delete: `tests/catalogue-schema-draft.test.mjs`
- Delete: `tests/contracts/catalogue-store-contract.mjs`
- Delete: `tests/contracts/reference-store-harness.mjs`
- Delete: `tests/public-catalogue.test.mjs`
- Delete: `tests/publishing-policy.test.mjs`
- Delete: `tests/upload-state.test.mjs`
- Delete: `scripts/start-grok-foundation.zsh`
- Delete: `.grok/` files created only for the superseded foundation dispatch
- Modify: `docs/product/portfolio-completion-checklist.md`
- Modify: `docs/product/2026-09-04-release-readiness.md`
- Preserve: all superseded documents, with their current historical warning banners.

**Interfaces:**
- Consumes: passing replacement catalogue/refresh tests from Tasks 2-6.
- Produces: no reachable Supabase/database code or unapplied SQL in the working application tree.

- [ ] **Step 1: Prove the removal set has no active consumer**

Run:

```bash
rg -n "catalogue-repository|public-catalogue|publishing-policy|upload-state|catalogue-store-contract|2026-09-04-catalogue\.UNAPPLIED" src api scripts tests package.json astro.config.mjs
```

Expected: matches occur only within the listed superseded files/tests. If another active consumer appears, adapt it to the Blob contracts before deletion.

- [ ] **Step 2: Delete only the enumerated obsolete artifacts**

Use `apply_patch` deletion hunks. Do not delete player runtime tests, the adapted `catalogue-refresh.mjs`, historical documents, `.DS_Store`, or unrelated WIP.

- [ ] **Step 3: Update active project status**

Mark local Blob endpoint/runtime work complete only when focused tests pass. Keep remote Blob mutation, preview deployment, actual-phone review, production deployment, and full website gates unchecked.

- [ ] **Step 4: Verify no active Supabase implementation remains**

Run:

```bash
rg -n "Supabase|catalogue_private|BLOB_READ_WRITE_TOKEN" src api scripts tests package.json astro.config.mjs
```

Expected: no Supabase/database matches. `BLOB_READ_WRITE_TOKEN` appears only in the server endpoint and existing owner-run synchronization scripts, never in browser code.

- [ ] **Step 5: Record a local checkpoint**

Run `git diff --check`. Do not stage or commit.

---

### Task 8: Complete local verification and prepare the remote preview gate

**Files:**
- Modify: `docs/product/portfolio-completion-checklist.md`
- Modify: `docs/product/2026-09-04-release-readiness.md`
- Create: `docs/product/2026-09-04-vercel-blob-folder-catalogue-verification.md`

**Interfaces:**
- Consumes: the completed local endpoint and player integration.
- Produces: auditable local evidence and an exact, still-unexecuted remote verification sequence.

- [ ] **Step 1: Run the complete automated suite**

Run `npm test`. Expected: zero failures or skips. Record the actual count in the verification document.

- [ ] **Step 2: Run both build modes**

Run:

```bash
npm run build
VIAIMS_MEDIA_MANIFEST_PATH=src/data/media.preview.json npm run build
```

Expected: both builds succeed.

- [ ] **Step 3: Check diff hygiene and secrets**

Run:

```bash
git diff --check
rg -n "xqvdbqljaxqvjlovktdi|SUPABASE|BLOB_READ_WRITE_TOKEN\s*=|BEGIN PRIVATE KEY" src api scripts tests package.json
```

Expected: no whitespace errors, no Supabase project reference in active code, no assigned token value, and no private key. Historical documents may retain their marked Supabase record.

- [ ] **Step 4: Perform local HTTP/browser verification**

Run the application with a test-injected catalogue endpoint or local Vercel-compatible runtime. Verify keyboard, pointer, mobile breakpoint, fullscreen, Cinema/Music/Media navigation, mixed Music audio/video order, focus refresh, failure retention, and removal of inactive/current items. Record exact browser versions and outcomes.

- [ ] **Step 5: Write the remote preview procedure without executing it**

Document these later approval-gated actions: create four harmless test objects in the existing Blob folders, deploy a preview, verify add/move/replace/delete discovery without rebuilding, verify public MIME/range behavior in the actual browser, test on the owner's phone, remove test objects, and confirm the player returns to its prior catalogue.

- [ ] **Step 6: Stop at the remote-mutation gate**

Present the exact Blob object names, preview deployment target, commands, and expected rollback for owner approval. Do not upload, rename, delete, deploy, or publish before that approval.

- [ ] **Step 7: Record final local status**

Run `git status --short --branch` and `git diff --check`. Report preserved pre-existing changes separately from this feature. Do not stage or commit.
