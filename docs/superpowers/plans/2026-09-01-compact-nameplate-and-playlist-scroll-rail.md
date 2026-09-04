# Compact Nameplate and Playlist Scroll Rail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce the opening desktop footprint to 120px or less at the 938px reference width and make only a dedicated playlist rail consume desktop wheel input.

**Architecture:** Replace utility-only masthead layout with named global classes, and add one browser-neutral scroll-target helper used by accessible rails beside each populated playlist. Fine-pointer CSS disables wheel scrolling on item viewports; coarse-pointer CSS keeps direct touch scrolling.

**Tech Stack:** Astro 7, browser DOM APIs, CSS pointer/hover media queries, Node test runner.

## Global Constraints

- Preserve every approved identity phrase and all existing dirty implementation.
- Keep media sources, playback state, Mirror Wings policy, commerce, ingestion, meters, production, hosting, and DNS unchanged.
- Do not commit, stage, push, merge, deploy, publish, or create remote access.
- Use strict RED/GREEN order.

---

### Task 1: Compact institutional nameplate

**Files:**
- Modify: `tests/index-page.test.mjs`
- Modify: `src/pages/index.astro`
- Modify: `src/layouts/Layout.astro`
- Modify: `src/styles/global.css`

**Interfaces:**
- Produces: `[data-institutional-header]`, `.institutional-status`, `.institutional-nameplate`, and `.institutional-roles` layout hooks.

- [ ] **Step 1: Write the failing structure test**

Add a test that requires the four named hooks, a home-page compact-main opt-in, the eight approved identity phrases, and removal of the old `mt-6`, `space-y-1.5`, `mb-10`, and desktop `md:py-24` spacing contract.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/index-page.test.mjs`

Expected: FAIL because the compact hooks and layout opt-in do not exist.

- [ ] **Step 3: Implement the compact layout**

Give `Layout.astro` a boolean `compactMain` prop and select `main--compact` only for the portfolio index. In `index.astro`, group status, name/institution, and roles under the named hooks while retaining exact copy order. In `global.css`, define desktop grid rows and spacing whose top-of-document-to-next-section total is at most 120px at 938px, with natural mobile wrapping and no text clipping.

- [ ] **Step 4: Verify GREEN**

Run: `node --test tests/index-page.test.mjs`

Expected: all index-page tests pass.

### Task 2: Browser-neutral playlist scroll targeting

**Files:**
- Create: `src/lib/playlist-scroll.mjs`
- Create: `tests/playlist-scroll.test.mjs`

**Interfaces:**
- Produces: `playlistScrollTarget({ key, scrollTop, rowHeight, viewportHeight, scrollHeight }) -> number | null`.

- [ ] **Step 1: Write failing pure tests**

Cover Arrow Up/Down by one row, Page Up/Down by one viewport, Home/End, boundary clamping, and unsupported keys returning `null`.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/playlist-scroll.test.mjs`

Expected: FAIL with missing module.

- [ ] **Step 3: Implement the minimal helper**

Implement a total, browser-neutral function that computes and clamps the requested `scrollTop` without mutating DOM state.

- [ ] **Step 4: Verify GREEN**

Run: `node --test tests/playlist-scroll.test.mjs`

Expected: all playlist-scroll tests pass.

### Task 3: Accessible provider rails

**Files:**
- Modify: `tests/hybrid-media-engine.test.mjs`
- Modify: `src/components/HybridMediaEngine.astro`
- Modify: `src/styles/hybrid-media-engine.css`

**Interfaces:**
- Consumes: `playlistScrollTarget(...)` from Task 2.
- Produces: `.media-library__scroll-shell`, `[data-playlist-scroll-rail]`, and `[data-playlist-scroll-thumb]` for every populated provider list.

- [ ] **Step 1: Write failing markup and controller tests**

Require an adjacent rail for Cinema, Music, populated Media, and populated YouTube; `role="scrollbar"`; `aria-controls`; wheel handling only on rails; keyboard use of `playlistScrollTarget`; inactive-rail disabling; and fine-pointer/coarse-pointer CSS behavior.

- [ ] **Step 2: Verify RED**

Run: `node --test --test-name-pattern="scroll rail|playlist wheel|fine-pointer" tests/hybrid-media-engine.test.mjs`

Expected: FAIL because rail markup and behavior are absent.

- [ ] **Step 3: Implement rail markup and bindings**

Wrap each populated `.media-library__items` beside a focusable rail. Bind wheel and keydown only to the rail, update `aria-valuenow`, `aria-valuemax`, disabled/focus state, and thumb geometry on scroll/resize/tab activation. Do not bind or cancel wheel events on rows.

- [ ] **Step 4: Implement modality CSS**

Keep `.media-library__items { overflow-y:auto; overscroll-behavior:auto; }` by default. Under `(hover:hover) and (pointer:fine)`, hide item overflow, show the adjacent rail, and style its hover/focus/disabled states. Under coarse pointers, hide the rail and preserve direct touch scrolling.

- [ ] **Step 5: Verify GREEN**

Run: `node --test tests/playlist-scroll.test.mjs tests/hybrid-media-engine.test.mjs tests/index-page.test.mjs`

Expected: all focused tests pass.

### Task 4: Verification and local approval artifact

**Files:**
- Modify: `.superpowers/sdd/task-9-report.md` only if already present and ignored.

- [ ] **Step 1: Run full verification**

Run: `npm test`, `npm run build`, and `git diff --check`.

- [ ] **Step 2: Open the fresh production preview in native Chrome**

Verify the 938px desktop identity footprint, row-wheel page scrolling, rail-wheel playlist scrolling, keyboard controls, and coarse-pointer layout. Record measurements and defects without publishing or creating a tunnel.

- [ ] **Step 3: Stop for local visual approval**

Leave the local preview available; do not commit or advance to the remote mobile gate.

