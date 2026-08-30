# Adaptive Cinema and Audio Console Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the portrait video's empty wide-screen surround with synchronized Cinematic Mirror Wings and promote native lossless audio playback into a substantial Mastering Console Shelf without pausing video motion.

**Architecture:** Keep `HybridMediaEngine.astro` as the manifest-driven composition root, but move aspect, follower synchronization, and audible-bus decisions into a small browser-neutral helper module with Node tests. The component will expose portrait/landscape state through one data attribute, use CSS for stage and breakpoint composition, and retain native `<video>`/`<audio>` elements as the only playback engines.

**Tech Stack:** Astro 7, Tailwind CSS 4, native HTML5 media, ECMAScript modules, Node 22 built-in test runner, Vercel Blob manifest URLs.

## Global Constraints

- The sharp master video must remain centered, undistorted, uncropped, and free of mirror, blur, brightness, scale, and color treatment.
- Portrait and square video use mirrored wings; landscape video uses the complete stage without wings.
- Wing videos are always muted, pointer-free, unfocusable, and absent from the accessibility tree.
- Starting the audio master mutes video audio but never pauses video motion or mirror-wing motion.
- Deliberately unmuting video pauses the audio master so only one audible source exists.
- Pausing or ending audio must not automatically unmute video.
- Native HTML5 audio remains the playback engine; do not add `AnalyserNode`, `AudioWorklet`, fake meters, generated waveforms, or PCM processing.
- Preserve the existing media manifest schema, Vercel Blob ingestion, immutable URLs, and atomic sync workflow.
- Desktop stage height is bounded from 540-720 px; tablet from 448-576 px; phone portrait is bounded to 70% of the small viewport height with a 640 px maximum.
- Mirrored wings are disabled at 767 px and below.
- Tablet layout is Visual Systems full-width, then Spatial DSP and Enterprise AV side by side; phone stacks Visual, Spatial, Enterprise.
- Do not change Publications & Credits, media assets, domain settings, or hosting infrastructure.

---

## File map

| File | Responsibility |
| --- | --- |
| `src/lib/media-presentation.mjs` | Pure aspect classification, mirror eligibility, follower drift correction, and audible-bus transitions |
| `tests/media-presentation.test.mjs` | Node unit coverage for all presentation and playback primitives |
| `tests/hybrid-media-engine.test.mjs` | Source-contract tests for required stage, console, accessibility, and responsive hooks |
| `src/components/HybridMediaEngine.astro` | Manifest-driven markup and client event coordination for stage, console, queues, and three operational modules |
| `src/styles/hybrid-media-engine.css` | Adaptive stage, mirror treatment, mastering-console, operational-grid, reduced-motion, and breakpoint styles |
| `docs/operations/viaims-launch-runbook.md` | Dated validation evidence after implementation and browser acceptance |

---

### Task 1: Add tested media-presentation primitives

**Files:**
- Create: `src/lib/media-presentation.mjs`
- Create: `tests/media-presentation.test.mjs`

**Interfaces:**
- Consumes: media-like objects exposing `currentTime`, `paused`, `muted`, `play()`, and `pause()`.
- Produces: `classifyMediaAspect(width, height)`, `usesMirrorWings(aspect)`, `alignFollower(master, follower, threshold)`, `claimAudioBus(video, audio)`, and `claimVideoBus(video, audio)`.

- [ ] **Step 1: Write the failing aspect and mirror-eligibility tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  alignFollower,
  claimAudioBus,
  claimVideoBus,
  classifyMediaAspect,
  usesMirrorWings,
} from '../src/lib/media-presentation.mjs';

test('classifyMediaAspect identifies portrait, landscape, square, and invalid dimensions', () => {
  assert.equal(classifyMediaAspect(1080, 1920), 'portrait');
  assert.equal(classifyMediaAspect(1920, 1080), 'landscape');
  assert.equal(classifyMediaAspect(1080, 1080), 'square');
  assert.equal(classifyMediaAspect(0, 1080), 'unknown');
  assert.equal(classifyMediaAspect(Number.NaN, 1080), 'unknown');
  assert.equal(classifyMediaAspect(undefined, undefined), 'unknown');
});

test('usesMirrorWings enables portrait and square composition only', () => {
  assert.equal(usesMirrorWings('portrait'), true);
  assert.equal(usesMirrorWings('square'), true);
  assert.equal(usesMirrorWings('landscape'), false);
  assert.equal(usesMirrorWings('unknown'), false);
});
```

- [ ] **Step 2: Run the new test and verify the missing module failure**

Run: `node --test tests/media-presentation.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/lib/media-presentation.mjs`.

- [ ] **Step 3: Implement aspect classification and mirror eligibility**

Create `src/lib/media-presentation.mjs` with:

```js
export function classifyMediaAspect(width, height) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return 'unknown';
  }
  if (width < height) return 'portrait';
  if (width > height) return 'landscape';
  return 'square';
}

export function usesMirrorWings(aspect) {
  return aspect === 'portrait' || aspect === 'square';
}
```

- [ ] **Step 4: Run the aspect tests and verify they pass**

Run: `node --test tests/media-presentation.test.mjs`

Expected: 2 tests pass, 0 fail.

- [ ] **Step 5: Add failing follower and audible-bus tests**

Append to `tests/media-presentation.test.mjs`:

```js
function media(overrides = {}) {
  return {
    currentTime: 0,
    paused: true,
    muted: true,
    playCalls: 0,
    pauseCalls: 0,
    async play() {
      this.playCalls += 1;
      this.paused = false;
    },
    pause() {
      this.pauseCalls += 1;
      this.paused = true;
    },
    ...overrides,
  };
}

test('alignFollower corrects drift only beyond the threshold', () => {
  const master = media({ currentTime: 18 });
  const near = media({ currentTime: 17.8 });
  const far = media({ currentTime: 17.6 });
  assert.equal(alignFollower(master, near, 0.3), false);
  assert.equal(near.currentTime, 17.8);
  assert.equal(alignFollower(master, far, 0.3), true);
  assert.equal(far.currentTime, 18);
});

test('claimAudioBus starts audio and mutes video without pausing video motion', async () => {
  const video = media({ paused: false, muted: false });
  const audio = media();
  await claimAudioBus(video, audio);
  assert.equal(video.paused, false);
  assert.equal(video.muted, true);
  assert.equal(audio.paused, false);
  assert.equal(audio.playCalls, 1);
});

test('claimAudioBus restores the prior video mute state when audio play rejects', async () => {
  const video = media({ paused: false, muted: false });
  const audio = media({
    async play() {
      throw new Error('decode failed');
    },
  });
  await assert.rejects(() => claimAudioBus(video, audio), /decode failed/);
  assert.equal(video.muted, false);
  assert.equal(video.paused, false);
});

test('claimVideoBus pauses audio before unmuting video', () => {
  const video = media({ paused: false, muted: true });
  const audio = media({ paused: false });
  claimVideoBus(video, audio);
  assert.equal(audio.paused, true);
  assert.equal(audio.pauseCalls, 1);
  assert.equal(video.muted, false);
  assert.equal(video.paused, false);
});
```

- [ ] **Step 6: Run the tests and verify the missing exports fail**

Run: `node --test tests/media-presentation.test.mjs`

Expected: FAIL because `alignFollower`, `claimAudioBus`, and `claimVideoBus` are not exported.

- [ ] **Step 7: Implement follower alignment and audible-bus transitions**

Append to `src/lib/media-presentation.mjs`:

```js
export function alignFollower(master, follower, threshold = 0.3) {
  if (!Number.isFinite(master.currentTime) || !Number.isFinite(follower.currentTime)) return false;
  if (Math.abs(follower.currentTime - master.currentTime) <= threshold) return false;
  follower.currentTime = master.currentTime;
  return true;
}

export async function claimAudioBus(video, audio) {
  const priorMuteState = video.muted;
  video.muted = true;
  try {
    await audio.play();
  } catch (error) {
    video.muted = priorMuteState;
    throw error;
  }
}

export function claimVideoBus(video, audio) {
  if (!audio.paused) audio.pause();
  video.muted = false;
}
```

- [ ] **Step 8: Run the focused and complete test suites**

Run: `node --test tests/media-presentation.test.mjs`

Expected: 6 tests pass, 0 fail.

Run: `npm test`

Expected: 29 tests pass, 0 fail.

- [ ] **Step 9: Commit the tested primitives**

```bash
git add src/lib/media-presentation.mjs tests/media-presentation.test.mjs
git commit -m "test: define adaptive media playback rules"
```

---

### Task 2: Replace the Gaussian backdrop with the adaptive mirror stage

**Files:**
- Create: `tests/hybrid-media-engine.test.mjs`
- Create: `src/styles/hybrid-media-engine.css`
- Modify: `src/components/HybridMediaEngine.astro:1-35,182-305,392-394`

**Interfaces:**
- Consumes: all five exports from `src/lib/media-presentation.mjs`; `videoPlaylist` from `toPlaylists(manifest)`.
- Produces: root `[data-hybrid-media-engine]`, `#master-stage-container[data-media-aspect]`, `#mirror-wing-left`, `#mirror-wing-right`, and existing `#master-video` transport behavior.

- [ ] **Step 1: Write the failing stage source-contract test**

Create `tests/hybrid-media-engine.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const componentPath = new URL('../src/components/HybridMediaEngine.astro', import.meta.url);
const stylePath = new URL('../src/styles/hybrid-media-engine.css', import.meta.url);

async function source(url) {
  return readFile(url, 'utf8');
}

test('hybrid engine exposes an adaptive stage with two decorative wings', async () => {
  const component = await source(componentPath);
  assert.match(component, /data-hybrid-media-engine/);
  assert.match(component, /id="master-stage-container"[^>]+data-media-aspect="unknown"/s);
  assert.match(component, /id="mirror-wing-left"/);
  assert.match(component, /id="mirror-wing-right"/);
  assert.equal((component.match(/aria-hidden="true"/g) ?? []).length >= 2, true);
  assert.equal((component.match(/tabindex="-1"/g) ?? []).length >= 2, true);
  assert.doesNotMatch(component, /id="bg-video-blur"/);
});

test('adaptive stage CSS contains portrait, landscape, mobile, and reduced-motion rules', async () => {
  const css = await source(stylePath);
  assert.match(css, /data-media-aspect="portrait"/);
  assert.match(css, /data-media-aspect="square"/);
  assert.match(css, /data-media-aspect="landscape"/);
  assert.match(css, /max-width:\s*767px/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});
```

- [ ] **Step 2: Run the source-contract test and verify it fails**

Run: `node --test tests/hybrid-media-engine.test.mjs`

Expected: FAIL because the mirror IDs and stylesheet do not exist and `bg-video-blur` is still present.

- [ ] **Step 3: Add adaptive stage markup and playlist data hooks**

In `src/components/HybridMediaEngine.astro`:

1. Import the stylesheet in frontmatter:

```js
import '../styles/hybrid-media-engine.css';
```

2. Add `data-hybrid-media-engine` to the root.
3. Replace lines 9-35 with this structure while preserving the existing mute button:

```astro
<div id="master-stage-container" class="media-stage" data-media-aspect="unknown">
  <div class="media-wing-shell media-wing-shell--left" aria-hidden="true">
    <video
      id="mirror-wing-left"
      class="media-wing media-wing--left"
      muted
      playsinline
      preload="none"
      tabindex="-1"
      aria-hidden="true"
    ></video>
  </div>
  <div class="media-wing-shell media-wing-shell--right" aria-hidden="true">
    <video
      id="mirror-wing-right"
      class="media-wing media-wing--right"
      muted
      playsinline
      preload="none"
      tabindex="-1"
      aria-hidden="true"
    ></video>
  </div>
  <div class="media-stage-vignette" aria-hidden="true"></div>
  <video
    id="master-video"
    src={videoPlaylist[0].src}
    autoplay
    muted
    playsinline
    preload="metadata"
    class="media-master"
  ></video>
  <button id="master-mute-btn" class="media-mute-control absolute bottom-4 right-4 z-20 bg-black/80 hover:bg-zinc-900 border border-zinc-700 text-zinc-300 text-[11px] font-mono px-3 py-1.5 flex items-center gap-2 transition-colors">
    <span id="mute-led" class="w-2 h-2 rounded-full bg-red-500"></span>
    <span id="mute-label">VIDEO AUDIO MUTED</span>
  </button>
</div>
```

4. Add `data-v-src`, `data-v-title`, and `data-v-specs` to every `.video-cue-btn`, and the corresponding `data-a-src`, `data-a-title`, and `data-a-specs` to every `.audio-cue-btn`. These hooks allow the processed browser script to import helpers without `define:vars`.

- [ ] **Step 4: Add the complete adaptive-stage CSS**

Create `src/styles/hybrid-media-engine.css` with the stage foundation:

```css
.media-stage {
  position: relative;
  display: flex;
  width: 100%;
  height: clamp(33.75rem, 42vw, 45rem);
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 1px solid rgb(39 39 42);
  background: #000;
  box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.75);
  transition: height 500ms ease;
}

.media-master {
  position: relative;
  z-index: 10;
  width: auto;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.media-wing-shell {
  position: absolute;
  inset-block: 0;
  width: 50%;
  overflow: hidden;
  opacity: 0;
  pointer-events: none;
  transition: opacity 500ms ease;
}

.media-wing-shell--left {
  left: 0;
  mask-image: linear-gradient(to right, rgb(0 0 0 / 0.75), #000 65%, transparent 100%);
}

.media-wing-shell--right {
  right: 0;
  mask-image: linear-gradient(to left, rgb(0 0 0 / 0.75), #000 65%, transparent 100%);
}

.media-wing {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: blur(8px) saturate(0.6) brightness(0.42);
  transform: scale(1.08);
  pointer-events: none;
}

.media-wing--left {
  transform: scaleX(-1) scale(1.08);
}

.media-stage[data-media-aspect="portrait"] .media-wing-shell,
.media-stage[data-media-aspect="square"] .media-wing-shell {
  opacity: 1;
}

.media-stage[data-media-aspect="landscape"] .media-wing-shell,
.media-stage[data-media-aspect="unknown"] .media-wing-shell {
  opacity: 0;
}

.media-stage-vignette {
  position: absolute;
  z-index: 4;
  inset: 0;
  background: linear-gradient(90deg, rgb(0 0 0 / 0.55), transparent 25% 75%, rgb(0 0 0 / 0.55));
  pointer-events: none;
}

@media (min-width: 768px) and (max-width: 1279px) {
  .media-stage {
    height: clamp(28rem, 60vw, 36rem);
  }
  .media-stage[data-media-aspect="portrait"] .media-wing-shell,
  .media-stage[data-media-aspect="square"] .media-wing-shell {
    opacity: 0.55;
  }
}

@media (max-width: 767px) {
  .media-stage[data-media-aspect="portrait"],
  .media-stage[data-media-aspect="square"],
  .media-stage[data-media-aspect="unknown"] {
    height: min(70svh, 40rem);
  }
  .media-stage[data-media-aspect="landscape"] {
    height: auto;
    aspect-ratio: 16 / 9;
  }
  .media-wing-shell,
  .media-stage-vignette {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .media-stage,
  .media-wing-shell {
    transition: none;
  }
  .media-wing {
    visibility: hidden;
  }
}
```

- [ ] **Step 5: Run the contract test and confirm the markup/style half passes**

Run: `node --test tests/hybrid-media-engine.test.mjs`

Expected: 2 tests pass, 0 fail.

- [ ] **Step 6: Convert the client script to a processed module and wire mirror lifecycle**

Replace `<script define:vars={{ videoPlaylist, audioPlaylist }}>` with a normal `<script>`. Import the helpers and derive playlists from the button datasets:

```js
import {
  alignFollower,
  classifyMediaAspect,
  usesMirrorWings,
} from '../lib/media-presentation.mjs';

const root = document.querySelector('[data-hybrid-media-engine]');
const stage = root.querySelector('#master-stage-container');
const mv = root.querySelector('#master-video');
const wingLeft = root.querySelector('#mirror-wing-left');
const wingRight = root.querySelector('#mirror-wing-right');
const wings = [wingLeft, wingRight];
const videoCueBtns = [...root.querySelectorAll('.video-cue-btn')];
const audioCueBtns = [...root.querySelectorAll('.audio-cue-btn')];
const videoPlaylist = videoCueBtns.map((button) => ({
  src: button.dataset.vSrc,
  title: button.dataset.vTitle,
  specs: button.dataset.vSpecs,
}));
const audioPlaylist = audioCueBtns.map((button) => ({
  src: button.dataset.aSrc,
  title: button.dataset.aTitle,
  specs: button.dataset.aSpecs,
}));
```

Replace `syncBackdrop()` and direct `bgv` writes with:

```js
function hideMirrorWings() {
  for (const wing of wings) {
    wing.pause();
    wing.removeAttribute('src');
    wing.load();
  }
}

async function activateMirrorWings() {
  for (const wing of wings) {
    wing.src = mv.currentSrc || mv.src;
    wing.currentTime = mv.currentTime;
  }
  try {
    await Promise.all(wings.map((wing) => mv.paused ? undefined : wing.play()));
  } catch {
    stage.dataset.mirrorFailure = 'true';
    hideMirrorWings();
  }
}

function applyMediaAspect() {
  const aspect = classifyMediaAspect(mv.videoWidth, mv.videoHeight);
  stage.dataset.mediaAspect = aspect;
  delete stage.dataset.mirrorFailure;
  if (usesMirrorWings(aspect) && !matchMedia('(max-width: 767px)').matches && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    void activateMirrorWings();
  } else {
    hideMirrorWings();
  }
}

function alignMirrorWings() {
  for (const wing of wings) alignFollower(mv, wing, 0.3);
}

function activeMirrorWings() {
  return usesMirrorWings(stage.dataset.mediaAspect)
    ? wings.filter((wing) => Boolean(wing.currentSrc || wing.src))
    : [];
}

async function playVideoStack() {
  const results = await Promise.allSettled([
    mv.play(),
    ...activeMirrorWings().map((wing) => wing.play()),
  ]);
  if (results[0].status === 'rejected') throw results[0].reason;
}

function pauseVideoStack() {
  mv.pause();
  for (const wing of activeMirrorWings()) wing.pause();
}

function setVideoTime(target) {
  mv.currentTime = target;
  for (const wing of activeMirrorWings()) wing.currentTime = target;
}
```

Update master event behavior:

```js
mv.addEventListener('loadedmetadata', () => {
  vidDur.textContent = formatTime(mv.duration);
  applyMediaAspect();
});

mv.addEventListener('timeupdate', () => {
  if (!Number.isNaN(mv.duration)) {
    vidSeek.value = (mv.currentTime / mv.duration) * 100;
    vidCur.textContent = formatTime(mv.currentTime);
    alignMirrorWings();
  }
});
```

Use `playVideoStack()`, `pauseVideoStack()`, and `setVideoTime(target)` in the existing play/pause, scrubber, and ±10-second handlers. `switchVideo` updates only the sharp master source and metadata; `loadedmetadata` classifies the new source and activates wings when eligible. The master play rejection remains actionable, while decorative wing rejections cannot become unhandled promise rejections.

- [ ] **Step 7: Add a contract assertion for helper imports and stage classification**

Append to `tests/hybrid-media-engine.test.mjs`:

```js
test('hybrid engine imports presentation rules and classifies source metadata', async () => {
  const component = await source(componentPath);
  assert.match(component, /from '\.\.\/lib\/media-presentation\.mjs'/);
  assert.match(component, /classifyMediaAspect\(mv\.videoWidth, mv\.videoHeight\)/);
  assert.match(component, /alignFollower\(mv, wing, 0\.3\)/);
  assert.match(component, /data-v-src=/);
  assert.match(component, /data-a-src=/);
});
```

- [ ] **Step 8: Run tests and build**

Run: `npm test`

Expected: 32 tests pass, 0 fail.

Run: `npm run build`

Expected: Astro generates the static `/` route successfully.

- [ ] **Step 9: Commit the adaptive stage**

```bash
git add src/components/HybridMediaEngine.astro src/styles/hybrid-media-engine.css tests/hybrid-media-engine.test.mjs
git commit -m "feat: add adaptive cinematic mirror stage"
```

---

### Task 3: Build the Mastering Console Shelf and refocus Module 02

**Files:**
- Modify: `src/components/HybridMediaEngine.astro:37-130`
- Modify: `src/styles/hybrid-media-engine.css`
- Modify: `tests/hybrid-media-engine.test.mjs`

**Interfaces:**
- Consumes: existing `#dsp-audio`, audio playlist data hooks, and current audio element IDs.
- Produces: `[data-mastering-console]`, console transport IDs, `#audio-bus-status`, `#audio-queue-preview`, and a transport-free Module 02 catalog panel.

- [ ] **Step 1: Write the failing console contract test**

Append:

```js
test('hybrid engine renders a full mastering console before the operational deck', async () => {
  const component = await source(componentPath);
  const consoleIndex = component.indexOf('data-mastering-console');
  const deckIndex = component.indexOf('data-operational-deck');
  assert.equal(consoleIndex > -1, true);
  assert.equal(deckIndex > consoleIndex, true);
  assert.match(component, /id="audio-bus-status"[^>]+aria-live="polite"/s);
  assert.match(component, /id="audio-queue-preview"/);
  assert.match(component, /id="dsp-seek"/);
  assert.match(component, /id="dsp-rewind-10"/);
  assert.match(component, /id="dsp-forward-10"/);
  assert.match(component, /id="dsp-audio"/);
});
```

- [ ] **Step 2: Run the focused contract test and verify it fails**

Run: `node --test tests/hybrid-media-engine.test.mjs`

Expected: FAIL because the console and operational-deck hooks are absent.

- [ ] **Step 3: Insert the Mastering Console Shelf directly below the stage**

Move the existing audio title, specs, seek, timecode, transport buttons, and `<audio>` element out of Module 02 and into this structure after `#master-stage-container`:

```astro
<section data-mastering-console class="mastering-console" aria-labelledby="mastering-console-title">
  <div class="mastering-console__header">
    <div>
      <p class="mastering-console__eyebrow">02 / Spatial DSP Master</p>
      <h2 id="mastering-console-title" class="mastering-console__title">
        <span id="audio-title-display">{audioPlaylist[0].title}</span>
      </h2>
      <p id="audio-specs-display" class="mastering-console__specs">{audioPlaylist[0].specs}</p>
    </div>
    <span class="mastering-console__format">LOSSLESS · NATIVE PCM</span>
  </div>

  <div class="mastering-console__timeline">
    <span id="dsp-current">00:00</span>
    <input type="range" id="dsp-seek" value="0" min="0" max="100" aria-label="Audio master position" />
    <span id="dsp-duration">--:--</span>
  </div>

  <div class="mastering-console__transport" aria-label="Audio master transport">
    <button id="dsp-prev" aria-label="Previous audio master">⏮</button>
    <button id="dsp-rewind-10" aria-label="Rewind audio master 10 seconds">−10s</button>
    <button id="dsp-play" class="mastering-console__play">PLAY MASTER</button>
    <button id="dsp-forward-10" aria-label="Advance audio master 10 seconds">+10s</button>
    <button id="dsp-next" aria-label="Next audio master">⏭</button>
  </div>

  <div class="mastering-console__state">
    <span id="audio-bus-status" aria-live="polite">AUDIO MASTER READY</span>
    <span id="video-bus-status">VIDEO MOTION LIVE · VIDEO AUDIO MUTED</span>
  </div>

  <div id="audio-queue-preview" class="mastering-console__queue" aria-label="Audio queue preview"></div>
  <audio id="dsp-audio" src={audioPlaylist[0].src} preload="metadata"></audio>
</section>
```

- [ ] **Step 4: Refocus Module 02 on library depth**

Inside the operational deck:

- Add `data-operational-deck` to the grid wrapper.
- Add `data-module="visual"`, `data-module="spatial"`, and `data-module="enterprise"` to the three cards.
- Rename the second card heading to `02 / Spatial DSP Library`.
- Retain the complete `.audio-cue-btn` list, detected track count, and auto-advance state.
- Remove duplicate title, scrubber, timecode, and transport markup from Module 02.
- Add one truthful explanatory line: `SELECT A MASTER TO LOAD THE CONSOLE`.

- [ ] **Step 5: Add complete console and deck CSS**

Append to `src/styles/hybrid-media-engine.css`:

```css
.mastering-console {
  min-height: 8.75rem;
  padding: 1.25rem;
  border: 1px solid rgb(63 63 70);
  background: rgb(9 9 11 / 0.96);
  box-shadow: 0 16px 30px rgb(0 0 0 / 0.35);
}

.mastering-console__header,
.mastering-console__state {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.mastering-console__eyebrow,
.mastering-console__specs,
.mastering-console__format,
.mastering-console__timeline,
.mastering-console__state {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.mastering-console__eyebrow { color: rgb(113 113 122); font-size: 0.625rem; letter-spacing: 0.12em; text-transform: uppercase; }
.mastering-console__title { margin-top: 0.25rem; color: #fff; font-size: 0.875rem; text-transform: uppercase; }
.mastering-console__specs { margin-top: 0.25rem; color: rgb(113 113 122); font-size: 0.6875rem; }
.mastering-console__format { padding: 0.3rem 0.5rem; border: 1px solid rgb(20 83 45); background: rgb(5 46 22); color: rgb(52 211 153); font-size: 0.625rem; }
.mastering-console__timeline { display: grid; grid-template-columns: 3rem 1fr 3rem; gap: 0.75rem; align-items: center; margin-block: 1rem; color: rgb(113 113 122); font-size: 0.6875rem; }
.mastering-console__timeline input { width: 100%; accent-color: rgb(244 244 245); }
.mastering-console__transport { display: flex; justify-content: center; gap: 0.5rem; }
.mastering-console__transport button { min-height: 2rem; padding-inline: 0.75rem; border: 1px solid rgb(63 63 70); background: rgb(24 24 27); color: rgb(212 212 216); font: 0.75rem ui-monospace, SFMono-Regular, Menlo, monospace; }
.mastering-console__transport .mastering-console__play { min-width: 8rem; background: rgb(244 244 245); color: #000; font-weight: 700; }
.mastering-console__state { margin-top: 1rem; padding-top: 0.75rem; border-top: 1px solid rgb(39 39 42); color: rgb(113 113 122); font-size: 0.625rem; }
#audio-bus-status[data-live="true"] { color: rgb(52 211 153); }
.mastering-console__queue { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.5rem; margin-top: 0.75rem; }
.mastering-console__queue button { min-width: 0; padding: 0.5rem; border: 1px solid rgb(39 39 42); background: rgb(16 16 20); color: rgb(161 161 170); font: 0.625rem ui-monospace, SFMono-Regular, Menlo, monospace; text-align: left; }

[data-operational-deck] {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  grid-template-areas: "visual spatial enterprise";
  gap: 1.5rem;
  align-items: stretch;
}
```

- [ ] **Step 6: Run the console contract test and build**

Run: `node --test tests/hybrid-media-engine.test.mjs`

Expected: all component contract tests pass.

Run: `npm run build`

Expected: Astro generates the static `/` route successfully with no duplicate-ID warning.

- [ ] **Step 7: Commit the Mastering Console Shelf**

```bash
git add src/components/HybridMediaEngine.astro src/styles/hybrid-media-engine.css tests/hybrid-media-engine.test.mjs
git commit -m "feat: promote audio mastering console"
```

---

### Task 4: Wire audio queue preview and explicit audible-bus status

**Files:**
- Modify: `src/components/HybridMediaEngine.astro:182-394` after Task 3 shifts
- Modify: `tests/hybrid-media-engine.test.mjs`

**Interfaces:**
- Consumes: `claimAudioBus(video, audio)` and `claimVideoBus(video, audio)` from Task 1; console IDs from Task 3.
- Produces: synchronized console labels, a three-item queue preview, and explicit single-audible-source behavior.

- [ ] **Step 1: Add failing contract assertions for bus helpers and queue rendering**

Append:

```js
test('mastering console uses tested audible-bus helpers and renders queue preview', async () => {
  const component = await source(componentPath);
  assert.match(component, /claimAudioBus\(mv, dspAudio\)/);
  assert.match(component, /claimVideoBus\(mv, dspAudio\)/);
  assert.match(component, /function renderAudioQueuePreview\(\)/);
  assert.match(component, /audioBusStatus\.dataset\.live/);
  assert.match(component, /VIDEO MOTION LIVE · VIDEO AUDIO MUTED/);
});
```

- [ ] **Step 2: Run the contract test and verify it fails**

Run: `node --test tests/hybrid-media-engine.test.mjs`

Expected: FAIL because the component still mutates `muted` and `pause()` directly.

- [ ] **Step 3: Import bus helpers and add status rendering**

Extend the Task 2 import:

```js
import {
  alignFollower,
  claimAudioBus,
  claimVideoBus,
  classifyMediaAspect,
  usesMirrorWings,
} from '../lib/media-presentation.mjs';
```

Add element references and status functions:

```js
const audioBusStatus = root.querySelector('#audio-bus-status');
const videoBusStatus = root.querySelector('#video-bus-status');
const audioQueuePreview = root.querySelector('#audio-queue-preview');

function renderBusStatus() {
  const audioLive = !dspAudio.paused;
  audioBusStatus.dataset.live = String(audioLive);
  audioBusStatus.textContent = audioLive ? '● AUDIO MASTER LIVE' : 'AUDIO MASTER READY';
  videoBusStatus.textContent = mv.muted
    ? 'VIDEO MOTION LIVE · VIDEO AUDIO MUTED'
    : 'VIDEO MOTION LIVE · VIDEO AUDIO LIVE';
}
```

- [ ] **Step 4: Render the current track and next two entries**

Add:

```js
function renderAudioQueuePreview() {
  audioQueuePreview.replaceChildren();
  for (let offset = 0; offset < Math.min(3, audioPlaylist.length); offset += 1) {
    const index = (currentAudIdx + offset) % audioPlaylist.length;
    const track = audioPlaylist[index];
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.aIdx = String(index);
    button.textContent = offset === 0 ? `CURRENT · ${track.title}` : `UP NEXT ${offset} · ${track.title}`;
    button.addEventListener('click', () => switchAudio(index, true));
    audioQueuePreview.append(button);
  }
}
```

Call `renderAudioQueuePreview()` after every audio switch and once during initialization.

- [ ] **Step 5: Replace direct audible-bus mutations**

Use this audio-start function from the play button and `switchAudio`:

```js
async function playAudioMaster() {
  try {
    await claimAudioBus(mv, dspAudio);
    dspPlayBtn.textContent = 'PAUSE MASTER';
  } catch {
    dspPlayBtn.textContent = 'PLAY MASTER';
  }
  updateVideoMuteUI();
  renderBusStatus();
}
```

Use this video-audio activation branch in the mute button handler:

```js
if (mv.muted) {
  claimVideoBus(mv, dspAudio);
  dspPlayBtn.textContent = 'PLAY MASTER';
} else {
  mv.muted = true;
}
updateVideoMuteUI();
renderBusStatus();
```

On `dspAudio` `play`, `pause`, and `ended`, call `renderBusStatus()`. Do not unmute the video in any of those listeners.

- [ ] **Step 6: Run focused and complete tests**

Run: `node --test tests/media-presentation.test.mjs tests/hybrid-media-engine.test.mjs`

Expected: all presentation and component contract tests pass.

Run: `npm test`

Expected: complete suite passes with 0 failures.

- [ ] **Step 7: Commit audible-bus and queue behavior**

```bash
git add src/components/HybridMediaEngine.astro tests/hybrid-media-engine.test.mjs
git commit -m "feat: coordinate audio and video buses"
```

---

### Task 5: Finish responsive module distribution and accessibility safeguards

**Files:**
- Modify: `src/styles/hybrid-media-engine.css`
- Modify: `src/components/HybridMediaEngine.astro`
- Modify: `tests/hybrid-media-engine.test.mjs`

**Interfaces:**
- Consumes: module hooks and console classes from Tasks 2-4.
- Produces: approved desktop/tablet/phone distribution, keyboard labels, focus visibility, and reduced-motion fallback.

- [ ] **Step 1: Add failing responsive/accessibility contract tests**

Append:

```js
test('operational deck exposes responsive module roles and labeled controls', async () => {
  const component = await source(componentPath);
  const css = await source(stylePath);
  assert.match(component, /data-module="visual"/);
  assert.match(component, /data-module="spatial"/);
  assert.match(component, /data-module="enterprise"/);
  assert.match(component, /aria-label="Audio master position"/);
  assert.match(component, /aria-label="Previous audio master"/);
  assert.match(component, /aria-label="Next audio master"/);
  assert.match(css, /grid-template-areas:\s*"visual visual"\s*"spatial enterprise"/);
  assert.match(css, /grid-template-areas:\s*"visual"\s*"spatial"\s*"enterprise"/);
  assert.match(css, /:focus-visible/);
});
```

- [ ] **Step 2: Run the test and verify missing responsive rules fail**

Run: `node --test tests/hybrid-media-engine.test.mjs`

Expected: FAIL on grid-template areas and focus-visible styling.

- [ ] **Step 3: Add tablet and phone module distribution**

Append:

```css
[data-module="visual"] { grid-area: visual; }
[data-module="spatial"] { grid-area: spatial; }
[data-module="enterprise"] { grid-area: enterprise; }

@media (min-width: 768px) and (max-width: 1279px) {
  [data-operational-deck] {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-template-areas:
      "visual visual"
      "spatial enterprise";
  }
}

@media (max-width: 767px) {
  [data-operational-deck] {
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas:
      "visual"
      "spatial"
      "enterprise";
  }
  .mastering-console__header,
  .mastering-console__state {
    align-items: flex-start;
    flex-direction: column;
  }
  .mastering-console__timeline {
    grid-template-columns: 2.5rem minmax(0, 1fr) 2.5rem;
  }
  .mastering-console__transport {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
  .mastering-console__transport button,
  .mastering-console__transport .mastering-console__play {
    min-width: 0;
    padding-inline: 0.35rem;
  }
  .mastering-console__queue {
    display: flex;
    overflow-x: auto;
  }
  .mastering-console__queue button {
    min-width: 10rem;
  }
}
```

- [ ] **Step 4: Add keyboard focus and truthful status styling**

Append:

```css
.media-mute-control:focus-visible,
.mastering-console button:focus-visible,
[data-operational-deck] button:focus-visible,
.mastering-console input:focus-visible {
  outline: 2px solid rgb(103 232 249);
  outline-offset: 3px;
}

@media (prefers-reduced-motion: reduce) {
  .media-master,
  .mastering-console button,
  [data-operational-deck] button {
    transition: none;
  }
}
```

Ensure every icon-only video transport button also receives an exact `aria-label`: previous video, rewind video 10 seconds, advance video 10 seconds, and next video.

- [ ] **Step 5: Run tests, build, and overflow smoke checks**

Run: `npm test`

Expected: complete suite passes with 0 failures.

Run: `npm run build`

Expected: Astro generates one static route successfully.

Run: `git diff --check`

Expected: exit 0 with no output.

- [ ] **Step 6: Commit responsive and accessibility behavior**

```bash
git add src/components/HybridMediaEngine.astro src/styles/hybrid-media-engine.css tests/hybrid-media-engine.test.mjs
git commit -m "feat: refine responsive media console"
```

---

### Task 6: Perform browser acceptance and record evidence

**Files:**
- Modify: `docs/operations/viaims-launch-runbook.md`

**Interfaces:**
- Consumes: completed adaptive stage and mastering-console implementation.
- Produces: dated, reproducible acceptance evidence for deployment review.

- [ ] **Step 1: Run the complete local preflight**

Run:

```bash
npm test
npm run build
git diff --check
```

Expected: all tests pass, Astro builds `/`, and diff check exits 0.

- [ ] **Step 2: Start the local production-equivalent preview**

Run: `npm run preview -- --host 127.0.0.1`

Expected: Astro reports a reachable local URL and no startup error.

- [ ] **Step 3: Validate representative portrait and landscape cues at six widths**

At 1440, 1280, 1024, 768, 430, and 390 CSS pixels, record:

- viewport width and `document.documentElement.scrollWidth`;
- stage `data-media-aspect`;
- master rendered width/height and centered offset;
- visibility of both wing shells;
- operational grid areas;
- console bounding box and control visibility.

Expected:

- no horizontal overflow;
- portrait master centered within one CSS pixel;
- portrait/square wings visible above 767 px and absent below it;
- landscape wings absent at every width;
- master aspect ratio remains unchanged;
- tablet grid is Visual full row then Spatial/Enterprise;
- phone grid is Visual, Spatial, Enterprise;
- console remains fully playable.

- [ ] **Step 4: Validate transport synchronization and audible ownership**

For one portrait cue and one landscape cue, exercise:

1. play/pause;
2. 25% scrub;
3. −10 and +10 seconds;
4. previous/next round trip;
5. ended-event auto-advance.

For portrait, inspect each active wing after every operation. Expected drift from the master is at most 0.30 seconds after correction.

Then:

1. unmute video;
2. start the audio master;
3. confirm video motion and wings continue;
4. confirm video audio becomes muted;
5. confirm audio is the only audible source;
6. unmute video;
7. confirm audio pauses;
8. pause audio and confirm video does not unmute automatically.

- [ ] **Step 5: Validate failure and accessibility paths**

- Temporarily substitute a missing URL for one decorative wing in DevTools; confirm both wings hide while the master and controls continue.
- Enable reduced motion; confirm animated wings are not presented and the master remains functional.
- Keyboard through mute, video transport, audio transport, scrubbers, queue preview, and module queues; confirm every target has visible focus and an accurate accessible name.
- Confirm the polite bus-status region does not announce timecode updates.

- [ ] **Step 6: Validate Safari and Chromium playback cost**

In current Safari and Chromium:

- play a representative high-resolution portrait asset for at least two minutes;
- seek twice and change cues twice;
- observe for dropped master frames, loss of A/V responsiveness, runaway CPU, or thermal escalation attributable to the decorative wings.

If decorative decoding materially degrades the sharp master, activate the approved single-ambient-layer or neutral-gradient fallback before release. Do not lower the sharp master's quality.

- [ ] **Step 7: Record dated evidence in the launch runbook**

Append a new `### 2026-08-30 adaptive media verification` section to `docs/operations/viaims-launch-runbook.md` containing:

- commit tested;
- test count and result;
- Astro build result;
- six-width layout table;
- portrait/landscape cue IDs used;
- synchronization result;
- audible-bus result;
- reduced-motion and failure-fallback result;
- Safari and Chromium result;
- any approved deviation.

- [ ] **Step 8: Commit validation evidence**

```bash
git add docs/operations/viaims-launch-runbook.md
git commit -m "test: validate adaptive media experience"
```

---

## Final verification gate

Run:

```bash
npm test
npm run build
git diff --check
git status --short --branch
```

Expected:

- every test passes;
- Astro generates the production site successfully;
- no whitespace errors;
- only intentionally retained pre-existing untracked research files remain;
- the implementation branch is ready for review but is not pushed or deployed without separate user approval.
