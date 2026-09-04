# Sidecar Media Ingestion Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a local, media-independent Cinema/Music/Media ingestion tree and validate optional sidecar playlist order without uploading or publishing anything.

**Architecture:** A pure ordering module validates `playlist-order.json` and resolves listed-plus-natural fallback filenames. A local discovery module maps three independent provider folders to ordered candidate records; the existing Vercel Blob synchronization path remains unchanged until controlled publication is separately approved.

**Tech Stack:** Node 22 ESM, `node:fs/promises`, Node test runner, JSON sidecars.

## Global Constraints

- Root tree: `media-ingest/Cinema`, `media-ingest/Music`, and `media-ingest/Media`.
- No real media, network access, Blob calls, manifest replacement, upload, synchronization, or publication.
- Preserve the existing `media:sync` behavior and production manifest.
- Do not commit, stage, push, merge, deploy, or change hosting/DNS.
- Use strict RED/GREEN order.

---

### Task 1: Sidecar order resolver

**Files:**
- Create: `src/lib/playlist-order.mjs`
- Create: `tests/playlist-order.test.mjs`

**Interfaces:**
- Produces: `resolvePlaylistOrder({ provider, filenames, orderEntries, supportedExtensions }) -> string[]`.

- [ ] **Step 1: Write failing tests**

Cover exact listed order, natural unlisted fallback, absent/empty sidecars, insertion without renaming, duplicate entries, missing files, path traversal, absolute paths, unsupported extensions, and case-sensitive matching.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/playlist-order.test.mjs`

Expected: FAIL with missing module.

- [ ] **Step 3: Implement strict resolution**

Validate entries before sorting. Throw errors that name the provider and offending entry. Use `Intl.Collator('en', { numeric:true, sensitivity:'base' })` only for unlisted fallback files.

- [ ] **Step 4: Verify GREEN**

Run: `node --test tests/playlist-order.test.mjs`

Expected: all sidecar-order tests pass.

### Task 2: Local provider-tree discovery

**Files:**
- Create: `scripts/ingestion-catalog.mjs`
- Create: `tests/ingestion-catalog.test.mjs`
- Create: `media-ingest/README.md`
- Create: `media-ingest/Cinema/.gitkeep`
- Create: `media-ingest/Music/.gitkeep`
- Create: `media-ingest/Media/.gitkeep`

**Interfaces:**
- Consumes: `resolvePlaylistOrder(...)` from Task 1.
- Produces: `discoverIngestionCandidates({ rootDirectory }) -> Promise<{ cinema: Candidate[], music: Candidate[], media: Candidate[] }>` where each candidate contains `provider`, `filename`, `absolutePath`, and zero-based `playlistOrder`.

- [ ] **Step 1: Write failing discovery tests**

Use temporary provider trees to prove independent sequences, optional sidecars, ignored hidden/non-media files, provider-specific extensions, exact error paths, and no file writes.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/ingestion-catalog.test.mjs`

Expected: FAIL with missing module.

- [ ] **Step 3: Implement read-only discovery**

Read `media-ingest/<Provider>` by default, or an explicitly supplied root for future linked-folder use. Parse optional sidecars, resolve order, and return candidate metadata. Never call `syncMedia`, Vercel Blob, or write `src/data/media.json`.

- [ ] **Step 4: Add the empty tree and operator README**

Document folder purpose, sidecar format, validation-only status, and the separate approval required before upload/publication. Keep only `.gitkeep` files in provider folders.

- [ ] **Step 5: Verify GREEN**

Run: `node --test tests/playlist-order.test.mjs tests/ingestion-catalog.test.mjs`

Expected: all ingestion-foundation tests pass.

### Task 3: Verification and readiness checklist

**Files:**
- Create: `docs/product/portfolio-completion-checklist.md`

- [ ] **Step 1: Write the evidence-based checklist**

Record completed shadow work, the two local revisions, ingestion readiness, replacement-media blocker, Bio/Accomplishments/Contact/Bookings copy/design blockers, production-meter sequence gate, commerce/mobile-ingestion deferrals, and all prohibited remote/production actions.

- [ ] **Step 2: Run full verification**

Run: `npm test`, `npm run build`, and `git diff --check`.

- [ ] **Step 3: Review generated scope**

Confirm no real media files, tokens, remote URLs, Blob calls, generated production-manifest edits, or publication actions were added.

