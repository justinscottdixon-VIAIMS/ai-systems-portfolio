# Mobile Portrait Fullscreen and Tagged Music Visuals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a portrait-only mobile native-video catalogue, branded VIAIMS fullscreen transport, deterministic `V_<title>_` Music titles, global `PLAY` row actions, and reusable filename-tagged Music visuals without disturbing Music audio or Cinema continuity.

**Architecture:** Extend the immutable preview manifest with validated dimensions, aspect, display-title, and optional Music-visual metadata. Keep parsing, eligibility, time display, fullscreen state, and tagged-visual transitions in small browser-neutral modules; leave `HybridMediaEngine.astro` as the DOM composition and event-wiring root. Music remains the audible/transport authority while a dedicated muted Music-visual element or muted Cinema independently owns the stage image.

**Tech Stack:** Astro 7, ECMAScript modules, native `<video>`/`<audio>`, Fullscreen API with a `100dvh` iPhone fallback, CSS safe-area environment variables, local `ffprobe`, Vercel Blob, Node test runner.

## Global Constraints

- Reuse `/Users/jsdmbp/Documents/ChatGPT/VIAIMS web agent Portfolio/site/.worktrees/adaptive-media-shadow`; do not create another worktree.
- Preserve every existing tracked and untracked change in the intentionally dirty worktree.
- Use strict RED/GREEN order: add a behavior test, observe the expected failure, implement the minimum coherent behavior, and rerun the focused test.
- Mobile means a viewport no wider than 767 CSS pixels.
- Mobile native-video catalogues expose only manifest items classified as `portrait`; landscape, square, and unknown items remain desktop-only.
- Do not rename media files. Music display titles use one `V_<creative title>_` frame and preserve intentional mixed capitalization.
- A tagged Music visual is always muted. The MP3 remains the authoritative clock, audible source, and Music transport target.
- Fullscreen never exposes seeking. Inline mobile transport always exposes the seek control plus elapsed and remaining time.
- Fullscreen controls hide after three seconds while playing, remain visible while paused, and fade the title over 1.25 seconds.
- Do not commit, stage, push, merge, publish a production manifest, deploy, alter hosting, production, aliases, DNS, or remote access during implementation or local verification.
- Do not begin production meters, commerce, portfolio narrative work, authenticated mobile ingestion, or final release work in this plan.

---

## File structure

| File | Responsibility |
|---|---|
| `src/lib/music-title.mjs` | Extract one canonical `VIZ-` filename token and derive an exact framed display title. |
| `src/lib/mobile-media.mjs` | Apply the 767px portrait-only eligibility policy without knowing about DOM. |
| `src/lib/transport-time.mjs` | Produce elapsed and negative-remaining strings from media time values. |
| `src/lib/fullscreen-session.mjs` | Own inline/fullscreen visibility state, timeouts, and stale-timer rejection. |
| `src/lib/music-visual-session.mjs` | Decide keep/replace/fade-to-Cinema transitions for reusable Music visuals. |
| `scripts/video-metadata.mjs` | Read dimensions with `ffprobe` and return validated aspect metadata. |
| `scripts/music-metadata.mjs` | Read and validate optional exact Music title overrides. |
| `scripts/ingestion-catalog.mjs` | Discover ordered provider media and the hidden `Media/Music-Visuals` system library. |
| `scripts/preview-media-catalog.mjs` | Build ordered upload descriptors and relationships for Cinema, Music, and hidden visuals. |
| `scripts/sync-media.mjs` | Upload every descriptor first, then invoke an injectable atomic manifest builder. |
| `scripts/sync-preview-media.mjs` | Create the preview manifest with dimensions, aspects, formatted Music titles, and resolved visuals. |
| `src/lib/media-manifest.mjs` | Validate optional aspect and Music-visual manifest fields without rejecting existing version-1 manifests. |
| `src/lib/media-library.mjs` | Preserve metadata while constructing Cinema and Music runtime products. |
| `src/components/HybridMediaEngine.astro` | Render the two transports and muted visual layer; coordinate browser media events. |
| `src/styles/hybrid-media-engine.css` | Hide ineligible mobile rows and present safe-area-aware fullscreen and transitions. |

---

### Task 1: Music filename titles and visual tags

**Files:**
- Create: `src/lib/music-title.mjs`
- Create: `tests/music-title.test.mjs`

**Interfaces:**
- Produces: `extractMusicVisualTag(filename) -> string | null`.
- Produces: `formatMusicDisplayTitle(filename, { overrideTitle } = {}) -> string`.
- Produces: `parseMusicIdentity(filename, options) -> { title: string, visualTag: string | null }`.

- [ ] **Step 1: Write the failing title and tag tests**

Create `tests/music-title.test.mjs` with exact cases:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractMusicVisualTag,
  formatMusicDisplayTitle,
  parseMusicIdentity,
} from '../src/lib/music-title.mjs';

test('Music titles remove delivery metadata and receive one global frame', () => {
  assert.equal(formatMusicDisplayTitle('1._metafysion one.mp3'), 'V_Metafysion One_');
  assert.equal(formatMusicDisplayTitle('V_edges fade_voo1.1.2_48k24b_mstr.mp3'), 'V_Edges Fade_');
  assert.equal(formatMusicDisplayTitle('V_manic_manIA__mstr.mp3'), 'V_Manic manIA_');
});

test('mixed creative capitals survive while ordinary lowercase words capitalize', () => {
  assert.equal(formatMusicDisplayTitle('V_aLiEn signal.mp3'), 'V_aLiEn Signal_');
});

test('one reserved visual token is canonical and absent from the display title', () => {
  assert.equal(extractMusicVisualTag('V_manic manIA__viz-void.mp3'), 'VIZ-VOID');
  assert.deepEqual(parseMusicIdentity('V_manic manIA__VIZ-VOID_mstr.mp3'), {
    title: 'V_Manic manIA_',
    visualTag: 'VIZ-VOID',
  });
});

test('exact overrides retain creative case and receive one frame', () => {
  assert.equal(formatMusicDisplayTitle('source.mp3', { overrideTitle: 'V_eXAct intent_' }), 'V_eXAct intent_');
});

test('multiple visual tokens are rejected', () => {
  assert.throws(
    () => extractMusicVisualTag('song__VIZ-VOID__VIZ-NEON.mp3'),
    /one visual tag/i,
  );
});
```

- [ ] **Step 2: Verify RED**

Run:

```bash
node --test tests/music-title.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/lib/music-title.mjs`.

- [ ] **Step 3: Implement canonical parsing and conservative formatting**

Create `src/lib/music-title.mjs` with these constants and public functions:

```js
import path from 'node:path';

const VISUAL_TAG = /(?:^|__)VIZ-([a-z0-9]+(?:-[a-z0-9]+)*)(?=__|_|$)/gi;
const LEADING_ORDER = /^\s*\d+\s*[._-]+\s*/;
const TECHNICAL_TOKEN = /^(?:mstr|master|\d+k\d+b|\d+khz|v\d+(?:\.\d+)*|voo\d+(?:\.\d+)*|mk\d+(?:\.\d+)*|stem\d+(?:\.\d+)*|agtr)$/i;
const COPY_SUFFIX = /\s*\(\d+\)\s*$/;

function frameTitle(value) {
  const unframed = value.trim().replace(/^V_/i, '').replace(/_$/, '').trim();
  if (!unframed) throw new TypeError('Music display title cannot be empty');
  return `V_${unframed}_`;
}

export function extractMusicVisualTag(filename) {
  const stem = path.basename(filename, path.extname(filename));
  const matches = [...stem.matchAll(VISUAL_TAG)];
  if (matches.length > 1) throw new TypeError(`${filename} may declare only one visual tag`);
  return matches[0] ? `VIZ-${matches[0][1].toUpperCase()}` : null;
}

export function formatMusicDisplayTitle(filename, { overrideTitle } = {}) {
  if (overrideTitle !== undefined) return frameTitle(overrideTitle);
  const stem = path.basename(filename, path.extname(filename));
  const withoutTag = stem.replace(VISUAL_TAG, '').replace(LEADING_ORDER, '').replace(COPY_SUFFIX, '');
  const tokens = withoutTag
    .replace(/^V_/i, '')
    .split(/[_\s]+/)
    .filter(Boolean)
    .filter((token) => !TECHNICAL_TOKEN.test(token));
  const title = tokens.map((token) => (
    /^[\p{Ll}\p{Lo}]+$/u.test(token)
      ? `${token[0].toLocaleUpperCase()}${token.slice(1)}`
      : token
  )).join(' ');
  return frameTitle(title);
}

export function parseMusicIdentity(filename, options) {
  return {
    title: formatMusicDisplayTitle(filename, options),
    visualTag: extractMusicVisualTag(filename),
  };
}
```

If a fixture exposes a technical suffix not covered by the approved examples, add only the exact recognized token to `TECHNICAL_TOKEN`; do not introduce a general “drop the last word” rule.

- [ ] **Step 4: Verify GREEN**

Run:

```bash
node --test tests/music-title.test.mjs
```

Expected: 5 tests pass.

- [ ] **Step 5: Record the local checkpoint without staging or committing**

Run:

```bash
git diff --check -- src/lib/music-title.mjs tests/music-title.test.mjs
```

Expected: no output and exit status 0.

---

### Task 2: Validated dimensions, Music overrides, and hidden visual discovery

**Files:**
- Create: `scripts/video-metadata.mjs`
- Create: `scripts/music-metadata.mjs`
- Create: `tests/video-metadata.test.mjs`
- Create: `tests/music-metadata.test.mjs`
- Modify: `scripts/ingestion-catalog.mjs`
- Modify: `tests/ingestion-catalog.test.mjs`
- Modify: `.gitignore`
- Modify: `tests/repository-policy.test.mjs`

**Interfaces:**
- Consumes: `classifyMediaAspect(width, height)` from `src/lib/media-presentation.mjs`.
- Produces: `parseVideoProbe(output, filename) -> { width, height, aspect }`.
- Produces: `probeVideoMetadata(absolutePath, { runner } = {}) -> Promise<{ width, height, aspect }>`.
- Produces: `readMusicMetadata({ musicDirectory, filenames }) -> Promise<Map<string, { title?: string }>>`.
- Extends: `discoverIngestionCandidates(...) -> { cinema, music, media, musicVisuals }`.

- [ ] **Step 1: Write failing video-probe tests**

Create `tests/video-metadata.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseVideoProbe, probeVideoMetadata } from '../scripts/video-metadata.mjs';

test('ffprobe dimensions become validated portrait metadata', () => {
  assert.deepEqual(parseVideoProbe('{"streams":[{"width":720,"height":1280}]}', 'portrait.mp4'), {
    width: 720,
    height: 1280,
    aspect: 'portrait',
  });
});

test('missing or invalid video dimensions fail closed', () => {
  assert.throws(() => parseVideoProbe('{"streams":[]}', 'broken.mp4'), /broken\.mp4.*dimensions/i);
});

test('probe invocation is injectable and requests the first video stream', async () => {
  const calls = [];
  const metadata = await probeVideoMetadata('/tmp/cue.mp4', {
    runner: async (command, args) => {
      calls.push([command, args]);
      return { stdout: '{"streams":[{"width":1920,"height":1080}]}' };
    },
  });
  assert.equal(calls[0][0], 'ffprobe');
  assert.equal(calls[0][1].includes('v:0'), true);
  assert.equal(metadata.aspect, 'landscape');
});
```

- [ ] **Step 2: Write failing Music metadata and hidden-library tests**

Create `tests/music-metadata.test.mjs` with complete validation cases, then extend `tests/ingestion-catalog.test.mjs` with the hidden-library case:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readMusicMetadata } from '../scripts/music-metadata.mjs';

test('Music metadata accepts exact title overrides for existing tracks', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'viaims-music-meta-'));
  await writeFile(path.join(directory, 'track-metadata.json'), JSON.stringify({
    'Song.mp3': { title: 'eXAct intent' },
  }));
  const metadata = await readMusicMetadata({ musicDirectory: directory, filenames: ['Song.mp3'] });
  assert.deepEqual(metadata.get('Song.mp3'), { title: 'eXAct intent' });
});

test('Music metadata rejects unknown files and unsupported fields', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'viaims-music-meta-'));
  const sidecar = path.join(directory, 'track-metadata.json');
  await writeFile(sidecar, JSON.stringify({ 'Missing.mp3': { title: 'Missing' } }));
  await assert.rejects(
    () => readMusicMetadata({ musicDirectory: directory, filenames: ['Song.mp3'] }),
    (error) => error.message.includes(sidecar) && error.message.includes('Missing.mp3'),
  );
  await writeFile(sidecar, JSON.stringify({ 'Song.mp3': { visual: 'implicit.mp4' } }));
  await assert.rejects(
    () => readMusicMetadata({ musicDirectory: directory, filenames: ['Song.mp3'] }),
    (error) => error.message.includes(sidecar) && error.message.includes('visual'),
  );
});
```

Add this separate test to `tests/ingestion-catalog.test.mjs`, using that file's existing `tree()` fixture and imports:

```js
test('ingestion discovers Music-Visuals separately from the Media playlist', async () => {
  const root = await tree();
  await mkdir(path.join(root, 'Media', 'Music-Visuals'));
  await writeFile(path.join(root, 'Media', 'Music-Visuals', 'VIZ-VOID.mp4'), 'visual');
  const catalog = await discoverIngestionCandidates({ rootDirectory: root });
  assert.deepEqual(catalog.media, []);
  assert.deepEqual(catalog.musicVisuals.map((item) => item.visualTag), ['VIZ-VOID']);
});
```

- [ ] **Step 3: Verify RED**

Run:

```bash
node --test tests/video-metadata.test.mjs tests/music-metadata.test.mjs tests/ingestion-catalog.test.mjs
```

Expected: FAIL because `video-metadata.mjs`, `music-metadata.mjs`, and `musicVisuals` do not exist.

- [ ] **Step 4: Implement the video probe boundary**

Create `scripts/video-metadata.mjs` using `execFile` through `promisify`:

```js
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { classifyMediaAspect } from '../src/lib/media-presentation.mjs';

const execFileAsync = promisify(execFile);

export function parseVideoProbe(output, filename) {
  let parsed;
  try { parsed = JSON.parse(output); } catch { throw new TypeError(`${filename} ffprobe output must be valid JSON`); }
  const { width, height } = parsed.streams?.[0] ?? {};
  if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
    throw new TypeError(`${filename} must report positive integer video dimensions`);
  }
  return { width, height, aspect: classifyMediaAspect(width, height) };
}

export async function probeVideoMetadata(absolutePath, { runner = execFileAsync } = {}) {
  const { stdout } = await runner('ffprobe', [
    '-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height', '-of', 'json', absolutePath,
  ]);
  return parseVideoProbe(stdout, absolutePath);
}
```

- [ ] **Step 5: Implement strict Music sidecar validation**

Create `scripts/music-metadata.mjs`. Treat absent `track-metadata.json` as an empty map. Require a plain JSON object keyed by exact filenames in `filenames`; each value must be a plain object whose only permitted key is a non-empty string `title`. Include the absolute sidecar path and offending key in every error. Return `new Map(Object.entries(parsed))` only after the complete document validates.

- [ ] **Step 6: Extend ingestion discovery**

In `scripts/ingestion-catalog.mjs`:

- exclude `track-metadata.json` from Music candidates;
- ignore directories during ordinary provider discovery as it already does;
- discover `Media/Music-Visuals` separately when present;
- accept only `.mp4`, `.mov`, and `.webm` files there;
- derive `visualTag` from the filename stem, require `/^VIZ-[A-Z0-9]+(?:-[A-Z0-9]+)*$/i`, and canonicalize to uppercase;
- reject canonical duplicates before returning;
- return `musicVisuals: [{ visualTag, filename, absolutePath }]` sorted by canonical tag.

Do not add `Music-Visuals` files to `catalog.media`.

- [ ] **Step 7: Keep sidecars trackable and binaries ignored**

Extend `.gitignore`:

```gitignore
!media-ingest/Music/track-metadata.json
!media-ingest/Media/Music-Visuals/
media-ingest/Media/Music-Visuals/*
!media-ingest/Media/Music-Visuals/.gitkeep
```

Extend `tests/repository-policy.test.mjs` to require the Music metadata sidecar and visual-library `.gitkeep` to remain trackable while `media-ingest/Media/Music-Visuals/example.mp4` is ignored.

- [ ] **Step 8: Verify GREEN**

Run:

```bash
node --test tests/video-metadata.test.mjs tests/music-metadata.test.mjs tests/ingestion-catalog.test.mjs tests/repository-policy.test.mjs
```

Expected: all four focused files pass.

- [ ] **Step 9: Validate the real local media tree without writing it**

Run this read-only inspection from the worktree root:

```bash
node --input-type=module -e "import { discoverIngestionCandidates } from './scripts/ingestion-catalog.mjs'; import { readMusicMetadata } from './scripts/music-metadata.mjs'; import { probeVideoMetadata } from './scripts/video-metadata.mjs'; const catalog = await discoverIngestionCandidates(); const metadata = await readMusicMetadata({ musicDirectory: './media-ingest/Music', filenames: catalog.music.map(({ filename }) => filename) }); const videos = [...catalog.cinema, ...catalog.musicVisuals]; const dimensions = []; for (const item of videos) dimensions.push({ filename: item.filename, visualTag: item.visualTag ?? null, ...await probeVideoMetadata(item.absolutePath) }); console.log(JSON.stringify({ cinema: catalog.cinema.length, music: catalog.music.length, musicVisuals: catalog.musicVisuals.length, titleOverrides: metadata.size, dimensions }, null, 2));"
```

Expected: every supplied native video reports positive dimensions, current songs without `VIZ-` tags remain valid, and `git status --short media-ingest` shows no binary modifications.

---

### Task 3: Atomic preview manifest metadata and runtime parsing

**Files:**
- Modify: `scripts/media-catalog.mjs`
- Modify: `scripts/preview-media-catalog.mjs`
- Modify: `scripts/sync-media.mjs`
- Modify: `scripts/sync-preview-media.mjs`
- Modify: `tests/media-catalog.test.mjs`
- Modify: `tests/preview-media-catalog.test.mjs`
- Modify: `tests/sync-media.test.mjs`
- Modify: `src/lib/media-manifest.mjs`
- Modify: `tests/media-manifest.test.mjs`
- Modify: `src/lib/media-library.mjs`
- Modify: `tests/media-library.test.mjs`

**Interfaces:**
- Consumes: `parseMusicIdentity`, `readMusicMetadata`, and `probeVideoMetadata`.
- Extends upload descriptors with `role`, `playlistOrder`, `width`, `height`, `aspect`, and optional `visualTag`.
- Extends `syncMedia(options)` with `manifestBuilder(published) -> manifest`, where `published` is `Array<{ file, url }>`.
- Extends version-1 audio items with optional `visual: { tag, src, width, height, aspect }`.
- Extends version-1 video items with required-for-new-publication optional-compatible `width`, `height`, and `aspect`.
- Extends curated Music Video and Media records with validated `width`, `height`, and `aspect`, because mobile eligibility cannot be inferred from a URL.

- [ ] **Step 1: Write failing descriptor and atomic-builder tests**

Add tests that require:

```js
test('preview descriptors preserve order and separate hidden visuals', async () => {
  const files = await discoverPreviewMedia({
    ingestionRoot: root,
    videoMetadataReader: async (absolutePath) => absolutePath.includes('portrait')
      ? { width: 720, height: 1280, aspect: 'portrait' }
      : { width: 1920, height: 1080, aspect: 'landscape' },
  });
  assert.deepEqual(files.map((file) => file.role), ['cinema', 'music', 'music-visual']);
  assert.equal(files.at(-1).visualTag, 'VIZ-VOID');
});

test('syncMedia publishes only after the custom builder sees every uploaded URL', async () => {
  const seen = [];
  const manifest = await syncMedia({
    rootDirectory: root,
    files,
    manifestPath,
    token: 'test-token',
    resolver: async () => null,
    uploader: async (key) => ({ url: `https://blob.example/${key}` }),
    manifestBuilder: (published) => {
      seen.push(...published);
      return { version: 1, generatedAt: '2026-09-03T00:00:00.000Z', items: [] };
    },
  });
  assert.equal(seen.length, files.length);
  assert.equal(manifest.items.length, 0);
});
```

Also retain the existing failure test proving the old manifest stays byte-identical if any upload or manifest-building step throws.

- [ ] **Step 2: Write failing manifest and library tests**

Extend the real test filenames `tests/media-manifest.test.mjs` and `tests/media-library.test.mjs`:

```js
test('manifest preserves validated aspect and reusable Music visual metadata', () => {
  const parsed = parseMediaManifest({
    version: 1,
    generatedAt: '2026-09-03T00:00:00.000Z',
    items: [{
      id: 'audio-song', kind: 'audio', title: 'V_Song_', src: 'https://blob.example/song.mp3',
      specs: 'MP3 • Compressed Delivery',
      visual: { tag: 'VIZ-VOID', src: 'https://blob.example/void.mp4', width: 720, height: 1280, aspect: 'portrait' },
    }],
  });
  assert.equal(parsed.items[0].visual.tag, 'VIZ-VOID');
});

test('Music runtime products retain their formatted title and shared visual identity', () => {
  const library = toMediaLibrary(manifestWithTaggedAudio);
  assert.equal(library.music[0].title, 'V_Song_');
  assert.equal(library.music[0].visual.tag, 'VIZ-VOID');
});

test('curated native video modes carry explicit aspect metadata', () => {
  const library = toMediaLibrary(manifestWithAudio, {
    version: 1,
    music: [{
      productId: 'audio-song', musicVideoSrc: 'https://blob.example/song.mp4',
      musicVideoWidth: 720, musicVideoHeight: 1280, musicVideoAspect: 'portrait',
    }],
    media: [{
      id: 'feature', title: 'Feature', src: 'https://blob.example/feature.mp4', specs: 'MP4',
      width: 1920, height: 1080, aspect: 'landscape',
    }],
    youtube: [],
  });
  assert.equal(library.music[0].videoAspect, 'portrait');
  assert.equal(library.media[0].aspect, 'landscape');
});
```

Add rejection cases for non-positive dimensions, aspect/dimension disagreement, a noncanonical tag, non-HTTPS visual URL, visual metadata on a video item, and a curated Music Video or Media source without complete dimension/aspect metadata.

- [ ] **Step 3: Verify RED**

Run:

```bash
node --test tests/media-catalog.test.mjs tests/preview-media-catalog.test.mjs tests/sync-media.test.mjs tests/media-manifest.test.mjs tests/media-library.test.mjs
```

Expected: FAIL because descriptor roles, the two-pass builder, and optional manifest fields are absent.

- [ ] **Step 4: Add metadata-preserving upload descriptors**

Extend `describeMediaFile` in `scripts/media-catalog.mjs` to accept `metadata = {}` and spread only these approved fields into its result: `role`, `playlistOrder`, `width`, `height`, `aspect`, and `visualTag`. Do not permit arbitrary sidecar objects or tokens to enter the upload descriptor.

Update `discoverPreviewMedia` to:

- read exact Music overrides;
- parse each Music filename into `{ title, visualTag }`;
- probe all Cinema and hidden visual videos;
- emit `role: 'cinema' | 'music' | 'music-visual'`;
- retain provider order for Cinema and Music;
- reject a Music tag with no exactly matching hidden visual;
- preserve the descriptor array order `cinema`, then `music`, then `music-visual`.

- [ ] **Step 5: Generalize sync atomically without changing production defaults**

In `scripts/sync-media.mjs`, collect uploaded/reused results as:

```js
const published = [];
// After resolving each file URL:
published.push({ file, url });

const manifest = manifestBuilder
  ? await manifestBuilder(published, { generatedAt })
  : {
      version: 1,
      generatedAt,
      items: published.map(({ file, url }) => toManifestItem(file, url)),
    };
```

Validate that the builder returns an object with an `items` array before writing. Keep the existing temporary-file-plus-rename operation after all uploads and manifest construction succeed.

- [ ] **Step 6: Build the preview manifest relationships**

In `scripts/sync-preview-media.mjs`, build a `Map` from published `music-visual` tag to its URL and metadata. Emit only `cinema` and `music` descriptors as manifest items. Cinema items receive `width`, `height`, and `aspect`. Music items receive the preformatted title and, when tagged, this exact shape:

```js
visual: {
  tag: visual.visualTag,
  src: visual.url,
  width: visual.width,
  height: visual.height,
  aspect: visual.aspect,
}
```

Do not emit hidden Music visuals as Cinema or Media items.

- [ ] **Step 7: Extend parsing with backward compatibility**

In `src/lib/media-manifest.mjs`, continue accepting current version-1 items without dimensions so the production manifest remains buildable. When any dimension/aspect field exists, require all three. Recompute aspect using `classifyMediaAspect(width, height)` and reject disagreement. Validate `visual` only on audio items; require a canonical `/^VIZ-[A-Z0-9]+(?:-[A-Z0-9]+)*$/` tag, HTTPS source, positive dimensions, and matching derived aspect.

Map the validated fields through `toMediaLibrary`; use `visual: null` for untagged Music products. For curated `musicVideoSrc`, require companion `musicVideoWidth`, `musicVideoHeight`, and `musicVideoAspect`, then expose `videoAspect`. For each curated Media item, require `width`, `height`, and `aspect`. Use the same dimension/aspect agreement validator as the manifest so curated URLs cannot bypass mobile eligibility.

- [ ] **Step 8: Verify GREEN and production compatibility**

Run:

```bash
node --test tests/media-catalog.test.mjs tests/preview-media-catalog.test.mjs tests/sync-media.test.mjs tests/media-manifest.test.mjs tests/media-library.test.mjs
npm run build
```

Expected: focused tests pass and the default build succeeds against the unchanged production manifest.

- [ ] **Step 9: Regenerate only the local preview manifest after explicit upload confirmation**

Do not upload during ordinary implementation. First run the preview catalogue in read-only mode and compare the descriptor hashes with `src/data/media.preview.json`. If new hidden visual files exist and upload is separately approved, run the existing authorized preview sync command. Otherwise, create fixture-backed validation and leave the deployed preview unchanged.

---

### Task 4: Portrait-only runtime queues and inline transport metadata

**Files:**
- Create: `src/lib/mobile-media.mjs`
- Create: `src/lib/transport-time.mjs`
- Create: `tests/mobile-media.test.mjs`
- Create: `tests/transport-time.test.mjs`
- Modify: `src/components/HybridMediaEngine.astro`
- Modify: `src/styles/hybrid-media-engine.css`
- Modify: `tests/hybrid-media-engine.test.mjs`

**Interfaces:**
- Produces: `isMobileViewport(width) -> boolean`.
- Produces: `eligibleVideoItems(items, width) -> items`.
- Produces: `formatTransportTime({ currentTime, duration }) -> { elapsed, remaining }`.
- Produces DOM hooks: `[data-media-aspect]`, `#active-seek`, `#active-elapsed`, `#active-remaining`, and `#enter-fullscreen`.

- [ ] **Step 1: Write failing pure policy tests**

Create `tests/mobile-media.test.mjs` and `tests/transport-time.test.mjs`:

```js
test('mobile exposes only portrait native videos while desktop retains all', () => {
  const items = [
    { id: 'p', aspect: 'portrait' },
    { id: 'l', aspect: 'landscape' },
    { id: 's', aspect: 'square' },
    { id: 'u' },
  ];
  assert.deepEqual(eligibleVideoItems(items, 390).map((item) => item.id), ['p']);
  assert.deepEqual(eligibleVideoItems(items, 768).map((item) => item.id), ['p', 'l', 's', 'u']);
});

test('transport time reports elapsed and negative remaining', () => {
  assert.deepEqual(formatTransportTime({ currentTime: 65, duration: 185 }), {
    elapsed: '1:05', remaining: '-2:00',
  });
  assert.deepEqual(formatTransportTime({ currentTime: 0, duration: Number.NaN }), {
    elapsed: '--:--', remaining: '--:--',
  });
});
```

- [ ] **Step 2: Write failing component-contract tests**

Extend `tests/hybrid-media-engine.test.mjs` to require:

- rendered video rows expose `data-media-aspect`;
- CSS at `max-width:767px` hides nonportrait rows with `display:none`;
- the controller creates its Cinema runtime queue through `eligibleVideoItems`;
- Previous, Next, ended, retry, and fallback all consume that same queue;
- nonportrait Music Video actions are absent/disabled on mobile while the Music audio action remains available;
- nonportrait owned Media rows are absent from the mobile runtime queue;
- the inline transport contains one range input with `aria-label="Seek active item"`;
- elapsed and remaining outputs exist outside the fullscreen overlay;
- `AUDIO` is absent as a Music row action and every audio-mode button visibly says `PLAY` with `Play <title>` as its accessible name.

- [ ] **Step 3: Verify RED**

Run:

```bash
node --test tests/mobile-media.test.mjs tests/transport-time.test.mjs tests/hybrid-media-engine.test.mjs
```

Expected: FAIL on missing modules and transport hooks.

- [ ] **Step 4: Implement pure eligibility and time formatting**

Create `src/lib/mobile-media.mjs`:

```js
export const MOBILE_MAX_WIDTH = 767;
export const isMobileViewport = (width) => Number.isFinite(width) && width <= MOBILE_MAX_WIDTH;
export function eligibleVideoItems(items, width) {
  return isMobileViewport(width) ? items.filter((item) => item.aspect === 'portrait') : [...items];
}
```

Create `src/lib/transport-time.mjs` with finite-number guards, floor-to-whole-second behavior, `M:SS` below one hour, `H:MM:SS` at one hour or more, and a `-` prefix on remaining time.

- [ ] **Step 5: Render metadata and one inline seek surface**

In `HybridMediaEngine.astro`:

- emit each Cinema and owned Media row's aspect as `data-media-aspect`;
- emit each Music Video action's `videoAspect` as `data-media-aspect` without applying it to the Music audio action;
- change the Music audio action text to `PLAY` while retaining `data-music-mode="audio"`;
- add `#active-seek` only to the inline transport;
- add `#active-elapsed` and `#active-remaining` as non-live text outputs;
- add `#enter-fullscreen` disabled until a mobile-eligible native visual is available.

Bind the range value to the active authoritative media element. Seek only on explicit range input/change. Update time text on `loadedmetadata`, `durationchange`, `timeupdate`, source activation, and ended.

- [ ] **Step 6: Use one filtered Cinema queue everywhere**

Retain `allCinemaItems` and `allMediaItems` from rendered data and derive `cinemaItems` and `mediaItems` through `eligibleVideoItems(..., window.innerWidth)` before selecting or requesting a source. Apply the same predicate to Music Video activation while leaving its Audio action eligible. On breakpoint changes, rebuild the native-video queues. If selected Cinema becomes ineligible, select the first portrait item without exposing or autoplaying the ineligible source. Route every Cinema Previous, Next, natural end, retry, tagged-visual fallback, and owned-Media activation through the filtered collections.

- [ ] **Step 7: Implement mobile-only visibility CSS**

At `@media (max-width:767px)`, hide rendered Cinema/Media rows and Music Video buttons whose `data-media-aspect` is not `portrait`. Keep them rendered for desktop and accessibility-tree consistency only above the breakpoint. Ensure hidden rows and descendants cannot receive focus. Do not hide the corresponding Music product or its `PLAY` audio action.

- [ ] **Step 8: Verify GREEN**

Run:

```bash
node --test tests/mobile-media.test.mjs tests/transport-time.test.mjs tests/hybrid-media-engine.test.mjs
```

Expected: all focused policy, time, and component tests pass.

---

### Task 5: Branded fullscreen session and safe-area overlay

**Files:**
- Create: `src/lib/fullscreen-session.mjs`
- Create: `tests/fullscreen-session.test.mjs`
- Modify: `src/components/HybridMediaEngine.astro`
- Modify: `src/styles/hybrid-media-engine.css`
- Modify: `tests/hybrid-media-engine.test.mjs`

**Interfaces:**
- Produces: `createFullscreenSession({ hideDelayMs: 3000, titleFadeMs: 1250 })`.
- Session methods: `enter()`, `exit()`, `interact()`, `setPaused(paused)`, `onHideTimer(token)`, and `snapshot()`.
- Produces DOM hooks: `[data-fullscreen-shell]`, `[data-fullscreen-overlay]`, `#exit-fullscreen`, `#fullscreen-prev`, `#fullscreen-play`, `#fullscreen-next`, `#fullscreen-mute`, `#fullscreen-elapsed`, `#fullscreen-remaining`, and `#fullscreen-title`.

- [ ] **Step 1: Write failing state tests**

Create `tests/fullscreen-session.test.mjs`:

```js
test('playing fullscreen hides controls only after the current three-second token', () => {
  const session = createFullscreenSession();
  const first = session.enter();
  const second = session.interact();
  assert.equal(session.onHideTimer(first.token).controlsVisible, true);
  assert.equal(session.onHideTimer(second.token).controlsVisible, false);
});

test('paused fullscreen remains visible and exit returns inline', () => {
  const session = createFullscreenSession();
  session.enter();
  session.setPaused(true);
  assert.equal(session.onHideTimer(session.snapshot().token).controlsVisible, true);
  assert.equal(session.exit().mode, 'inline');
});
```

Also cover `hideDelayMs === 3000`, `titleFadeMs === 1250`, interaction invalidating stale timers, and idempotent exit.

- [ ] **Step 2: Write failing markup, API, and CSS tests**

Require the component to:

- request fullscreen on the complete shell, never `#master-video` alone;
- catch rejection and set `data-fullscreen-mode="viewport"`;
- reconcile `fullscreenchange` and `fullscreenerror`;
- omit any range input from `[data-fullscreen-overlay]`;
- keep fullscreen time/title inside the same visibility group;
- bind image taps to reveal only, excluding button-originated taps;
- restore focus to `#enter-fullscreen` on exit;
- use `100dvh`, `env(safe-area-inset-*)`, `object-fit:contain`, and a 1.25-second title opacity transition;
- preserve 44px minimum touch targets.

- [ ] **Step 3: Verify RED**

Run:

```bash
node --test tests/fullscreen-session.test.mjs tests/hybrid-media-engine.test.mjs
```

Expected: FAIL because the session and fullscreen shell do not exist.

- [ ] **Step 4: Implement the browser-neutral session**

Implement an incrementing token state machine in `src/lib/fullscreen-session.mjs`. `enter()` and `interact()` increment the token and show controls. `onHideTimer(token)` hides controls only when mode is fullscreen, playback is not paused, and `token` equals the current token. `setPaused(true)` increments the token and shows controls. `exit()` increments the token and resets to inline. Return immutable snapshots containing `mode`, `controlsVisible`, `paused`, `token`, `hideDelayMs`, and `titleFadeMs`.

- [ ] **Step 5: Render one fullscreen overlay over the existing stage**

Wrap the stage and overlay in `[data-fullscreen-shell]`. Render distinct fullscreen buttons but route them into the same existing transport actions used by the inline controls. Render the active formatted title and duplicate read-only time outputs; never duplicate the media element or seek range.

Render the fullscreen controls as two safe-area-aware dark-glass capsules: Previous/Play-Pause/Next in the primary capsule, and Mute-Unmute/time in the utility capsule. Use inline SVG icons with accessible button names and a separate circular glass Exit button. Fullscreen controls must call shared controller commands directly; they must not proxy-click inline DOM controls whose disabled state can diverge from fullscreen presentation state.

On `#enter-fullscreen` click:

```js
fullscreenSession.enter();
try {
  if (fullscreenShell.requestFullscreen) {
    await fullscreenShell.requestFullscreen({ navigationUI: 'hide' });
    fullscreenShell.dataset.fullscreenMode = 'native';
  } else {
    fullscreenShell.dataset.fullscreenMode = 'viewport';
  }
} catch {
  fullscreenShell.dataset.fullscreenMode = 'viewport';
}
renderFullscreenSession();
```

Exit native fullscreen through `document.exitFullscreen()` when owned by the shell, clear the viewport dataset otherwise, and always call the session's `exit()` after browser state reconciles.

- [ ] **Step 6: Implement safe-area and visibility CSS**

For native `:fullscreen` and `[data-fullscreen-mode="viewport"]`, use fixed black containment, `inset:0`, `width:100vw`, `height:100dvh`, the top layer available to the mode, and `overflow:hidden`. Apply safe-area padding to the title, exit button, and bottom transport. Use `object-fit:contain` for authoritative and tagged videos. Toggle overlay pointer events and opacity from `data-controls-visible`; apply the approved 1.25-second title fade only after the three-second controller timeout.

- [ ] **Step 7: Verify GREEN**

Run:

```bash
node --test tests/fullscreen-session.test.mjs tests/hybrid-media-engine.test.mjs tests/transport-time.test.mjs
```

Expected: all fullscreen, component, and time tests pass.

---

### Task 6: Reusable tagged Music visual continuity and Cinema reveal

**Files:**
- Create: `src/lib/music-visual-session.mjs`
- Create: `tests/music-visual-session.test.mjs`
- Modify: `src/components/HybridMediaEngine.astro`
- Modify: `src/styles/hybrid-media-engine.css`
- Modify: `tests/hybrid-media-engine.test.mjs`
- Modify: `tests/playback-session.test.mjs`

**Interfaces:**
- Produces: `createMusicVisualSession()` with `activate(visual)`, `releaseToCinema(cinemaId)`, `completeFade(token)`, `fail(token)`, and `snapshot()`.
- Visual identity: `{ tag, src, aspect }`.
- Produces DOM hook: `#music-visual-video` and stage datasets `data-visual-owner`, `data-visual-tag`, and `data-visual-transition`.

- [ ] **Step 1: Write failing visual-state tests**

Create `tests/music-visual-session.test.mjs`:

```js
test('consecutive songs with the same tag keep one seamless visual generation', () => {
  const session = createMusicVisualSession();
  const first = session.activate({ tag: 'VIZ-VOID', src: 'void.mp4', aspect: 'portrait' });
  const second = session.activate({ tag: 'VIZ-VOID', src: 'void.mp4', aspect: 'portrait' });
  assert.equal(second.action, 'keep');
  assert.equal(second.token, first.token);
});

test('untagged advance prepares next Cinema then performs one stale-safe fade', () => {
  const session = createMusicVisualSession();
  session.activate({ tag: 'VIZ-VOID', src: 'void.mp4', aspect: 'portrait' });
  const transition = session.releaseToCinema('cinema-next');
  assert.equal(transition.action, 'fade-to-cinema');
  assert.equal(session.completeFade(transition.token).owner, 'cinema');
  assert.equal(session.completeFade(transition.token - 1).owner, 'cinema');
});
```

Add cases for different-tag replacement, visual failure, and stale failure/fade events.

- [ ] **Step 2: Write failing component orchestration tests**

Extend `tests/hybrid-media-engine.test.mjs` and `tests/playback-session.test.mjs` to require:

- one separate muted, `playsinline`, looping `#music-visual-video`;
- Music Audio activation resolves `product.visual` without changing the Cinema selection cursor;
- same-tag automatic and manual track changes do not assign `src`, set `currentTime`, call `load()`, or call a second `play()` on the visual;
- Music pause/resume pauses/resumes the tagged visual while MP3 remains authoritative;
- different-tag changes prepare the replacement behind a generation guard;
- tagged-to-untagged automatic advance starts the next eligible Cinema item at `0`, muted, underneath the visual;
- only the outgoing visual fades; Cinema receives no fade-in class;
- fullscreen remains active throughout;
- Music Previous/Next remains authoritative over both visual owners;
- visual error and Cinema error never pause Music.

- [ ] **Step 3: Verify RED**

Run:

```bash
node --test tests/music-visual-session.test.mjs tests/hybrid-media-engine.test.mjs tests/playback-session.test.mjs
```

Expected: FAIL because the visual session and DOM layer do not exist.

- [ ] **Step 4: Implement the pure visual session**

The state contains `{ owner, visual, cinemaId, transition, token }`. `activate` returns `action:'keep'` without incrementing the token when tag and source match; otherwise it increments and returns `action:'replace'`. `releaseToCinema` increments and returns `action:'fade-to-cinema'`. `completeFade` and `fail` mutate only when their token matches. A stale call returns the unchanged snapshot.

- [ ] **Step 5: Add the dedicated muted visual layer**

Render this element inside the existing stage, above master Cinema and below fullscreen controls:

```astro
<video
  id="music-visual-video"
  muted
  playsinline
  loop
  preload="metadata"
  aria-hidden="true"
  class="music-visual-video"
></video>
```

Never add native controls or audible output to it.

- [ ] **Step 6: Route Music activation through visual identity**

On Music Audio activation:

- claim the existing Music audible authority first;
- if `product.visual` is eligible, call `activate`;
- for `keep`, leave the visual element untouched;
- for `replace`, set the new source, wait for current-generation metadata/canplay, reset only the new visual to zero, start it muted, and atomically reveal it;
- if Music is paused, keep the visual paused; when Music resumes, resume the current visual without seeking;
- if the visual fails, isolate it and keep Music running.

- [ ] **Step 7: Implement the single fade to new Cinema**

When Music automatically or manually advances from tagged to untagged:

1. advance `cinemaItems` through the existing Cinema continuity helper;
2. commit the new Cinema identity before requesting its source;
3. request the Cinema source at `currentTime = 0`, `muted = true`;
4. wait for current-generation readiness and start Cinema motion;
5. set `data-visual-transition="fade-out"` on the tagged layer;
6. on transition completion or a bounded 1.25-second fallback timer, call `completeFade(token)` and clear the visual source;
7. leave fullscreen session state and Music playback untouched.

Do not add a Cinema fade-in. On Cinema preparation failure, keep Music playing, transition to the truthful black/unavailable stage, and expose the existing Cinema retry path without taking Music transport.

- [ ] **Step 8: Implement CSS ownership and fade**

Cinema remains the base layer. Tagged visual opacity is 1 only for `data-visual-owner="music-tag"`; `fade-out` transitions it to 0 over 1.25 seconds. Fullscreen controls remain above both layers. Reduced motion may shorten the opacity transition but must preserve the ordered prepare-then-reveal state change.

- [ ] **Step 9: Verify GREEN**

Run:

```bash
node --test tests/music-visual-session.test.mjs tests/hybrid-media-engine.test.mjs tests/playback-session.test.mjs tests/fullscreen-session.test.mjs
```

Expected: all tagged-visual, component, playback, and fullscreen tests pass.

---

### Task 7: Full verification, review, and local browser gate

**Files:**
- Modify: `docs/product/portfolio-completion-checklist.md`
- Create: `docs/product/2026-09-03-mobile-fullscreen-and-tagged-visual-validation.md`

**Interfaces:**
- Consumes every public seam from Tasks 1–6.
- Produces a local validation record; no deployment or production mutation.

- [ ] **Step 1: Run every focused suite together**

Run:

```bash
node --test \
  tests/music-title.test.mjs \
  tests/video-metadata.test.mjs \
  tests/music-metadata.test.mjs \
  tests/ingestion-catalog.test.mjs \
  tests/media-catalog.test.mjs \
  tests/preview-media-catalog.test.mjs \
  tests/sync-media.test.mjs \
  tests/media-manifest.test.mjs \
  tests/media-library.test.mjs \
  tests/mobile-media.test.mjs \
  tests/transport-time.test.mjs \
  tests/fullscreen-session.test.mjs \
  tests/music-visual-session.test.mjs \
  tests/hybrid-media-engine.test.mjs \
  tests/playback-session.test.mjs
```

Expected: all focused tests pass with zero skips, cancellations, or todos.

- [ ] **Step 2: Run full verification and both build modes**

Run:

```bash
npm test
npm run build
VIAIMS_MEDIA_MANIFEST_PATH=src/data/media.preview.json npm run build
git diff --check
```

Expected: the complete suite passes, both static builds finish successfully, and diff hygiene reports no errors. Confirm `shasum -a 256 src/data/media.json` still matches its pre-implementation fingerprint.

- [ ] **Step 3: Perform independent Critical/Important review**

Review the implementation against `docs/superpowers/specs/2026-09-03-mobile-portrait-fullscreen-and-tagged-music-visuals-design.md` along two axes:

- standards: stale-event safety, secret/binary exclusion, accessibility, browser API cleanup, and no duplicate audible sources;
- specification: portrait filtering, transport ownership, title rules, seamless same-tag behavior, and single fade-to-Cinema behavior.

Resolve every Critical and Important finding test-first, then rerun Steps 1 and 2.

- [ ] **Step 4: Start a local production-equivalent preview**

Use the repository's background-server convention from `AGENTS.md`. Build with the preview manifest, start the static preview in background mode if supported by the installed Astro CLI, and confirm the bound URL before opening browsers. Do not create a tunnel or deployment.

- [ ] **Step 5: Validate Chromium at 390 and 430 CSS pixels**

Verify and record:

- nonportrait video rows are absent and cannot be reached by Previous/Next;
- inline scrubber and both time displays are continuously visible;
- fullscreen contains no scrubber;
- complete portrait frame remains uncropped;
- controls hide after three seconds, stay while paused, and return on tap;
- title uses the exact formatted identity and fades over 1.25 seconds;
- same-tag consecutive songs do not restart the visual;
- tagged-to-untagged advance starts next Cinema at zero and performs one visual fade;
- Music Previous/Next remains authoritative;
- no page overflow, console errors, or unhandled promise rejections.

- [ ] **Step 6: Validate Safari/iPhone fallback behavior locally**

In Safari responsive mode at 390 and 430 CSS pixels, verify the fixed `100dvh` path, safe areas, focus restoration, browser-chrome tolerance, and the same playback checks from Step 5. Where desktop Safari supports element fullscreen, also verify native fullscreen exit reconciliation.

- [ ] **Step 7: Record evidence and update the checklist**

Write `docs/product/2026-09-03-mobile-fullscreen-and-tagged-visual-validation.md` with test counts, build results, browser/version, viewport, fixture identities, observed transitions, defects, and unresolved real-device items. Update the portfolio checklist to mark only completed local items; leave remote iPhone and publication gates unchecked.

- [ ] **Step 8: Stop for explicit remote-preview approval**

Do not commit, stage, upload new visual binaries, redeploy the Vercel preview, change its shareable link, or alter production. Present the local evidence and request the next explicit approval gate.
