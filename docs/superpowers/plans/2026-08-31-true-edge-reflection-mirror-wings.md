# VIAIMS True Edge-Reflection Mirror Wings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace full-frame decorative wing copies with provider-aware true edge reflections that keep recognizable subjects in the center master and apply to portrait and square Cinema and Music Video playback.

**Architecture:** Add one pure mirror-wing policy/geometry module, then let the existing shared stage store the active native provider and resolved wing state in `data-*` attributes. Preserve that state in Cinema snapshots, reuse the existing two follower videos, and implement the edge sampling through CSS positioning and reflection rather than adding playback elements or audio paths.

**Tech Stack:** Astro, browser-native HTML media elements, ECMAScript modules, CSS, Node.js `node:test`, static Astro build, local Safari and Chromium review.

## Global Constraints

- Reuse the existing shadow worktree at `/Users/jsdmbp/Documents/ChatGPT/VIAIMS web agent Portfolio/site/.worktrees/adaptive-media-shadow`; do not create another worktree.
- Execute every behavior change with strict RED/GREEN test-first evidence.
- The center master is the only intentionally clear and recognizable presentation of a person or character.
- Sample the outermost 28 percent of each source edge initially; tune only during the local visual gate and keep both sides symmetrical.
- Cinema and Music Video enable Mirror Wings; Media and the VIAIMS welcome video keep the capability disabled but available; YouTube is not applicable.
- Provider switches are internal code configuration and never visitor-facing controls.
- Portrait and square sources may show enabled wings; landscape and unknown sources suppress them.
- Mobile widths at or below 767 CSS pixels and reduced-motion preference suppress wings.
- Reuse the two existing muted, `aria-hidden`, non-interactive follower videos; add no media or audio path.
- Mirror failures remain isolated from the authoritative master and hide both decorative wings for visual balance.
- Do not fabricate or permanently configure welcome, Music Video, Media, or individual YouTube fixtures.
- Do not commit implementation until Justin approves the completed local visual gate.
- Do not begin Task 10 remote phone/fidelity review, sync or publish ATLAS 14, ingest other media, push, merge, deploy, modify production, or alter hosting/DNS without separate explicit approval.

---

## File structure

- Create `src/lib/mirror-wings.mjs`: pure provider policy, aspect/constraint resolution, and centered-stage wing geometry.
- Create `tests/mirror-wings.test.mjs`: executable policy and geometry coverage.
- Modify `src/lib/media-presentation.mjs`: preserve stage provider and resolved wing state in snapshots.
- Modify `tests/media-presentation.test.mjs`: prove snapshot preservation and failure isolation.
- Modify `src/components/HybridMediaEngine.astro`: identify each native stage provider, resolve policy after metadata, calculate wing width, and preserve existing playback semantics.
- Modify `tests/hybrid-media-engine.test.mjs`: enforce stage integration, Music Video policy, source transitions, and truthful failure behavior.
- Modify `src/styles/hybrid-media-engine.css`: crop the edge samples, reflect both sides outward, hide seams under the master, and reverse the vignette toward the outer stage edges.

### Task 1: Pure Mirror-Wing Policy and Geometry

**Files:**
- Create: `src/lib/mirror-wings.mjs`
- Create: `tests/mirror-wings.test.mjs`

**Interfaces:**
- Produces: `MIRROR_WING_PROVIDER_POLICY: Readonly<Record<string, boolean>>`
- Produces: `MIRROR_WING_EDGE_SAMPLE_FRACTION: number`
- Produces: `normalizeStageProvider(provider: string, mode?: string): string`
- Produces: `resolveMirrorWingPresentation(options): { enabled: boolean, provider: string, aspect: string, edgeSampleFraction: number, edgeScale: number }`
- Produces: `calculateMirrorWingGeometry(stageWidth: number, masterWidth: number, overlap?: number): { wingInlineSize: number, overlap: number }`

- [ ] **Step 1: Write failing provider-policy tests**

Create `tests/mirror-wings.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MIRROR_WING_EDGE_SAMPLE_FRACTION,
  MIRROR_WING_PROVIDER_POLICY,
  calculateMirrorWingGeometry,
  normalizeStageProvider,
  resolveMirrorWingPresentation,
} from '../src/lib/mirror-wings.mjs';

test('provider policy enables only Cinema and Music Video by default', () => {
  assert.deepEqual(MIRROR_WING_PROVIDER_POLICY, {
    cinema: true,
    'music-video': true,
    media: false,
    welcome: false,
    youtube: false,
  });
  assert.equal(normalizeStageProvider('music', 'video'), 'music-video');
  assert.equal(normalizeStageProvider('music', 'audio'), 'unknown');
  assert.equal(normalizeStageProvider('cinema'), 'cinema');
  assert.equal(normalizeStageProvider('media'), 'media');
  assert.equal(normalizeStageProvider('youtube'), 'youtube');
});

test('presentation requires provider, aspect, viewport, and motion eligibility', () => {
  assert.equal(resolveMirrorWingPresentation({ provider: 'cinema', aspect: 'portrait' }).enabled, true);
  assert.equal(resolveMirrorWingPresentation({ provider: 'music-video', aspect: 'square' }).enabled, true);
  assert.equal(resolveMirrorWingPresentation({ provider: 'media', aspect: 'portrait' }).enabled, false);
  assert.equal(resolveMirrorWingPresentation({ provider: 'welcome', aspect: 'portrait' }).enabled, false);
  assert.equal(resolveMirrorWingPresentation({ provider: 'cinema', aspect: 'landscape' }).enabled, false);
  assert.equal(resolveMirrorWingPresentation({ provider: 'cinema', aspect: 'unknown' }).enabled, false);
  assert.equal(resolveMirrorWingPresentation({ provider: 'cinema', aspect: 'portrait', isMobile: true }).enabled, false);
  assert.equal(resolveMirrorWingPresentation({ provider: 'cinema', aspect: 'portrait', prefersReducedMotion: true }).enabled, false);
});

test('edge sampling is symmetric and exposes a stable CSS scale', () => {
  const presentation = resolveMirrorWingPresentation({ provider: 'cinema', aspect: 'portrait' });
  assert.equal(MIRROR_WING_EDGE_SAMPLE_FRACTION, 0.28);
  assert.equal(presentation.edgeSampleFraction, 0.28);
  assert.equal(presentation.edgeScale, 1 / 0.28);
});

test('geometry fills each unused side and hides the seam under the master', () => {
  assert.deepEqual(calculateMirrorWingGeometry(1440, 420, 8), {
    wingInlineSize: 518,
    overlap: 8,
  });
  assert.deepEqual(calculateMirrorWingGeometry(390, 390, 8), {
    wingInlineSize: 0,
    overlap: 0,
  });
  assert.deepEqual(calculateMirrorWingGeometry(Number.NaN, 420, 8), {
    wingInlineSize: 0,
    overlap: 0,
  });
});
```

- [ ] **Step 2: Run the test to verify RED**

Run:

```sh
node --test tests/mirror-wings.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/lib/mirror-wings.mjs`.

- [ ] **Step 3: Implement the pure policy module**

Create `src/lib/mirror-wings.mjs`:

```js
export const MIRROR_WING_PROVIDER_POLICY = Object.freeze({
  cinema: true,
  'music-video': true,
  media: false,
  welcome: false,
  youtube: false,
});

export const MIRROR_WING_EDGE_SAMPLE_FRACTION = 0.28;

const NATIVE_PROVIDERS = new Set(['cinema', 'media', 'welcome', 'youtube']);

export function normalizeStageProvider(provider, mode = 'video') {
  if (provider === 'music') return mode === 'video' ? 'music-video' : 'unknown';
  return NATIVE_PROVIDERS.has(provider) ? provider : 'unknown';
}

export function resolveMirrorWingPresentation({
  provider = 'unknown',
  aspect = 'unknown',
  isMobile = false,
  prefersReducedMotion = false,
  providerPolicy = MIRROR_WING_PROVIDER_POLICY,
} = {}) {
  const aspectEligible = aspect === 'portrait' || aspect === 'square';
  const enabled = Boolean(providerPolicy[provider])
    && aspectEligible
    && !isMobile
    && !prefersReducedMotion;
  return {
    enabled,
    provider,
    aspect,
    edgeSampleFraction: MIRROR_WING_EDGE_SAMPLE_FRACTION,
    edgeScale: 1 / MIRROR_WING_EDGE_SAMPLE_FRACTION,
  };
}

export function calculateMirrorWingGeometry(stageWidth, masterWidth, requestedOverlap = 8) {
  if (![stageWidth, masterWidth, requestedOverlap].every(Number.isFinite)
    || stageWidth <= 0
    || masterWidth <= 0
    || requestedOverlap < 0) {
    return { wingInlineSize: 0, overlap: 0 };
  }
  const unusedSide = Math.max(0, (stageWidth - masterWidth) / 2);
  if (unusedSide === 0) return { wingInlineSize: 0, overlap: 0 };
  const overlap = Math.min(requestedOverlap, unusedSide);
  return { wingInlineSize: unusedSide + overlap, overlap };
}
```

- [ ] **Step 4: Run the test to verify GREEN**

Run:

```sh
node --test tests/mirror-wings.test.mjs
```

Expected: 4 tests pass, 0 fail.

- [ ] **Step 5: Run the existing presentation tests**

Run:

```sh
node --test tests/media-presentation.test.mjs
```

Expected: all existing tests pass. Do not commit; record the RED/GREEN evidence in `.superpowers/sdd/progress.md` because implementation commits remain approval-gated.

### Task 2: Preserve Provider and Mirror State Across Stage Leases

**Files:**
- Modify: `src/lib/media-presentation.mjs`
- Modify: `tests/media-presentation.test.mjs`

**Interfaces:**
- Consumes: `stage.dataset.stageProvider` and `stage.dataset.mirrorWings`
- Produces: snapshot fields `stageProvider: string` and `mirrorWings: string`
- Preserves: `restoreCinemaSnapshot(video, stage, snapshot, followers, options): Promise<void>`

- [ ] **Step 1: Add failing snapshot assertions**

Extend the existing capture/restore test in `tests/media-presentation.test.mjs` so the stage begins with:

```js
const stage = {
  dataset: {
    mediaAspect: 'portrait',
    stageProvider: 'cinema',
    mirrorWings: 'on',
  },
};
```

Add these assertions after capture, mutate the values before restore, and assert restoration:

```js
assert.equal(snapshot.stageProvider, 'cinema');
assert.equal(snapshot.mirrorWings, 'on');
stage.dataset.stageProvider = 'music-video';
stage.dataset.mirrorWings = 'off';
await restoreCinemaSnapshot(video, stage, snapshot, followers);
assert.equal(stage.dataset.stageProvider, 'cinema');
assert.equal(stage.dataset.mirrorWings, 'on');
```

Update any complete snapshot literal in this test file to include:

```js
stageProvider: 'cinema',
mirrorWings: 'on',
```

- [ ] **Step 2: Run the focused snapshot test to verify RED**

Run:

```sh
node --test --test-name-pattern="preserve exact stage state" tests/media-presentation.test.mjs
```

Expected: FAIL because the snapshot lacks `stageProvider` and `mirrorWings`.

- [ ] **Step 3: Expand snapshot capture and restoration**

Replace the compact return in `captureCinemaSnapshot()` with:

```js
return {
  id,
  src: video.currentSrc || video.src,
  currentTime: video.currentTime,
  paused: video.paused,
  muted: video.muted,
  aspect: stage.dataset.mediaAspect,
  stageProvider: stage.dataset.stageProvider,
  mirrorWings: stage.dataset.mirrorWings,
  hasMirrorFailure: Object.hasOwn(stage.dataset, 'mirrorFailure'),
  mirrorFailure: stage.dataset.mirrorFailure,
  followers: followers.map(captureFollowerSnapshot),
};
```

In `restoreCinemaSnapshot()`, immediately after restoring `mediaAspect`, add:

```js
stage.dataset.stageProvider = snapshot.stageProvider ?? 'cinema';
stage.dataset.mirrorWings = snapshot.mirrorWings ?? 'off';
```

- [ ] **Step 4: Run snapshot and failure tests to verify GREEN**

Run:

```sh
node --test tests/media-presentation.test.mjs
```

Expected: every presentation test passes, including the existing rule that one follower failure clears both follower sources and sets `data-mirror-failure`.

- [ ] **Step 5: Run the playback-session lease tests**

Run:

```sh
node --test tests/playback-session.test.mjs
```

Expected: all lease tests pass. Do not commit; append the task checkpoint to `.superpowers/sdd/progress.md`.

### Task 3: Integrate Provider Policy with the Shared Stage

**Files:**
- Modify: `src/components/HybridMediaEngine.astro`
- Modify: `tests/hybrid-media-engine.test.mjs`

**Interfaces:**
- Consumes: `normalizeStageProvider()`, `resolveMirrorWingPresentation()`, and `calculateMirrorWingGeometry()` from `src/lib/mirror-wings.mjs`
- Produces: stage attributes `data-stage-provider`, `data-mirror-wings`, `--mirror-wing-inline-size`, and `--mirror-edge-scale`
- Preserves: existing `activateNativeLease()`, `switchVideo()`, `restoreLeasedCinema()`, and follower synchronization behavior

- [ ] **Step 1: Write failing component-contract tests**

Add a test to `tests/hybrid-media-engine.test.mjs`:

```js
test('shared stage resolves internal Mirror Wings policy for each native provider', async () => {
  const component = await source(componentPath);
  assert.match(component, /data-stage-provider=\{library\.experience\.enabled \? 'welcome' : 'cinema'\}/);
  assert.match(component, /data-mirror-wings="off"/);
  assert.match(component, /from '\.\.\/lib\/mirror-wings\.mjs'/);
  assert.match(component, /normalizeStageProvider\(provider, 'video'\)/);
  assert.match(component, /resolveMirrorWingPresentation\(\{/);
  assert.match(component, /provider: stage\.dataset\.stageProvider/);
  assert.match(component, /stage\.dataset\.mirrorWings = presentation\.enabled \? 'on' : 'off'/);
  assert.match(component, /stage\.style\.setProperty\('--mirror-wing-inline-size'/);
  assert.match(component, /stage\.style\.setProperty\('--mirror-edge-scale'/);
});

test('Cinema and Music Video update provider identity before requesting a source', async () => {
  const component = await source(componentPath);
  const switchStart = component.indexOf('async function switchVideo(');
  const switchEnd = component.indexOf('\n\tfunction currentCinema', switchStart);
  assert.match(component.slice(switchStart, switchEnd), /setStageProvider\('cinema'\)[\s\S]+mv\.src = currentCinema\(\)\.src/s);
  const leaseStart = component.indexOf('async function activateNativeLease(');
  const leaseEnd = component.indexOf('\n\tasync function activateCinema', leaseStart);
  assert.match(component.slice(leaseStart, leaseEnd), /setStageProvider\(normalizeStageProvider\(provider, 'video'\)\)[\s\S]+mv\.src = src/s);
});

test('active Mirror Wings follow resolved policy instead of aspect alone', async () => {
  const component = await source(componentPath);
  const start = component.indexOf('function activeMirrorWings()');
  const end = component.indexOf('\n\tasync function playVideoStack', start);
  assert.match(component.slice(start, end), /stage\.dataset\.mirrorWings === 'on'/);
  assert.doesNotMatch(component.slice(start, end), /usesMirrorWings/);
});
```

- [ ] **Step 2: Run the three new tests to verify RED**

Run:

```sh
node --test --test-name-pattern="Mirror Wings policy|provider identity|resolved policy" tests/hybrid-media-engine.test.mjs
```

Expected: 3 tests fail because the new provider-aware integration is absent.

- [ ] **Step 3: Add stage attributes and imports**

Change the stage opening tag to:

```astro
<div
  id="master-stage-container"
  class="media-stage"
  data-media-aspect="unknown"
  data-stage-provider={library.experience.enabled ? 'welcome' : 'cinema'}
  data-mirror-wings="off"
>
```

Add this script import:

```js
import {
  calculateMirrorWingGeometry,
  normalizeStageProvider,
  resolveMirrorWingPresentation,
} from '../lib/mirror-wings.mjs';
```

Remove `usesMirrorWings` from the `media-presentation.mjs` component import after all component callers use the resolved stage state.

- [ ] **Step 4: Add provider and geometry helpers**

Immediately before `hideMirrorWings()`, add:

```js
function setStageProvider(provider) {
  stage.dataset.stageProvider = provider;
  stage.dataset.mediaAspect = 'unknown';
  stage.dataset.mirrorWings = 'off';
}

function applyMirrorWingGeometry(edgeScale) {
  const stageWidth = stage.getBoundingClientRect().width;
  const masterWidth = mv.getBoundingClientRect().width;
  const geometry = calculateMirrorWingGeometry(stageWidth, masterWidth, 8);
  stage.style.setProperty('--mirror-wing-inline-size', `${geometry.wingInlineSize}px`);
  stage.style.setProperty('--mirror-edge-scale', String(edgeScale));
}
```

Replace `applyMediaAspect()` with:

```js
function applyMediaAspect() {
  const aspect = classifyMediaAspect(mv.videoWidth, mv.videoHeight);
  const presentation = resolveMirrorWingPresentation({
    provider: stage.dataset.stageProvider,
    aspect,
    isMobile: matchMedia('(max-width: 767px)').matches,
    prefersReducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
  });
  stage.dataset.mediaAspect = aspect;
  stage.dataset.mirrorWings = presentation.enabled ? 'on' : 'off';
  delete stage.dataset.mirrorFailure;
  if (presentation.enabled) {
    applyMirrorWingGeometry(presentation.edgeScale);
    void activateMirrorWings();
  } else hideMirrorWings();
}
```

Replace `activeMirrorWings()` with:

```js
function activeMirrorWings() {
  return stage.dataset.mirrorWings === 'on'
    ? wings.filter((wing) => Boolean(wing.currentSrc || wing.src))
    : [];
}
```

- [ ] **Step 5: Mark source transitions before assigning `mv.src`**

In `switchVideo()`, before `hideMirrorWings()`, add:

```js
setStageProvider('cinema');
```

In `activateNativeLease()`, before `hideMirrorWings()`, add:

```js
setStageProvider(normalizeStageProvider(provider, 'video'));
```

Do not add a stage-provider change for audio-only Music or YouTube row selection.

- [ ] **Step 6: Recalculate geometry on responsive resize**

After the media event listeners are installed, add:

```js
const stageResizeObserver = new ResizeObserver(() => {
  if (stage.dataset.mirrorWings !== 'on') return;
  const presentation = resolveMirrorWingPresentation({
    provider: stage.dataset.stageProvider,
    aspect: stage.dataset.mediaAspect,
    isMobile: matchMedia('(max-width: 767px)').matches,
    prefersReducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
  });
  if (!presentation.enabled) {
    stage.dataset.mirrorWings = 'off';
    hideMirrorWings();
    return;
  }
  applyMirrorWingGeometry(presentation.edgeScale);
});
stageResizeObserver.observe(stage);
```

- [ ] **Step 7: Run the component tests to verify GREEN**

Run:

```sh
node --test tests/hybrid-media-engine.test.mjs
```

Expected: every component test passes.

- [ ] **Step 8: Run lease and snapshot regressions**

Run:

```sh
node --test tests/mirror-wings.test.mjs tests/media-presentation.test.mjs tests/playback-session.test.mjs tests/hybrid-media-engine.test.mjs
```

Expected: all focused tests pass. Do not commit; append the task checkpoint to `.superpowers/sdd/progress.md`.

### Task 4: True Edge-Reflection CSS

**Files:**
- Modify: `src/styles/hybrid-media-engine.css`
- Modify: `tests/hybrid-media-engine.test.mjs`

**Interfaces:**
- Consumes: `--mirror-wing-inline-size` and `--mirror-edge-scale` from the shared-stage integration
- Consumes: `data-mirror-wings="on"`
- Produces: left-edge and right-edge reflected samples with an eight-pixel concealed overlap

- [ ] **Step 1: Write a failing CSS contract test**

Add to `tests/hybrid-media-engine.test.mjs`:

```js
test('Mirror Wings sample opposite source edges and reflect both outward', async () => {
  const css = await source(stylePath);
  assert.match(css, /\.media-wing-shell\s*\{[\s\S]+width:\s*var\(--mirror-wing-inline-size, 0px\)/s);
  assert.match(css, /\.media-wing\s*\{[\s\S]+position:\s*absolute[\s\S]+width:\s*calc\(100% \* var\(--mirror-edge-scale, 3\.5714285714\)\)[\s\S]+transform:\s*scaleX\(-1\)/s);
  assert.match(css, /\.media-wing--left\s*\{[\s\S]+right:\s*0/s);
  assert.match(css, /\.media-wing--right\s*\{[\s\S]+left:\s*0/s);
  assert.match(css, /data-mirror-wings="on"/);
  assert.match(css, /media-wing-shell--left[\s\S]+linear-gradient\(to right, rgb\(0 0 0 \/ 0\.18\), #000 42%, #000 100%\)/s);
  assert.match(css, /media-wing-shell--right[\s\S]+linear-gradient\(to left, rgb\(0 0 0 \/ 0\.18\), #000 42%, #000 100%\)/s);
});
```

- [ ] **Step 2: Run the CSS test to verify RED**

Run:

```sh
node --test --test-name-pattern="sample opposite source edges" tests/hybrid-media-engine.test.mjs
```

Expected: FAIL because the current wings use 50-percent full-frame shells and flip only the left follower.

- [ ] **Step 3: Replace the wing geometry and masks**

Replace the existing `.media-wing-shell` through `.media-wing--left` block with:

```css
.media-wing-shell {
  position: absolute;
  z-index: 2;
  inset-block: 0;
  width: var(--mirror-wing-inline-size, 0px);
  overflow: hidden;
  opacity: 0;
  pointer-events: none;
  transition: opacity 500ms ease;
}

.media-wing-shell--left {
  left: 0;
  mask-image: linear-gradient(to right, rgb(0 0 0 / 0.18), #000 42%, #000 100%);
}

.media-wing-shell--right {
  right: 0;
  mask-image: linear-gradient(to left, rgb(0 0 0 / 0.18), #000 42%, #000 100%);
}

.media-wing {
  position: absolute;
  inset-block: 0;
  width: calc(100% * var(--mirror-edge-scale, 3.5714285714));
  height: 100%;
  object-fit: cover;
  filter: blur(10px) saturate(0.55) brightness(0.4);
  transform: scaleX(-1);
  pointer-events: none;
}

.media-wing--left {
  right: 0;
}

.media-wing--right {
  left: 0;
}
```

Replace aspect-only opacity selectors with resolved-state selectors:

```css
.media-stage[data-mirror-wings="on"] .media-wing-shell {
  opacity: 1;
}

.media-stage:not([data-mirror-wings="on"]) .media-wing-shell {
  opacity: 0;
}
```

Keep the existing tablet opacity reduction, mobile `display: none`, and reduced-motion suppression, but change the tablet selector to `data-mirror-wings="on"`.

- [ ] **Step 4: Run the CSS and component tests to verify GREEN**

Run:

```sh
node --test tests/hybrid-media-engine.test.mjs
```

Expected: all component and CSS contract tests pass.

- [ ] **Step 5: Build once to catch Astro/CSS integration errors**

Run:

```sh
npm run build
```

Expected: Astro produces one static page without CSS or script compilation errors. Do not commit; append the task checkpoint to `.superpowers/sdd/progress.md`.

### Task 5: Focused Verification, Full Build, and Local Visual Gate

**Files:**
- Modify: `.superpowers/sdd/progress.md` (ignored task evidence)
- Modify: `.superpowers/sdd/task-9-report.md` (ignored task evidence)
- Verify only: all product and test files changed by Tasks 1–5

**Interfaces:**
- Consumes: the complete uncommitted Task 1–5 delta
- Produces: evidence for Justin's local approval decision

- [ ] **Step 1: Run the complete focused behavior suite**

Run:

```sh
node --test \
  tests/mirror-wings.test.mjs \
  tests/media-presentation.test.mjs \
  tests/playback-session.test.mjs \
  tests/hybrid-media-engine.test.mjs
```

Expected: every focused test passes with 0 failures.

- [ ] **Step 2: Run the full suite**

Run:

```sh
npm test
```

Expected: every test passes with 0 failures.

- [ ] **Step 3: Build the exact static review artifact**

Run:

```sh
npm run build
```

Expected: Astro builds one static page in `dist/` with exit 0.

- [ ] **Step 4: Check diff integrity and exact scope**

Run:

```sh
git diff --check
git status --short --branch
```

Expected: `git diff --check` emits no output. Status contains the prior approved Task 9 delta plus only the planned Mirror Wings files. No media blob, generated `dist/`, hosting, or deployment file is staged.

- [ ] **Step 5: Complete the local Safari/Chromium visual matrix**

Serve only the static `dist/` directory on loopback. Review:

1. A portrait Cinema source containing a centered face: confirm no obvious full duplicate appears in either wing.
2. Another portrait or square Cinema source: confirm the edge crop remains balanced.
3. A landscape Cinema source: confirm wings hide completely.
4. Desktop widths: 1440 and 1024 CSS pixels.
5. Tablet width: 768 CSS pixels.
6. Mobile widths: 430 and 390 CSS pixels; confirm wings remain absent and document width does not overflow.
7. Safari and Chromium consoles: confirm no playback, resize-observer, or CSS errors.

If no real portrait Music Video is configured, do not fabricate one in the catalog. Mark real-asset Music Video visual approval pending while relying on the executable provider/lease tests for this local implementation gate.

- [ ] **Step 6: Request independent read-only review**

Ask the reviewer to inspect only Critical and Important issues across:

- provider/aspect policy;
- geometry math and edge selection;
- lease snapshot restoration;
- failure isolation;
- preservation of all approval boundaries.

Expected: no unresolved Critical or Important findings before presenting the gate to Justin.

- [ ] **Step 7: Update ignored verification evidence**

Record exact commands, exit results, test counts, build output, browser matrix, known fixture limitations, and reviewer outcome in `.superpowers/sdd/progress.md` and `.superpowers/sdd/task-9-report.md`.

- [ ] **Step 8: Stop for Justin's approval**

Present the local preview and evidence. Do not commit implementation, create a remote tunnel, begin Task 10, sync ATLAS 14, ingest media, push, merge, deploy, or modify production/hosting. A later explicit approval determines the next authorized action.
