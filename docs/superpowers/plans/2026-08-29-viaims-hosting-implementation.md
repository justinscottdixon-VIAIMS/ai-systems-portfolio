# viaims.com Hosting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the existing Astro portfolio at `viaims.com` from Justin's own single-seat Vercel Pro account, with its 2.3 GB media library served from Vercel Blob and a preview-first DNS cutover.

**Architecture:** Keep Astro as a static GitHub-backed Vercel deployment. Replace build-time directory scanning with a validated, tracked media manifest whose URLs point to a team-owned public Vercel Blob store; a local sync command retains the drop-folder ingestion workflow. Keep Wix as registrar and DNS authority during launch, preserve unrelated DNS records, and attach the domain only after preview and media validation pass.

**Tech Stack:** Astro 7, Tailwind CSS 4, Node.js 22.12+, Node's built-in test runner, `@vercel/blob`, Vercel Pro, Vercel Blob, Wix DNS, GitHub.

## Global Constraints

- Justin owns the Vercel project, Blob store, billing, environment secrets, and production domain.
- Use one paid Vercel developer seat; Keith collaborates through GitHub and may use a free viewer role.
- Preserve the existing uncommitted portfolio work before deployment changes.
- Preserve the existing Resend DKIM TXT record and all unrelated DNS records.
- Do not move nameservers or transfer the registrar during initial launch.
- Do not alter, re-encode, or master the source audio/video assets.
- Keep the app static; add no server adapter without a demonstrated requirement.
- Keep media binaries ignored by Git.
- A failed upload must not publish a partial manifest.
- Do not touch production DNS until the preview passes validation.

## File Structure

- `src/lib/media-manifest.mjs`: validates the tracked manifest and converts it into video/audio playlists.
- `src/data/media.json`: tracked, deployment-safe list of Blob-backed media metadata.
- `scripts/media-catalog.mjs`: discovers local drop-folder assets and deterministically derives safe Blob keys and display metadata.
- `scripts/sync-media.mjs`: uploads all discovered media and atomically replaces the manifest only after success.
- `tests/media-manifest.test.mjs`: unit tests for manifest validation and playlist conversion.
- `tests/media-catalog.test.mjs`: unit tests for discovery, key normalization, collision detection, and metadata.
- `tests/sync-media.test.mjs`: integration-style tests with an injected fake uploader; no network access.
- `src/components/HybridMediaEngine.astro`: consumes manifest playlists instead of reading the filesystem.
- `src/pages/index.astro`: loads the manifest once, passes it to the engine, and supplies the Blob preconnect origin.
- `src/layouts/Layout.astro`: exposes a named head slot for resource hints.
- `public-deploy/`: contains only deployable static files; local media remains in the existing ignored `public/media` drop folders.
- `astro.config.mjs`: declares static output, the canonical production site URL, and the media-free deployable public directory.
- `vercel.json`: production security and immutable-asset cache headers.
- `docs/operations/viaims-launch-runbook.md`: records preview, cutover, verification, and rollback commands.

### Approved atomic-release correction (2026-08-29)

This human-approved correction overrides the earlier deterministic overwrite
example in Task 3. Each Blob key is an immutable SHA-256 content-addressed
release in the form `portfolio/<kind>/<hash>-<safe-name>`, with
`allowOverwrite: false`. Stable manifest IDs and titles remain filename-derived.
All normalized-key and manifest-ID collisions are rejected before upload, and a
failed later upload must leave the previously published manifest bytes and every
referenced URL unchanged.

---

### Task 1: Preserve the Current Portfolio Baseline

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Commit existing: `.gitignore`
- Commit existing: `src/pages/index.astro`
- Commit existing: `src/components/HybridMediaEngine.astro`
- Commit existing: `src/components/PublicationsAndCredits.astro`

**Interfaces:**
- Consumes: the current local working tree copied from `/Users/jsdmbp/ai-systems-portfolio`.
- Produces: a committed, reproducible baseline and `npm test` entry point for later tasks.

- [ ] **Step 1: Create the launch branch and record the pre-change state**

Run:

```bash
git switch -c codex/viaims-launch
git status --short --branch
git diff -- .gitignore src/pages/index.astro
```

Expected: branch `codex/viaims-launch`; the existing modified and untracked portfolio files remain present.

- [ ] **Step 2: Install the one runtime dependency and add the test scripts**

Run:

```bash
npm install @vercel/blob
npm pkg set scripts.test="node --test tests/*.test.mjs"
npm pkg set scripts.media:sync="node --env-file=.env.local scripts/sync-media.mjs"
```

Expected: `package.json` contains these scripts and `@vercel/blob`; `package-lock.json` is updated.

- [ ] **Step 3: Verify the current site builds before refactoring**

Run:

```bash
npm run build
```

Expected: Astro completes the static build before the media refactor begins.

- [ ] **Step 4: Commit the preserved baseline separately**

Run:

```bash
git add .gitignore package.json package-lock.json src/pages/index.astro src/components/HybridMediaEngine.astro src/components/PublicationsAndCredits.astro
git commit -m "feat: preserve portfolio media console baseline"
```

Expected: one commit containing the pre-hosting portfolio and dependency/script setup; media binaries remain untracked and ignored.

---

### Task 2: Add a Validated Media Manifest Boundary

**Files:**
- Create: `src/lib/media-manifest.mjs`
- Create: `src/data/media.json`
- Create: `tests/media-manifest.test.mjs`

**Interfaces:**
- Consumes: JSON shaped as `{ version: 1, generatedAt: string, items: MediaItem[] }`.
- Produces: `parseMediaManifest(input)`, `toPlaylists(manifest)`, and `getMediaOrigin(manifest)`.

- [ ] **Step 1: Write failing manifest tests**

Create `tests/media-manifest.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getMediaOrigin,
  parseMediaManifest,
  toPlaylists,
} from '../src/lib/media-manifest.mjs';

const valid = {
  version: 1,
  generatedAt: '2026-08-29T17:00:00.000Z',
  items: [
    {
      id: 'video-atlas-1',
      kind: 'video',
      title: '3I | ATLAS 1',
      src: 'https://example.public.blob.vercel-storage.com/video/3i-atlas-1.mp4',
      specs: 'MP4 Master',
      engine: 'Sora Pro',
    },
    {
      id: 'audio-edges-fade',
      kind: 'audio',
      title: 'V edges fade voo1.1.2 48k24b mstr',
      src: 'https://example.public.blob.vercel-storage.com/audio/v-edges-fade.wav',
      specs: 'WAV • 24-bit / 48kHz Staging',
    },
  ],
};

test('parseMediaManifest accepts a complete HTTPS manifest', () => {
  assert.deepEqual(parseMediaManifest(valid), valid);
});

test('parseMediaManifest rejects an unsupported version', () => {
  assert.throws(
    () => parseMediaManifest({ ...valid, version: 2 }),
    /version must be 1/,
  );
});

test('parseMediaManifest rejects non-HTTPS media', () => {
  const invalid = structuredClone(valid);
  invalid.items[0].src = '/media/video/local.mp4';
  assert.throws(() => parseMediaManifest(invalid), /HTTPS URL/);
});

test('toPlaylists splits video and audio without losing metadata', () => {
  const playlists = toPlaylists(parseMediaManifest(valid));
  assert.equal(playlists.videoPlaylist[0].engine, 'Sora Pro');
  assert.equal(playlists.audioPlaylist[0].id, 'audio-edges-fade');
});

test('toPlaylists supplies explicit standby entries for an empty manifest', () => {
  const playlists = toPlaylists({
    version: 1,
    generatedAt: '2026-08-29T17:00:00.000Z',
    items: [],
  });
  assert.equal(playlists.videoPlaylist[0].title, 'No Media Loaded');
  assert.equal(playlists.audioPlaylist[0].title, 'No Masters Loaded');
});

test('getMediaOrigin returns the first shared Blob origin', () => {
  assert.equal(getMediaOrigin(valid), 'https://example.public.blob.vercel-storage.com');
});
```

- [ ] **Step 2: Run the tests and verify the missing-module failure**

Run:

```bash
npm test
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/lib/media-manifest.mjs`.

- [ ] **Step 3: Implement the manifest module**

Create `src/lib/media-manifest.mjs`:

```js
const HTTPS = 'https:';
const KINDS = new Set(['video', 'audio']);

function requiredString(value, field, index) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`items[${index}].${field} must be a non-empty string`);
  }
  return value;
}

export function parseMediaManifest(input) {
  if (!input || typeof input !== 'object') {
    throw new TypeError('manifest must be an object');
  }
  if (input.version !== 1) {
    throw new TypeError('manifest version must be 1');
  }
  if (typeof input.generatedAt !== 'string' || Number.isNaN(Date.parse(input.generatedAt))) {
    throw new TypeError('manifest generatedAt must be an ISO date string');
  }
  if (!Array.isArray(input.items)) {
    throw new TypeError('manifest items must be an array');
  }

  const seenIds = new Set();
  const items = input.items.map((item, index) => {
    if (!item || typeof item !== 'object') {
      throw new TypeError(`items[${index}] must be an object`);
    }
    const id = requiredString(item.id, 'id', index);
    if (seenIds.has(id)) throw new TypeError(`duplicate media id: ${id}`);
    seenIds.add(id);
    if (!KINDS.has(item.kind)) {
      throw new TypeError(`items[${index}].kind must be video or audio`);
    }
    const src = requiredString(item.src, 'src', index);
    let url;
    try {
      url = new URL(src);
    } catch {
      throw new TypeError(`items[${index}].src must be an HTTPS URL`);
    }
    if (url.protocol !== HTTPS) {
      throw new TypeError(`items[${index}].src must be an HTTPS URL`);
    }
    const parsed = {
      id,
      kind: item.kind,
      title: requiredString(item.title, 'title', index),
      src,
      specs: requiredString(item.specs, 'specs', index),
    };
    if (item.engine !== undefined) {
      parsed.engine = requiredString(item.engine, 'engine', index);
    }
    return parsed;
  });

  return { version: 1, generatedAt: input.generatedAt, items };
}

export function toPlaylists(manifest) {
  const videoPlaylist = manifest.items
    .filter((item) => item.kind === 'video')
    .map((item) => ({ ...item, type: 'video', engine: item.engine ?? 'AI Render' }));
  const audioPlaylist = manifest.items.filter((item) => item.kind === 'audio');

  return {
    videoPlaylist: videoPlaylist.length > 0 ? videoPlaylist : [{
      id: 'video-standby',
      title: 'No Media Loaded',
      type: 'video',
      src: '',
      engine: 'Standby',
      specs: 'N/A',
    }],
    audioPlaylist: audioPlaylist.length > 0 ? audioPlaylist : [{
      id: 'audio-standby',
      title: 'No Masters Loaded',
      src: '',
      specs: 'Run npm run media:sync',
    }],
  };
}

export function getMediaOrigin(manifest) {
  const first = manifest.items[0];
  return first ? new URL(first.src).origin : null;
}
```

Create `src/data/media.json`:

```json
{
  "version": 1,
  "generatedAt": "2026-08-29T17:00:00.000Z",
  "items": []
}
```

- [ ] **Step 4: Run the manifest tests**

Run:

```bash
npm test
```

Expected: six passing tests.

- [ ] **Step 5: Commit the manifest boundary**

Run:

```bash
git add src/lib/media-manifest.mjs src/data/media.json tests/media-manifest.test.mjs
git commit -m "feat: add validated media manifest"
```

---

### Task 3: Build the Atomic Blob Sync Workflow

**Files:**
- Create: `scripts/media-catalog.mjs`
- Create: `scripts/sync-media.mjs`
- Create: `tests/media-catalog.test.mjs`
- Create: `tests/sync-media.test.mjs`

**Interfaces:**
- Consumes: `public/media/video/*`, `public/media/audio/*`, and `BLOB_READ_WRITE_TOKEN`.
- Produces: immutable content-addressed keys `portfolio/{video|audio}/<sha256>-<safe-name>`, uploaded Blob URLs, and an atomically replaced `src/data/media.json`.

- [ ] **Step 1: Write failing discovery tests**

Create `tests/media-catalog.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  assertUniqueObjectKeys,
  discoverMedia,
  safeObjectName,
  toManifestItem,
} from '../scripts/media-catalog.mjs';

test('safeObjectName normalizes punctuation but preserves the extension', () => {
  assert.equal(safeObjectName('3I | ATLAS_14.MP4'), '3i-atlas-14.mp4');
});

test('discoverMedia returns supported files in stable order', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'viaims-media-'));
  await mkdir(path.join(root, 'public/media/video'), { recursive: true });
  await mkdir(path.join(root, 'public/media/audio'), { recursive: true });
  await writeFile(path.join(root, 'public/media/video', 'B.MP4'), 'video');
  await writeFile(path.join(root, 'public/media/video', '.hidden.mp4'), 'hidden');
  await writeFile(path.join(root, 'public/media/audio', 'A_master.WAV'), 'audio');

  const files = await discoverMedia(root);
  assert.deepEqual(files.map((file) => file.objectKey), [
    'portfolio/audio/a-master.wav',
    'portfolio/video/b.mp4',
  ]);
});

test('assertUniqueObjectKeys rejects normalization collisions', () => {
  assert.throws(() => assertUniqueObjectKeys([
    { objectKey: 'portfolio/video/a-b.mp4' },
    { objectKey: 'portfolio/video/a-b.mp4' },
  ]), /duplicate Blob key/);
});

test('toManifestItem preserves the display name and derives media specs', () => {
  const item = toManifestItem({
    kind: 'video',
    filename: '3I | ATLAS_14.MP4',
    objectKey: 'portfolio/video/3i-atlas-14.mp4',
  }, 'https://example.public.blob.vercel-storage.com/portfolio/video/3i-atlas-14.mp4');
  assert.equal(item.title, '3I | ATLAS 14');
  assert.equal(item.engine, 'Sora Pro');
  assert.equal(item.specs, 'MP4 Master');
});
```

- [ ] **Step 2: Run the tests and verify failure**

Run:

```bash
node --test tests/media-catalog.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `scripts/media-catalog.mjs`.

- [ ] **Step 3: Implement deterministic discovery and metadata**

Create `scripts/media-catalog.mjs`:

```js
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const GROUPS = [
  {
    kind: 'audio',
    relativeDirectory: 'public/media/audio',
    extensions: new Set(['.wav', '.mp3', '.m4a', '.flac', '.aac']),
    contentTypes: { '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.flac': 'audio/flac', '.aac': 'audio/aac' },
  },
  {
    kind: 'video',
    relativeDirectory: 'public/media/video',
    extensions: new Set(['.mp4', '.mov', '.webm']),
    contentTypes: { '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm' },
  },
];

export function safeObjectName(filename) {
  const extension = path.extname(filename).toLowerCase();
  const stem = path.basename(filename, path.extname(filename))
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!stem) throw new Error(`filename cannot produce a Blob key: ${filename}`);
  return `${stem}${extension}`;
}

export async function discoverMedia(rootDirectory) {
  const discovered = [];
  for (const group of GROUPS) {
    const absoluteDirectory = path.join(rootDirectory, group.relativeDirectory);
    const entries = await readdir(absoluteDirectory, { withFileTypes: true });
    for (const entry of entries) {
      const extension = path.extname(entry.name).toLowerCase();
      if (!entry.isFile() || entry.name.startsWith('.') || !group.extensions.has(extension)) continue;
      const absolutePath = path.join(absoluteDirectory, entry.name);
      const fileStat = await stat(absolutePath);
      discovered.push({
        kind: group.kind,
        filename: entry.name,
        absolutePath,
        size: fileStat.size,
        contentType: group.contentTypes[extension],
        objectKey: `portfolio/${group.kind}/${safeObjectName(entry.name)}`,
      });
    }
  }
  return discovered.sort((left, right) => left.objectKey.localeCompare(right.objectKey));
}

export function assertUniqueObjectKeys(files) {
  const seen = new Set();
  for (const file of files) {
    if (seen.has(file.objectKey)) throw new Error(`duplicate Blob key: ${file.objectKey}`);
    seen.add(file.objectKey);
  }
}

export function toManifestItem(file, url) {
  const extension = path.extname(file.filename);
  const displayStem = path.basename(file.filename, extension).replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  const idStem = path.basename(file.objectKey, path.extname(file.objectKey));
  const item = {
    id: `${file.kind}-${idStem}`,
    kind: file.kind,
    title: displayStem,
    src: url,
    specs: file.kind === 'video'
      ? `${extension.slice(1).toUpperCase()} Master`
      : `${extension.slice(1).toUpperCase()} • 24-bit / 48kHz Staging`,
  };
  if (file.kind === 'video') item.engine = file.filename.includes('3I') ? 'Sora Pro' : 'AI Render';
  return item;
}
```

- [ ] **Step 4: Run discovery tests**

Run:

```bash
node --test tests/media-catalog.test.mjs
```

Expected: four passing tests.

- [ ] **Step 5: Write failing atomic-sync tests**

Create `tests/sync-media.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { syncMedia } from '../scripts/sync-media.mjs';

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'viaims-sync-'));
  await mkdir(path.join(root, 'public/media/video'), { recursive: true });
  await mkdir(path.join(root, 'public/media/audio'), { recursive: true });
  await mkdir(path.join(root, 'src/data'), { recursive: true });
  await writeFile(path.join(root, 'public/media/video', 'Atlas.MP4'), 'video');
  await writeFile(path.join(root, 'src/data/media.json'), '{"sentinel":true}\n');
  return root;
}

test('syncMedia replaces the manifest only after every upload succeeds', async () => {
  const root = await fixture();
  const manifest = await syncMedia({
    rootDirectory: root,
    token: 'test-token',
    uploader: async (pathname) => ({ url: `https://example.public.blob.vercel-storage.com/${pathname}` }),
    generatedAt: '2026-08-29T17:00:00.000Z',
  });
  const written = JSON.parse(await readFile(path.join(root, 'src/data/media.json'), 'utf8'));
  assert.deepEqual(written, manifest);
  assert.equal(written.items.length, 1);
});

test('syncMedia preserves the old manifest after an upload failure', async () => {
  const root = await fixture();
  await assert.rejects(() => syncMedia({
    rootDirectory: root,
    token: 'test-token',
    uploader: async () => { throw new Error('upload failed'); },
  }), /upload failed/);
  assert.equal(await readFile(path.join(root, 'src/data/media.json'), 'utf8'), '{"sentinel":true}\n');
});
```

- [ ] **Step 6: Run the sync tests and verify failure**

Run:

```bash
node --test tests/sync-media.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `scripts/sync-media.mjs`.

- [ ] **Step 7: Implement atomic multipart-capable sync**

Create `scripts/sync-media.mjs`:

```js
import { put } from '@vercel/blob';
import { createReadStream } from 'node:fs';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  assertUniqueObjectKeys,
  discoverMedia,
  toManifestItem,
} from './media-catalog.mjs';

const MULTIPART_THRESHOLD = 100 * 1024 * 1024;

export async function syncMedia({
  rootDirectory = process.cwd(),
  token = process.env.BLOB_READ_WRITE_TOKEN,
  uploader = put,
  generatedAt = new Date().toISOString(),
} = {}) {
  if (!token) throw new Error('BLOB_READ_WRITE_TOKEN is required');
  const files = await discoverMedia(rootDirectory);
  assertUniqueObjectKeys(files);

  const items = [];
  for (const file of files) {
    const blob = await uploader(file.objectKey, createReadStream(file.absolutePath), {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      multipart: file.size > MULTIPART_THRESHOLD,
      contentType: file.contentType,
      token,
    });
    items.push(toManifestItem(file, blob.url));
  }

  const manifest = { version: 1, generatedAt, items };
  const manifestPath = path.join(rootDirectory, 'src/data/media.json');
  const temporaryPath = `${manifestPath}.tmp`;
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(temporaryPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  await rename(temporaryPath, manifestPath);
  return manifest;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const manifest = await syncMedia();
  console.log(`Uploaded ${manifest.items.length} media files and updated src/data/media.json`);
}
```

- [ ] **Step 8: Run all unit tests and commit**

Run:

```bash
npm test
git add scripts/media-catalog.mjs scripts/sync-media.mjs tests/media-catalog.test.mjs tests/sync-media.test.mjs
git commit -m "feat: add atomic Vercel Blob media sync"
```

Expected: twelve passing tests and a focused sync-workflow commit.

---

### Task 4: Integrate Blob Playlists into the Existing Media Engine

**Files:**
- Modify: `src/components/HybridMediaEngine.astro:1-48`
- Modify: `src/pages/index.astro:1-34`
- Modify: `src/layouts/Layout.astro:1-18`
- Test: `tests/media-manifest.test.mjs`

**Interfaces:**
- Consumes: validated manifest from `src/data/media.json`.
- Produces: unchanged client-side playlist object fields (`id`, `title`, `src`, `specs`, and video `engine`) plus an optional Blob preconnect origin.

- [ ] **Step 1: Add a regression assertion for stable playlist order**

Append to `tests/media-manifest.test.mjs`:

```js
test('toPlaylists preserves manifest order within each media kind', () => {
  const manifest = structuredClone(valid);
  manifest.items.push({
    id: 'video-atlas-2',
    kind: 'video',
    title: '3I | ATLAS 2',
    src: 'https://example.public.blob.vercel-storage.com/video/3i-atlas-2.mp4',
    specs: 'MP4 Master',
    engine: 'Sora Pro',
  });
  assert.deepEqual(toPlaylists(manifest).videoPlaylist.map((item) => item.id), [
    'video-atlas-1',
    'video-atlas-2',
  ]);
});
```

- [ ] **Step 2: Run the regression test**

Run:

```bash
npm test
```

Expected: thirteen passing tests.

- [ ] **Step 3: Replace filesystem scanning with the manifest prop**

Replace the complete frontmatter block in `src/components/HybridMediaEngine.astro` with:

```astro
---
import { toPlaylists } from '../lib/media-manifest.mjs';

const { manifest } = Astro.props;
const { videoPlaylist, audioPlaylist } = toPlaylists(manifest);
---
```

Also add `preload="metadata"` to both `<video>` elements and leave the `<audio preload="metadata">` behavior unchanged. Do not modify the playback, mutual-exclusion, seeking, backdrop synchronization, or auto-advance script.

- [ ] **Step 4: Load and validate the manifest once at the page boundary**

Replace the frontmatter and component calls in `src/pages/index.astro` so the file begins with:

```astro
---
import Layout from '../layouts/Layout.astro';
import HybridMediaEngine from '../components/HybridMediaEngine.astro';
import PublicationsAndCredits from '../components/PublicationsAndCredits.astro';
import mediaData from '../data/media.json';
import { getMediaOrigin, parseMediaManifest } from '../lib/media-manifest.mjs';

const mediaManifest = parseMediaManifest(mediaData);
const mediaOrigin = getMediaOrigin(mediaManifest);
---
```

Inside `<Layout>`, insert this before `<header>`:

```astro
{mediaOrigin && (
  <Fragment slot="head">
    <link rel="preconnect" href={mediaOrigin} crossorigin="anonymous" />
    <link rel="dns-prefetch" href={mediaOrigin} />
  </Fragment>
)}
```

Replace `<HybridMediaEngine />` with:

```astro
<HybridMediaEngine manifest={mediaManifest} />
```

- [ ] **Step 5: Expose the named head slot**

In `src/layouts/Layout.astro`, insert this immediately before `</head>`:

```astro
<slot name="head" />
```

- [ ] **Step 6: Verify tests and a clean static build**

Run:

```bash
npm test
npm run build
```

Expected: thirteen tests pass; Astro builds with the empty tracked manifest and shows explicit standby states.

- [ ] **Step 7: Commit the manifest integration**

Run:

```bash
git add src/components/HybridMediaEngine.astro src/pages/index.astro src/layouts/Layout.astro tests/media-manifest.test.mjs
git commit -m "refactor: load portfolio media from Blob manifest"
```

---

### Task 5: Add Production Configuration and an Operations Runbook

**Files:**
- Modify: `astro.config.mjs`
- Create: `public-deploy/favicon.svg`
- Create: `public-deploy/favicon.ico`
- Create: `vercel.json`
- Create: `docs/operations/viaims-launch-runbook.md`

**Interfaces:**
- Consumes: static Astro output in `dist/`.
- Produces: canonical production URLs, security headers, immutable Astro asset caching, and exact launch/rollback evidence fields.

- [ ] **Step 1: Declare canonical static output**

Update `astro.config.mjs` to:

```js
// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://viaims.com',
  output: 'static',
  publicDir: './public-deploy',
  vite: {
    plugins: [tailwindcss()],
  },
});
```

Create the deploy-only public directory without copying local media:

```bash
mkdir -p public-deploy
cp public/favicon.svg public-deploy/favicon.svg
cp public/favicon.ico public-deploy/favicon.ico
```

- [ ] **Step 2: Add production response headers**

Create `vercel.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" }
      ]
    },
    {
      "source": "/_astro/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    }
  ]
}
```

- [ ] **Step 3: Create the launch runbook**

Create `docs/operations/viaims-launch-runbook.md` with these exact sections and commands:

````markdown
# viaims.com Launch Runbook

## Protected DNS Records

- Preserve the Resend DKIM TXT record beginning at `resend._domainkey.viaims.com`.
- Preserve every record not explicitly named by Vercel's domain-verification screen.
- Record screenshots and values for the apex A record and `www` CNAME before editing.

## Preflight

```bash
npm ci
npm test
npm run build
git status --short --branch
```

All tests and the build must pass. The only expected generated content change after media sync is `src/data/media.json`.

## Media Delivery

Verify one audio URL and one video URL directly from `src/data/media.json`:

```bash
node --input-type=module -e "import { readFile } from 'node:fs/promises'; const manifest = JSON.parse(await readFile('src/data/media.json', 'utf8')); const samples = [manifest.items.find((item) => item.kind === 'audio'), manifest.items.find((item) => item.kind === 'video')]; for (const item of samples) { const response = await fetch(item.src, { headers: { Range: 'bytes=0-1023' } }); console.log(item.id, response.status, response.headers.get('content-range'), response.headers.get('content-type')); if (response.status !== 206 || !response.headers.get('content-range')) process.exitCode = 1; }"
```

Require HTTP `206`, `Content-Range`, the correct `Content-Type`, and no authentication redirect.

## Preview Acceptance

- Desktop widths: 1440 and 1024 CSS pixels.
- Mobile widths: 768, 430, and 390 CSS pixels.
- Validate every cue, play/pause, seek, ±10 seconds, next/previous, auto-advance, timecode, mute state, and mutual audio exclusion.
- Validate portrait and widescreen video without distortion.
- Validate a missing-media response does not break navigation or the publications section.

## Cutover

1. Attach `viaims.com` and `www.viaims.com` in the approved Vercel project.
2. If Vercel reports the domain belongs to another team, stop and have the existing owner release or transfer the association.
3. Apply only the exact DNS values Vercel reports as required.
4. Re-run the DNS and HTTPS verification commands below.

```bash
dig +short viaims.com A
dig +short www.viaims.com CNAME
dig +short viaims.com TXT
curl -I https://viaims.com
curl -I https://www.viaims.com
```

Require valid HTTPS, the approved Vercel deployment, and the preserved Resend TXT value.

## Rollback

1. Reassign the domain to the previous Vercel project if it remains available.
2. Otherwise restore the recorded pre-cutover apex A and `www` CNAME values in Wix.
3. Verify both hostnames and HTTPS externally.
4. Do not delete the new Blob store during rollback.
````

- [ ] **Step 4: Verify config and commit**

Run:

```bash
npm test
npm run build
test ! -d dist/media
git diff --check
git add astro.config.mjs public-deploy/favicon.svg public-deploy/favicon.ico vercel.json docs/operations/viaims-launch-runbook.md
git commit -m "chore: configure viaims production deployment"
```

Expected: tests and build pass, `dist/media` does not exist, and `git diff --check` reports no whitespace errors.

---

### Task 6: Create the User-Owned Vercel Preview and Blob Store

**Files:**
- Modify after successful upload: `src/data/media.json`
- Never commit: `.env.local`

**Interfaces:**
- Consumes: Justin's Vercel Pro account, the GitHub repository, and a project-scoped Blob read-write token.
- Produces: a Vercel project owned by Justin, a public Blob store, and a preview URL that does not affect `viaims.com`.

- [ ] **Step 1: Confirm the account and purchase boundary in the Vercel UI**

In Vercel, confirm the displayed owner is Justin's account and select Pro with one developer seat. The user must personally review and complete any subscription purchase or terms acceptance. Do not add Keith as a paid seat.

Expected: the team/project owner is Justin and billing shows one developer seat.

- [ ] **Step 2: Import the GitHub repository without attaching the production domain**

Use Vercel **Add New → Project → Import Git Repository**, select `justinscottdixon-VIAIMS/ai-systems-portfolio`, framework preset **Astro**, build command `npm run build`, and output directory `dist`.

Expected: a preview deployment is created on a `vercel.app` URL; `viaims.com` remains on the old deployment.

- [ ] **Step 3: Create and connect a public Blob store**

In the project, use **Storage → Create Database → Blob**, choose public access, and connect it to this project. Confirm that Vercel creates `BLOB_READ_WRITE_TOKEN` for the project.

Because this creates persistent credentials, pause for user confirmation immediately before connecting or downloading the token.

- [ ] **Step 4: Link the local checkout and pull project environment values**

Run:

```bash
npx vercel link
npx vercel env pull .env.local
```

Expected: the checkout links to Justin's project and `.env.local` contains `BLOB_READ_WRITE_TOKEN`; no secret appears in terminal output or Git status.

- [ ] **Step 5: Upload all local media and atomically generate the real manifest**

Run:

```bash
npm run media:sync
npm test
npm run build
git diff -- src/data/media.json
```

Expected: seventeen media items are written (15 video and 2 audio), all tests pass, the build succeeds without copying local media into the deployable source, and every manifest URL uses HTTPS.

- [ ] **Step 6: Commit and push the manifest-backed launch branch**

Run:

```bash
git add src/data/media.json
git commit -m "content: publish portfolio media manifest"
git push -u origin codex/viaims-launch
```

Expected: GitHub contains no media binaries or tokens; Vercel generates a new preview deployment from the pushed branch.

---

### Task 7: Verify the Preview End to End

**Files:**
- Modify only if a verified defect requires it: files named by the failing test or browser evidence.
- Record evidence in: `docs/operations/viaims-launch-runbook.md`

**Interfaces:**
- Consumes: the Vercel preview URL and Blob URLs.
- Produces: recorded pass/fail evidence and a release candidate commit.

- [ ] **Step 1: Verify build and HTTP behavior**

Run the runbook preflight and media range commands. Record the preview URL, command timestamps, test count, build result, sampled audio/video URLs, HTTP status, `Content-Range`, and `Content-Type` under a new `## Launch Evidence` section in the runbook.

Expected: tests pass, build passes, and range requests return `206`.

- [ ] **Step 2: Perform responsive browser validation**

Open the preview in Chrome and execute every Preview Acceptance item from the runbook at 1440, 1024, 768, 430, and 390 CSS pixels.

Expected: no horizontal overflow; the three modules stack at small widths; controls remain tappable; portrait and widescreen videos remain undistorted.

- [ ] **Step 3: Exercise playback behavior**

For every video and audio cue, validate load, timecode, scrub, ±10-second nudge, next/previous, and auto-advance. Confirm that enabling video audio pauses the DSP master and starting a DSP master mutes video audio.

Expected: all controls match the current local behavior and browser console contains no uncaught errors.

- [ ] **Step 4: Fix only evidenced defects using red-green-refactor**

For each defect, first add the smallest reproducing test to the relevant `tests/*.test.mjs`, run it to observe failure, implement the minimal fix, then run `npm test && npm run build`.

Expected: every fix has a regression test or, for purely visual defects, a recorded before/after viewport screenshot and a focused CSS change.

- [ ] **Step 5: Commit launch evidence and final preview fixes**

Run:

```bash
git add docs/operations/viaims-launch-runbook.md src tests
git commit -m "test: verify viaims deployment preview"
git push
```

Expected: the final branch preview passes all acceptance checks.

---

### Task 8: Merge, Cut Over the Domain, and Verify Rollback

**Files:**
- No source changes expected.
- Update evidence: `docs/operations/viaims-launch-runbook.md`

**Interfaces:**
- Consumes: approved preview, recorded Wix DNS values, and access to the old Vercel domain assignment.
- Produces: `viaims.com` and `www.viaims.com` on the new production deployment with a tested rollback path.

- [ ] **Step 1: Review and merge the launch branch**

Open a GitHub pull request from `codex/viaims-launch` to `main`, verify the diff contains no binaries or secrets, require the Vercel preview to pass, and merge.

Expected: Vercel creates a production deployment from `main` while the custom domain remains unchanged.

- [ ] **Step 2: Record the live pre-cutover state**

Run:

```bash
dig +short viaims.com A
dig +short www.viaims.com CNAME
dig +short viaims.com TXT
curl -I https://viaims.com
curl -I https://www.viaims.com
```

Record results and screenshots of the Wix A, CNAME, and Resend TXT records in the runbook before any edit.

- [ ] **Step 3: Attach both domains in Vercel**

In the new project, add `viaims.com` and `www.viaims.com`. If Vercel reports that either domain belongs to another project/team, stop; Keith or the current owner must release or transfer the domain association. Do not attempt to bypass ownership verification.

Expected: Vercel shows the exact required DNS values for both hostnames.

- [ ] **Step 4: Apply the minimum Wix DNS change with action-time confirmation**

Immediately before clicking **Save** in Wix, show the user the current value, Vercel-required value, affected hostname, and rollback value. After confirmation, change only the records Vercel marks invalid. Preserve `resend._domainkey.viaims.com` and every unrelated record.

Expected: Wix saves the required apex/`www` values; nameservers remain `ns14.wixdns.net` and `ns15.wixdns.net`.

- [ ] **Step 5: Verify DNS, TLS, production content, and media**

Run the runbook cutover commands from an external network and repeat one audio and one large-video range request.

Expected: both hostnames use valid HTTPS, serve the approved Astro portfolio, preserve Resend TXT, and return `206` for media ranges.

- [ ] **Step 6: Exercise rollback readiness without disrupting production**

Confirm the old Vercel project/deployment remains accessible and that the recorded pre-cutover DNS values are complete. Do not actually roll back a healthy launch.

- [ ] **Step 7: Record final evidence and commit**

Append the production deployment URL, DNS verification timestamp, final A/CNAME/TXT values, TLS result, media range results, and rollback target to the runbook, then run:

```bash
git add docs/operations/viaims-launch-runbook.md
git commit -m "docs: record viaims production launch"
git push origin main
```

Expected: the repository contains an auditable production launch record and no secrets.

---

### Task 9: Exit the Wix Registrar After the Transfer Lock

**Files:**
- Update: `docs/operations/viaims-launch-runbook.md`

**Interfaces:**
- Consumes: a stable production site and transfer eligibility on or after September 24, 2026.
- Produces: a separately approved registrar transfer without changing the live hosting architecture.

- [ ] **Step 1: Re-verify transfer eligibility on or after September 24, 2026**

Check the public RDAP record and Wix domain panel. Require the initial 60-day period to have ended and confirm no registrant-contact change created a later lock.

- [ ] **Step 2: Select the destination registrar as a separate decision**

Compare current renewal price, DNSSEC, WHOIS privacy, support, and transfer-in policy using official sources. Obtain explicit user approval of the registrar and transfer cost before starting.

- [ ] **Step 3: Pre-stage authoritative DNS at the destination**

Recreate the verified apex, `www`, Resend DKIM, and any later-added records before changing nameservers. Validate the complete record inventory twice.

- [ ] **Step 4: Unlock and transfer with user-held authorization**

The user retrieves the EPP authorization code from Wix and enters it at the approved registrar. Do not expose the EPP code in chat, logs, Git, or the runbook.

- [ ] **Step 5: Verify the transfer without changing the working site**

After completion, verify registrar, nameservers, DNS, TLS, production content, and Resend TXT. Record only non-secret evidence in the runbook.
