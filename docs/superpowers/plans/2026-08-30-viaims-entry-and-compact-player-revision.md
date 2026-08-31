# VIAIMS Entry Experience and Compact Player Revision Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Use superpowers:test-driven-development for every behavior change and superpowers:verification-before-completion before any completion claim.

**Goal:** Revise the adaptive-media shadow so Cinema motion continues independently under ambient or Music Audio, the command surface becomes a compact six-row tabbed dock beneath the stage, the institutional identity is precise and centered, and future real welcome/ambient assets can activate a truthful visitor-entry flow.

**Architecture:** Keep one browser-facing controller in `HybridMediaEngine.astro`, but move state decisions into small pure modules. `intro-session.mjs` owns whether the entry experience is available and its welcome-to-Cinema transition. `audible-source.mjs` owns reversible single-source audio authority. `cinema-continuity.mjs` owns Cinema queue identity and validates Cinema-ended events without consulting whichever provider is audible. `playback-session.mjs` continues to own stage leases and tab browsing; `music-queue.mjs` continues to own Music order. The component orchestrates real media elements from those independent decisions.

**Tech Stack:** Astro 7, browser-native `<video>`/`<audio>`, JavaScript ES modules, Node 22 built-in test runner, CSS, Vercel Blob immutable media URLs.

## Global Constraints

- Work only in `/Users/jsdmbp/Documents/ChatGPT/VIAIMS web agent Portfolio/site/.worktrees/adaptive-media-shadow` on `codex/adaptive-media-shadow`.
- Preserve the existing uncommitted Task 3 implementation. Do not reset, discard, or overwrite unrelated user work.
- Execute every behavior slice RED, then GREEN. Record the failing assertion or exit status before changing implementation.
- Do not implement the deferred numeric-series/random preference in `docs/player-todo.md`.
- Do not fabricate welcome, ambient, Music Video, Media, or YouTube assets.
- Keep the entry gate inactive unless both real welcome and ambient HTTPS URLs are configured.
- Do not add Web Audio processing, gain, EQ, dynamics, resampling, playback-rate, pitch, or meter nodes to the audible path in this revision.
- Do not push, merge, deploy, alter hosting/DNS, modify production, or implement mobile ingestion.
- Do not commit revision implementation until Justin approves both the local visual gate and the production-equivalent remote phone/listening gate. The already-approved design-doc commit is the baseline exception.
- After every task, provide the Live Collaboration Protocol evidence packet: files changed, RED command/result, GREEN command/result, relevant diff summary, risks, and reviewer verdict.
- Use an independent reviewer after each implementation task. Resolve Critical/Important findings before continuing; log Minor findings explicitly.

---

### Task 1: Model optional entry assets without enabling placeholders

**Files:**
- Modify: `src/data/curated-media.json`
- Modify: `src/lib/media-library.mjs`
- Modify: `tests/media-library.test.mjs`

**Step 1: Write the failing entry-catalog tests**

Extend the `curated` fixture in `tests/media-library.test.mjs` with:

```js
experience: {
  welcomeVideoSrc: 'https://cdn.example/viaims-welcome.mp4',
  ambientAudioSrc: 'https://cdn.example/viaims-ambient.wav',
},
```

Add these tests:

```js
test('experience is enabled only when both real HTTPS entry assets exist', () => {
  const library = toMediaLibrary(manifest, curated);
  assert.deepEqual(library.experience, {
    enabled: true,
    welcomeVideoSrc: 'https://cdn.example/viaims-welcome.mp4',
    ambientAudioSrc: 'https://cdn.example/viaims-ambient.wav',
  });
});

test('missing entry assets retain truthful Cinema fallback', () => {
  const library = toMediaLibrary(manifest, { version: 1, music: [], media: [], youtube: [] });
  assert.deepEqual(library.experience, {
    enabled: false,
    welcomeVideoSrc: null,
    ambientAudioSrc: null,
  });
});

test('partial or non-HTTPS entry configuration is rejected', () => {
  assert.throws(
    () => toMediaLibrary(manifest, {
      ...curated,
      experience: { welcomeVideoSrc: 'https://cdn.example/welcome.mp4' },
    }),
    /experience requires both welcomeVideoSrc and ambientAudioSrc/,
  );
  assert.throws(
    () => toMediaLibrary(manifest, {
      ...curated,
      experience: {
        welcomeVideoSrc: '/welcome.mp4',
        ambientAudioSrc: 'https://cdn.example/ambient.wav',
      },
    }),
    /must be an HTTPS URL/,
  );
});
```

**Step 2: Run the focused test and capture RED**

Run:

```bash
node --test tests/media-library.test.mjs
```

Expected: FAIL because `library.experience` does not exist and partial configuration is not rejected.

**Step 3: Implement exact optional-pair validation**

Add to `src/lib/media-library.mjs`:

```js
function toExperience(value) {
  if (value == null) {
    return { enabled: false, welcomeVideoSrc: null, ambientAudioSrc: null };
  }
  const hasWelcome = typeof value.welcomeVideoSrc === 'string' && value.welcomeVideoSrc.trim() !== '';
  const hasAmbient = typeof value.ambientAudioSrc === 'string' && value.ambientAudioSrc.trim() !== '';
  if (hasWelcome !== hasAmbient || !hasWelcome) {
    throw new TypeError('experience requires both welcomeVideoSrc and ambientAudioSrc');
  }
  return {
    enabled: true,
    welcomeVideoSrc: httpsUrl(value.welcomeVideoSrc, 'experience welcomeVideoSrc'),
    ambientAudioSrc: httpsUrl(value.ambientAudioSrc, 'experience ambientAudioSrc'),
  };
}
```

Change the return value of `toMediaLibrary` to:

```js
return { experience: toExperience(curated.experience), cinema, music, media, youtube };
```

Keep `src/data/curated-media.json` truthful and disabled:

```json
{
  "version": 1,
  "experience": null,
  "music": [],
  "media": [],
  "youtube": []
}
```

**Step 4: Run GREEN and regression tests**

Run:

```bash
node --test tests/media-library.test.mjs
npm test
```

Expected: focused test passes; full suite passes with no fabricated entry asset.

**Step 5: Review without committing**

Run:

```bash
git diff --check
git diff -- src/data/curated-media.json src/lib/media-library.mjs tests/media-library.test.mjs
```

Independent review focus: optional-pair validation, HTTPS enforcement, no active entry gate from null configuration. Do not commit.

---

### Task 2: Build the pure intro-session state machine

**Files:**
- Create: `src/lib/intro-session.mjs`
- Create: `tests/intro-session.test.mjs`

**Step 1: Write the failing state-transition tests**

Create `tests/intro-session.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  beginExperience,
  completeWelcome,
  createIntroSession,
  failAmbient,
  failWelcome,
} from '../src/lib/intro-session.mjs';

const configured = {
  enabled: true,
  welcomeVideoSrc: 'https://cdn.example/welcome.mp4',
  ambientAudioSrc: 'https://cdn.example/ambient.wav',
};

test('missing entry assets start directly in truthful Cinema fallback', () => {
  assert.deepEqual(createIntroSession({ enabled: false }), {
    available: false,
    phase: 'cinema',
    ambientStatus: 'unavailable',
    status: 'CINEMA READY',
  });
});

test('configured assets wait for the explicit visitor gesture', () => {
  const session = createIntroSession(configured);
  assert.equal(session.available, true);
  assert.equal(session.phase, 'awaiting-entry');
  assert.equal(session.ambientStatus, 'ready');
  assert.equal(beginExperience(session).phase, 'welcome');
});

test('the welcome ended event hands the stage to Cinema while ambient continues', () => {
  const entered = beginExperience(createIntroSession(configured));
  assert.deepEqual(completeWelcome(entered), {
    ...entered,
    phase: 'cinema',
    ambientStatus: 'playing',
    status: 'CINEMA LIVE · AMBIENT AUDIO LIVE',
  });
});

test('welcome failure continues to Cinema and ambient failure preserves visuals', () => {
  const entered = beginExperience(createIntroSession(configured));
  assert.equal(failWelcome(entered).phase, 'cinema');
  assert.equal(failWelcome(entered).status, 'WELCOME VIDEO UNAVAILABLE · CINEMA CONTINUING');
  const withoutAmbient = failAmbient(entered);
  assert.equal(withoutAmbient.phase, 'welcome');
  assert.equal(withoutAmbient.ambientStatus, 'failed');
  assert.equal(withoutAmbient.status, 'AMBIENT AUDIO UNAVAILABLE · VISUAL EXPERIENCE CONTINUING');
});

test('invalid repeated transitions are idempotent', () => {
  const fallback = createIntroSession({ enabled: false });
  assert.deepEqual(beginExperience(fallback), fallback);
  assert.deepEqual(completeWelcome(fallback), fallback);
});
```

**Step 2: Run RED**

```bash
node --test tests/intro-session.test.mjs
```

Expected: FAIL with module-not-found.

**Step 3: Implement the pure transition module**

Create `src/lib/intro-session.mjs`:

```js
export function createIntroSession(experience = {}) {
  if (!experience.enabled) {
    return { available: false, phase: 'cinema', ambientStatus: 'unavailable', status: 'CINEMA READY' };
  }
  return { available: true, phase: 'awaiting-entry', ambientStatus: 'ready', status: 'AWAITING VISITOR ENTRY' };
}

export function beginExperience(session) {
  if (!session.available || session.phase !== 'awaiting-entry') return session;
  return { ...session, phase: 'welcome', ambientStatus: 'playing', status: 'VIAIMS EXPERIENCE OPENING' };
}

export function completeWelcome(session) {
  if (session.phase !== 'welcome') return session;
  return { ...session, phase: 'cinema', status: session.ambientStatus === 'playing'
    ? 'CINEMA LIVE · AMBIENT AUDIO LIVE'
    : 'CINEMA LIVE · AMBIENT AUDIO UNAVAILABLE' };
}

export function failWelcome(session) {
  if (session.phase !== 'welcome') return session;
  return { ...session, phase: 'cinema', status: 'WELCOME VIDEO UNAVAILABLE · CINEMA CONTINUING' };
}

export function failAmbient(session) {
  if (!session.available || session.ambientStatus === 'unavailable') return session;
  return { ...session, ambientStatus: 'failed', status: 'AMBIENT AUDIO UNAVAILABLE · VISUAL EXPERIENCE CONTINUING' };
}
```

**Step 4: Run GREEN and full tests**

```bash
node --test tests/intro-session.test.mjs
npm test
```

Expected: all pass.

**Step 5: Review without committing**

```bash
git diff --check
git diff -- src/lib/intro-session.mjs tests/intro-session.test.mjs
```

Independent review focus: actual `ended`-driven state, no timers, welcome and ambient failures independent, disabled fallback truthful. Do not commit.

---

### Task 3: Separate Cinema continuity from audible playback

**Files:**
- Create: `src/lib/cinema-continuity.mjs`
- Create: `tests/cinema-continuity.test.mjs`
- Modify: `src/lib/active-transport.mjs`
- Modify: `tests/active-transport.test.mjs`

**Step 1: Write failing Cinema-continuity tests**

Create `tests/cinema-continuity.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceCinema,
  createCinemaContinuity,
  createCinemaEndedToken,
  isCurrentCinemaEndedToken,
  selectCinema,
} from '../src/lib/cinema-continuity.mjs';

const items = [
  { id: 'atlas-1', src: 'https://cdn.example/1.mp4' },
  { id: 'atlas-2', src: 'https://cdn.example/2.mp4' },
  { id: 'atlas-3', src: 'https://cdn.example/3.mp4' },
];

test('Cinema selection and natural ending wrap independently of audible ownership', () => {
  let cinema = createCinemaContinuity(items);
  assert.equal(cinema.currentId, 'atlas-1');
  cinema = selectCinema(cinema, 2);
  assert.equal(cinema.currentId, 'atlas-3');
  cinema = advanceCinema(cinema, 1);
  assert.equal(cinema.currentId, 'atlas-1');
});

test('Cinema ended token depends on Cinema identity and source, not Music playback', () => {
  const cinema = createCinemaContinuity(items);
  const token = createCinemaEndedToken(cinema, items[0].src);
  const audiblePlayback = { provider: 'music', id: 'song-a', mode: 'audio' };
  assert.equal(isCurrentCinemaEndedToken(token, cinema, items[0].src), true);
  assert.equal(audiblePlayback.provider, 'music');
  assert.equal(isCurrentCinemaEndedToken(token, selectCinema(cinema, 1), items[1].src), false);
});

test('stale ended events cannot advance a newly selected Cinema item', () => {
  const first = createCinemaContinuity(items);
  const stale = createCinemaEndedToken(first, items[0].src);
  const second = selectCinema(first, 1);
  assert.equal(isCurrentCinemaEndedToken(stale, second, items[1].src), false);
});

test('empty Cinema libraries remain safe and inert', () => {
  const cinema = createCinemaContinuity([]);
  assert.equal(cinema.currentId, null);
  assert.equal(advanceCinema(cinema, 1).currentId, null);
});
```

Add one regression test in `tests/active-transport.test.mjs` proving the existing generic token remains scoped to Music Audio only after the component migrates Cinema events to `createCinemaEndedToken`.

**Step 2: Run RED**

```bash
node --test tests/cinema-continuity.test.mjs tests/active-transport.test.mjs
```

Expected: FAIL with module-not-found or missing exports.

**Step 3: Implement Cinema’s independent queue identity**

Create `src/lib/cinema-continuity.mjs`:

```js
function normalizeIndex(length, index) {
  if (length === 0) return -1;
  return ((index % length) + length) % length;
}

function withCursor(state, cursor) {
  const normalized = normalizeIndex(state.items.length, cursor);
  const item = normalized < 0 ? null : state.items[normalized];
  return { ...state, cursor: normalized, currentId: item?.id ?? null, generation: state.generation + 1 };
}

export function createCinemaContinuity(items) {
  const copy = items.map(({ id, src }) => ({ id, src }));
  return { items: copy, cursor: copy.length ? 0 : -1, currentId: copy[0]?.id ?? null, generation: 0 };
}

export function selectCinema(state, index) {
  return withCursor(state, index);
}

export function advanceCinema(state, direction = 1) {
  if (state.items.length === 0) return state;
  return withCursor(state, state.cursor + Math.sign(direction || 1));
}

export function createCinemaEndedToken(state, source) {
  return { id: state.currentId, generation: state.generation, source };
}

export function isCurrentCinemaEndedToken(token, state, source) {
  return token?.id === state.currentId
    && token?.generation === state.generation
    && token?.source === source;
}
```

Do not add sequence/random logic. Do not couple this state to `session.playback`.

**Step 4: Run GREEN and regression tests**

```bash
node --test tests/cinema-continuity.test.mjs tests/active-transport.test.mjs
npm test
```

Expected: all pass.

**Step 5: Review without committing**

```bash
git diff --check
git diff -- src/lib/cinema-continuity.mjs tests/cinema-continuity.test.mjs src/lib/active-transport.mjs tests/active-transport.test.mjs
```

Independent review focus: stale-event immunity, wrap behavior only, no audible-provider dependency, no deferred random logic. Do not commit.

---

### Task 4: Add reversible single-source audible authority

**Files:**
- Create: `src/lib/audible-source.mjs`
- Create: `tests/audible-source.test.mjs`
- Modify: `src/lib/playback-session.mjs`
- Modify: `tests/playback-session.test.mjs`

**Step 1: Write failing handoff tests**

Create `tests/audible-source.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  claimCinemaAudio,
  createAudibleSource,
  restorePriorAudio,
  selectAudibleTrack,
} from '../src/lib/audible-source.mjs';

test('ambient starts as the reversible audible source after entry', () => {
  const state = createAudibleSource({ provider: 'ambient', id: 'viaims-ambient', mode: 'audio' });
  assert.deepEqual(state, {
    current: { provider: 'ambient', id: 'viaims-ambient', mode: 'audio', currentTime: 0 },
    suspended: null,
  });
});

test('claiming Cinema suspends the exact ambient or Music position', () => {
  const music = selectAudibleTrack(createAudibleSource(), {
    provider: 'music', id: 'song-a', mode: 'audio', currentTime: 38.25,
  });
  const cinema = claimCinemaAudio(music);
  assert.deepEqual(cinema.current, { provider: 'cinema', id: null, mode: 'video', currentTime: 0 });
  assert.deepEqual(cinema.suspended, { provider: 'music', id: 'song-a', mode: 'audio', currentTime: 38.25 });
});

test('releasing Cinema restores the exact prior source and position', () => {
  const ambient = createAudibleSource({ provider: 'ambient', id: 'viaims-ambient', mode: 'audio', currentTime: 12.5 });
  const restored = restorePriorAudio(claimCinemaAudio(ambient));
  assert.deepEqual(restored.current, { provider: 'ambient', id: 'viaims-ambient', mode: 'audio', currentTime: 12.5 });
  assert.equal(restored.suspended, null);
});

test('manual Music selection replaces ambient authority and clears stale suspension', () => {
  const state = selectAudibleTrack(claimCinemaAudio(createAudibleSource({
    provider: 'ambient', id: 'viaims-ambient', mode: 'audio', currentTime: 9,
  })), { provider: 'music', id: 'song-b', mode: 'audio', currentTime: 0 });
  assert.equal(state.current.provider, 'music');
  assert.equal(state.current.id, 'song-b');
  assert.equal(state.suspended, null);
});

test('claim and restore are idempotent outside their valid state', () => {
  const empty = createAudibleSource();
  assert.deepEqual(restorePriorAudio(empty), empty);
  const cinema = claimCinemaAudio(empty);
  assert.deepEqual(claimCinemaAudio(cinema), cinema);
});
```

**Step 2: Run RED**

```bash
node --test tests/audible-source.test.mjs tests/playback-session.test.mjs
```

Expected: FAIL with module-not-found.

**Step 3: Implement pure audible authority**

Create `src/lib/audible-source.mjs`:

```js
function normalized(source) {
  if (!source) return null;
  return {
    provider: source.provider,
    id: source.id ?? null,
    mode: source.mode,
    currentTime: Number.isFinite(source.currentTime) ? source.currentTime : 0,
  };
}

export function createAudibleSource(initial = null) {
  return { current: normalized(initial), suspended: null };
}

export function selectAudibleTrack(state, source) {
  return { current: normalized(source), suspended: null };
}

export function claimCinemaAudio(state) {
  if (state.current?.provider === 'cinema') return state;
  return {
    current: { provider: 'cinema', id: null, mode: 'video', currentTime: 0 },
    suspended: normalized(state.current),
  };
}

export function restorePriorAudio(state) {
  if (state.current?.provider !== 'cinema') return state;
  return { current: normalized(state.suspended), suspended: null };
}
```

In `playback-session.mjs`, keep `stageOwner`, stage lease, and tab selection behavior unchanged. Update only names/comments/tests that incorrectly imply `session.playback` is the sole audible authority. The component will use the new audible module for ambient/Music/Cinema toggling; leases remain in `playback-session.mjs`. The preserved `mode` lets the controller restore the matching active transport identity after Cinema audio is released.

**Step 4: Run GREEN and regressions**

```bash
node --test tests/audible-source.test.mjs tests/playback-session.test.mjs
npm test
```

Expected: all pass, including exact Music Video/Media lease restoration tests.

**Step 5: Review without committing**

```bash
git diff --check
git diff -- src/lib/audible-source.mjs tests/audible-source.test.mjs src/lib/playback-session.mjs tests/playback-session.test.mjs
```

Independent review focus: one audible source, exact source/time restoration, manual Music replacement semantics, no stage-lease regression. Do not commit.

---

### Task 5: Replace the masthead with the approved institutional card

**Files:**
- Modify: `src/pages/index.astro`
- Modify: `tests/index-page.test.mjs` (create if absent)

**Step 1: Write failing hierarchy and copy tests**

Create or extend `tests/index-page.test.mjs` to read `src/pages/index.astro` and assert:

```js
test('opening identity uses the approved centered institutional hierarchy', async () => {
  const page = await readFile(pagePath, 'utf8');
  const required = [
    'JUSTIN SCOTT DIXON',
    'VOYAGER INSTITUTE OF AI MUSIC SYSTEMS',
    '(VIAIMS)',
    'AI SYSTEMS ARCHITECT · CREATIVE TECHNOLOGIST',
    'MUSIC / VIDEO PRODUCER',
    'SPATIAL AUDIO ENGINEER · SONGWRITER',
    'SOUND DESIGNER · VISUAL STORYTELLER',
    'INNOVATOR · MOTIVATOR · CREATOR',
  ];
  for (const text of required) assert.match(page, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(page, /data-institutional-identity/);
  assert.match(page, /text-center/);
  assert.doesNotMatch(page, /Principal AI Systems Architect & Creative Technologist bridging/);
  assert.doesNotMatch(page, /A\.K\.A\. VOYAGER/i);
});
```

Also assert the identity appears before `<HybridMediaEngine`.

**Step 2: Run RED**

```bash
node --test tests/index-page.test.mjs
```

Expected: FAIL on missing approved copy and retained long paragraph.

**Step 3: Implement the exact identity card**

Replace only the current `<h1>` and long opening `<p>` block. Preserve the system-status rail in this revision. Use this exact content:

```astro
<div data-institutional-identity class="mx-auto max-w-4xl text-center uppercase">
  <h1 class="text-[clamp(1.5rem,5.8vw,2.375rem)] font-extrabold tracking-[0.025em] text-white leading-tight">
    JUSTIN SCOTT DIXON
  </h1>
  <p class="mt-3 text-sm md:text-base tracking-[0.12em] text-zinc-200">VOYAGER INSTITUTE OF AI MUSIC SYSTEMS</p>
  <p class="mt-1 text-xs md:text-sm tracking-[0.2em] text-zinc-400">(VIAIMS)</p>
  <div class="mt-6 space-y-1.5 text-[11px] md:text-xs font-mono tracking-[0.08em] text-zinc-400 leading-relaxed">
    <p>AI SYSTEMS ARCHITECT · CREATIVE TECHNOLOGIST</p>
    <p>MUSIC / VIDEO PRODUCER</p>
    <p class="pt-2">SPATIAL AUDIO ENGINEER · SONGWRITER</p>
    <p>SOUND DESIGNER · VISUAL STORYTELLER</p>
    <p class="pt-2 text-zinc-300">INNOVATOR · MOTIVATOR · CREATOR</p>
  </div>
</div>
```

**Step 4: Run GREEN and full tests**

```bash
node --test tests/index-page.test.mjs
npm test
```

Expected: all pass.

**Step 5: Review without committing**

```bash
git diff --check
git diff -- src/pages/index.astro tests/index-page.test.mjs
```

Independent review focus: exact approved words/order, no invented title, 24–28 px mobile and 32–38 px desktop cap, centered readable wraps. Do not commit.

---

### Task 6: Rebuild the component hierarchy as stage plus compact player dock

**Files:**
- Modify: `src/components/HybridMediaEngine.astro`
- Modify: `src/styles/hybrid-media-engine.css`
- Modify: `tests/hybrid-media-engine.test.mjs`

**Step 1: Replace old source-shape tests with failing public-structure tests**

In `tests/hybrid-media-engine.test.mjs`, replace the assertion that the command header precedes the stage. Add assertions for this order:

```js
test('stage precedes one integrated player dock containing every command surface', async () => {
  const component = await source(componentPath);
  const stage = component.indexOf('id="master-stage-container"');
  const dock = component.indexOf('data-player-dock');
  const tabs = component.indexOf('data-player-tabs');
  const command = component.indexOf('data-player-command-strip');
  const status = component.indexOf('data-player-status-strip');
  const tray = component.indexOf('data-provider-tray');
  assert.equal(stage > -1 && dock > stage && tabs > dock && command > tabs && status > command && tray > status, true);
  assert.equal((component.match(/data-stage-command-header/g) ?? []).length, 0);
  assert.match(component, /id="now-playing-status"[^>]+aria-live="polite"/s);
});
```

Add CSS-contract assertions:

```js
test('compact trays show six 46px rows and scroll internally', async () => {
  const css = await source(stylePath);
  assert.match(css, /--provider-row-height:\s*46px/);
  assert.match(css, /max-height:\s*calc\(var\(--provider-row-height\)\s*\*\s*6/);
  assert.match(css, /overflow-y:\s*auto/);
  assert.match(css, /overflow-x:\s*hidden/);
  assert.match(css, /min-height:\s*var\(--provider-row-height\)/);
});
```

Add assertions that the stage owns `#cinema-audio-invitation`, the dock owns meters/cart/transport, and Music rows preserve Audio/Video actions.

**Step 2: Run RED**

```bash
node --test tests/hybrid-media-engine.test.mjs
```

Expected: FAIL because the command surface is above the stage and rows have no six-row scroll contract.

**Step 3: Move markup without changing playback behavior yet**

In `HybridMediaEngine.astro`:

- Delete the top-level `data-stage-command-header` section.
- Keep `#master-stage-container` first.
- Keep `#master-mute-btn` during this markup-only slice, add `data-cinema-audio-invitation`, and position it at the stage edge. Task 8 atomically renames the ID and migrates the listener; never place two IDs on one element.
- Immediately after `<audio id="music-audio">`, render one `<section data-player-dock class="player-dock">`.
- Inside it, order: tablist (`data-player-tabs`), command strip (`data-player-command-strip`), status strip (`data-player-status-strip`), then panels wrapped by `data-provider-tray`.
- Move the existing identity, transport, meters, cart, tabs, panels, buy/license, YouTube card, and empty-state markup into that section without deleting current IDs used by the controller.
- Keep `#return-to-cinema` inside the command strip.

The opening tag is exactly `<section data-player-dock class="player-dock" aria-label="VIAIMS media player">`. Its first child is the current complete tablist with `data-player-tabs` added. Its second child is a `div.player-dock__command[data-player-command-strip]` containing the complete current Now Playing identity and complete current transport. Its third child is a `div.player-dock__status[data-player-status-strip]` containing the complete current meters and cart. Its fourth child is a `div.player-dock__tray[data-provider-tray]` containing all four complete current tabpanels. Close the section after the YouTube panel.

**Step 4: Implement the exact compact sizing contract**

In `hybrid-media-engine.css`:

```css
.player-dock {
  --provider-row-height: 46px;
  overflow-x: hidden;
  border: 1px solid rgb(39 39 42);
  background: rgb(9 9 11 / 0.92);
}

.player-dock__command,
.player-dock__status {
  display: grid;
  gap: 0.65rem;
  align-items: center;
  padding: 0.65rem 0.75rem;
  border-bottom: 1px solid rgb(39 39 42);
}

.player-dock__tray [role="tabpanel"] {
  padding: 0.5rem;
}

.media-library__items {
  max-height: calc(var(--provider-row-height) * 6 + 2.5rem);
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
}

.cinema-cue,
.music-product,
.media-cue,
.youtube-cue {
  min-height: var(--provider-row-height);
  max-height: var(--provider-row-height);
}
```

Reduce padding/gaps so each populated item stays 44–48 px. Keep action buttons at least 36 px high and ensure the whole row remains 46 px by using inline actions, ellipsis, and single-line metadata. On narrow screens do not stack each Music product into two rows; use `grid-template-columns:minmax(0,1fr) auto` and shorten action labels only if the accessible name remains `Play <title> audio/video`.

**Step 5: Run GREEN and full tests**

```bash
node --test tests/hybrid-media-engine.test.mjs
npm test
```

Expected: all pass; no controller behavior has intentionally changed yet.

**Step 6: Review without committing**

```bash
git diff --check
git diff -- src/components/HybridMediaEngine.astro src/styles/hybrid-media-engine.css tests/hybrid-media-engine.test.mjs
```

Independent review focus: exact hierarchy, six visible rows, internal scroll, no mobile stacking regression, keyboard-accessible controls. Do not commit.

---

### Task 7: Wire the optional visitor-entry experience

**Files:**
- Modify: `src/components/HybridMediaEngine.astro`
- Modify: `tests/hybrid-media-engine.test.mjs`
- Use: `src/lib/intro-session.mjs`

**Step 1: Write failing component-integration assertions**

Add tests proving:

- `library.experience.enabled` gates the entry overlay.
- The exact label `CLICK TO ENTER THE VIAIMS EXPERIENCE` exists only inside that conditional.
- the welcome source comes from `library.experience.welcomeVideoSrc` and never from a literal placeholder;
- `#ambient-audio` uses `loop` and `preload="metadata"`;
- click calls both ambient `play()` and welcome `play()` from the same synchronous event-handler turn before awaiting their results;
- welcome `ended` calls `completeWelcome` then starts Cinema;
- welcome `error` calls `failWelcome` then starts Cinema;
- ambient rejection calls `failAmbient` but does not pause/replace the visual stage.

**Step 2: Run RED**

```bash
node --test tests/hybrid-media-engine.test.mjs tests/intro-session.test.mjs
```

Expected: FAIL on absent entry integration.

**Step 3: Add conditional markup and media elements**

Inside the stage, before the master video, render only when enabled:

```astro
{library.experience.enabled && (
  <div id="experience-entry-gate" class="experience-entry-gate">
    <button id="enter-viaims-experience" type="button">
      CLICK TO ENTER THE VIAIMS EXPERIENCE
    </button>
  </div>
)}
```

Initialize sources from the validated library:

```astro
<video
  id="master-video"
  src={library.experience.enabled ? library.experience.welcomeVideoSrc : firstCinema?.src ?? ''}
  autoplay={!library.experience.enabled}
  muted
  playsinline
  preload="metadata"
  class="media-master"
></video>
<audio
  id="ambient-audio"
  src={library.experience.ambientAudioSrc ?? ''}
  loop
  preload="metadata"
></audio>
```

Do not set `loop` on the welcome/master video.

**Step 4: Wire one gesture and actual media events**

Import the intro transitions. Put `data-entry-enabled={String(library.experience.enabled)}` on the component root and initialize with `createIntroSession({ enabled: root.dataset.entryEnabled === 'true' })`. Media URLs remain on the validated `src` attributes and are never parsed from arbitrary JSON.

The entry click handler must synchronously initiate both playback promises:

```js
entryButton?.addEventListener('click', () => {
  introSession = beginExperience(introSession);
  entryGate.hidden = true;
  const ambientAttempt = ambientAudio.play();
  const welcomeAttempt = playVideoStack();
  void ambientAttempt.catch(() => {
    introSession = failAmbient(introSession);
    nowPlayingStatus.textContent = introSession.status;
  });
  void welcomeAttempt.catch(() => enqueueTransition(() => continueFromWelcomeFailure()));
});
```

Use named `finishWelcome()` and `continueFromWelcomeFailure()` functions. Both switch to the current Cinema item exactly once; `finishWelcome()` calls `completeWelcome`, while failure calls `failWelcome`. Guard both with `introSession.phase === 'welcome'` so `error` and `ended` racing cannot double-advance.

**Step 5: Run GREEN and regressions**

```bash
node --test tests/hybrid-media-engine.test.mjs tests/intro-session.test.mjs
npm test
```

Expected: all pass. Current real page remains in Cinema fallback because curated experience is null.

**Step 6: Review without committing**

Independent review focus: gesture timing, no timer-based 15-second assumption, failure race, no gate with missing assets, no placeholder URL. Run `git diff --check`. Do not commit.

---

### Task 8: Integrate independent Cinema ending and reversible Cinema audio

**Files:**
- Modify: `src/components/HybridMediaEngine.astro`
- Modify: `src/styles/hybrid-media-engine.css`
- Modify: `tests/hybrid-media-engine.test.mjs`
- Use: `src/lib/cinema-continuity.mjs`
- Use: `src/lib/audible-source.mjs`

**Step 1: Write failing controller-contract tests**

Add source/integration assertions for these public behaviors:

1. Cinema state is initialized with `createCinemaContinuity(videoPlaylist)`.
2. `mv` ended captures `createCinemaEndedToken(cinema, source)` before queueing and validates it inside the queue.
3. When there is no stage lease, valid Cinema ending always calls the Cinema advance path; it does not check `session.playback.provider === 'cinema'`.
4. Music Audio ending still validates against Music playback and advances only Music.
5. `HEAR CINEMA` pauses whichever of ambient/Music is current, records its exact `currentTime`, then unmutes Cinema.
6. `CINEMA AUDIO LIVE` remutes Cinema, restores the stored element/source/time, and starts it.
7. A failed handoff restores the previously audible element and leaves Cinema muted.
8. Music Audio activation never pauses the master Cinema video.
9. The Cinema-audio invitation is disabled and hidden while Music Video or owned Media holds the stage lease.

**Step 2: Run RED**

```bash
node --test tests/hybrid-media-engine.test.mjs tests/cinema-continuity.test.mjs tests/audible-source.test.mjs
```

Expected: FAIL because `mv` ending is still coupled to `session.playback`, and current mute toggling discards exact audible restoration.

**Step 3: Migrate Cinema queue selection**

Replace `currentVidIdx` as the authoritative state with:

```js
let cinema = createCinemaContinuity(videoPlaylist);
```

`currentCinema()` resolves `videoPlaylist[cinema.cursor]`. `switchVideo(index)` first assigns `cinema = selectCinema(cinema, index)`. Natural ending uses `cinema = advanceCinema(cinema, 1)` and then loads `cinema.cursor`.

Replace the `mv` ended block with:

```js
mv.addEventListener('ended', () => {
  if (session.lease) {
    const leaseToken = createEndedEventToken(session.playback, mv.currentSrc || mv.src);
    void enqueueTransition(async () => {
      if (!isCurrentEndedEventToken(leaseToken, session.playback, mv.currentSrc || mv.src)) return;
      await restoreLeasedCinema();
    });
    return;
  }
  const cinemaToken = createCinemaEndedToken(cinema, mv.currentSrc || mv.src);
  void enqueueTransition(async () => {
    if (!isCurrentCinemaEndedToken(cinemaToken, cinema, mv.currentSrc || mv.src)) return;
    cinema = advanceCinema(cinema, 1);
    await activateCinema(cinema.cursor, { preserveAudibleAuthority: true });
  });
});
```

`activateCinema(index, { preserveAudibleAuthority = false } = {})` must not pause ambient/Music or restore Cinema mute when called by natural Cinema continuity. Manual Cinema row selection may change the visual selection while preserving the current non-Cinema audible source; only the dedicated audio invitation changes audible authority.

**Step 4: Implement the dedicated Cinema-audio chip**

Use one stage-edge button:

```astro
<button id="cinema-audio-invitation" type="button" class="cinema-audio-invitation" aria-pressed="false">
  <span aria-hidden="true" class="cinema-audio-invitation__wave"></span>
  <span id="cinema-audio-label">HEAR CINEMA</span>
</button>
```

Delete the old generic mute-label behavior and `savedCinemaMute`. Track the real elements through a helper that maps `audible.current.provider` to `ambientAudio` or `musicAudio`. Before claiming Cinema, copy that element’s `currentTime` into the pure audible state and pause it. On restore, set the same element’s `currentTime` before `play()`. Do not replace its `src` unless Music product identity changed.

The chip is available only when `session.playback.stageOwner === 'cinema'`. Hide and disable it when a Music Video or owned Media lease begins; restore it when the lease releases. The existing `RETURN TO CINEMA` control remains the only lease-release control.

The handoff sequence is transactional:

```js
async function hearCinema() {
  if (session.playback.stageOwner !== 'cinema') return;
  const priorSession = session;
  const priorElement = currentAudibleElement(audible);
  if (priorElement) {
    audible = selectAudibleTrack(audible, { ...audible.current, currentTime: priorElement.currentTime });
    priorElement.pause();
  }
  const prior = audible;
  audible = claimCinemaAudio(audible);
  session = activateSource(session, {
    provider: 'cinema', id: currentCinema()?.id ?? null, mode: 'video', muted: false,
  });
  mv.muted = false;
  try {
    await playVideoStack();
  } catch (error) {
    mv.muted = true;
    audible = prior;
    session = priorSession;
    if (priorElement) await priorElement.play();
    throw error;
  }
  renderCinemaAudioInvitation();
}
```

Implement the reverse with `restorePriorAudio(audible)`, exact `currentTime`, and rollback to Cinema audio if restored playback rejects. When the restored source is Music Audio, also restore `session.playback` with `activateSource(session, { provider: 'music', id, mode: 'audio' })` so Now Playing and active transport return to that Music product. When it is ambient, keep the active transport on muted Cinema while the audible module owns ambient. Keep one audible source throughout.

When manual Music Audio is selected, pause ambient and any other Music playback first, set `audible = selectAudibleTrack(...)`, keep `mv.muted = true`, and do not call `pauseVideoStack()`.

**Step 5: Add the attention cue and reduced-motion fallback**

In CSS, position the chip within the lower stage edge, add a one-time short wave/shimmer animation keyed by a class such as `.is-inviting`, and remove that class on `animationend`. Under `prefers-reduced-motion: reduce`, set `animation:none` and preserve a static gold border/focus indicator. Ensure the chip never relies on color alone: its visible label always says `HEAR CINEMA` or `CINEMA AUDIO LIVE`.

**Step 6: Run GREEN and full regressions**

```bash
node --test tests/hybrid-media-engine.test.mjs tests/cinema-continuity.test.mjs tests/audible-source.test.mjs tests/playback-session.test.mjs tests/media-presentation.test.mjs
npm test
```

Expected: all pass; lease restoration remains exact; Cinema-ended advancement is independent of Music.

**Step 7: Review without committing**

Run `git diff --check` and inspect the complete component diff. Independent review focus: race conditions, stale events, rollback on rejected `play()`, one audible source, Cinema never paused by Music Audio, exact stage-lease restoration. Do not commit.

---

### Task 9: Focused verification, production build, and local macOS visual gate

**Files:**
- No new product files unless a defect is found; any fix returns to RED/GREEN in the owning task.

**Step 1: Run the focused behavior suite**

```bash
node --test \
  tests/media-library.test.mjs \
  tests/intro-session.test.mjs \
  tests/cinema-continuity.test.mjs \
  tests/audible-source.test.mjs \
  tests/playback-session.test.mjs \
  tests/media-presentation.test.mjs \
  tests/active-transport.test.mjs \
  tests/hybrid-media-engine.test.mjs \
  tests/index-page.test.mjs
```

Expected: PASS with zero failures. Record the exact test count.

**Step 2: Run full verification and build**

```bash
npm test
npm run build
git diff --check
git status --short --branch
```

Expected: all tests pass, Astro production build exits 0, diff check exits 0. The status must show only intended revision files plus the pre-existing Task 3 work now incorporated by this revision.

**Step 3: Start a local production preview, not Astro dev/HMR**

```bash
npm run preview -- --host 127.0.0.1 --port 4323
```

Expected: a server backed by the fresh `dist/` build. Do not use `npm run dev` for approval.

**Step 4: Perform local macOS browser review**

Review Safari and Chromium at 1440, 1024, 768, 430, and 390 CSS px. Capture evidence for:

- approved centered identity copy/order and target sizing;
- identity, stage, then dock hierarchy;
- tabs, command strip, pending meters/cart, then tray;
- exactly six rows visible before internal scrolling with real catalogs of at least seven fixture rows;
- no page-level horizontal overflow;
- tab browsing never alters playback;
- Cinema advances after `ended` while Music Audio remains audible;
- Music advances on its own ending without affecting Cinema;
- Music Video/Media lease restores exact Cinema source/time/mute/play state;
- Cinema invitation keyboard focus, brief motion, and reduced-motion state;
- `HEAR CINEMA` and reverse restoration at the exact prior Music/ambient time;
- current real catalog shows no entry gate because welcome/ambient assets are absent.

If any item fails, stop and add a failing automated test for the behavior. For a purely visual CSS defect, add a source-contract assertion for the governing selector/property before changing CSS. Fix via RED/GREEN and repeat Steps 1–4.

**Step 5: Independent final code review**

Provide the reviewer the approved spec, this plan, and `git diff` from `63a2825`. Resolve Critical/Important findings and rerun Steps 1–4. Do not commit.

**Step 6: Stop at the local approval gate**

Report test counts, build result, browser matrix, screenshots, known limitations, and the exact uncommitted file list. Ask Justin for local visual approval. Do not start the remote tunnel/listening gate and do not commit until local approval is explicit.

---

### Task 10: Production-equivalent remote phone and fidelity gate

**Prerequisite:** Justin explicitly approves Task 9’s local macOS gate.

**Files:**
- No product changes unless a defect is found.

**Step 1: Verify immutable media identity**

From the built page and live `https://viaims.com`, record the first tested track URL. Confirm they are identical. For that direct Blob URL, record:

```bash
curl -I '<exact-immutable-wav-url>'
curl -sS -D - -o /dev/null -H 'Range: bytes=0-1023' '<exact-immutable-wav-url>'
```

Expected: identical URL, `Content-Type: audio/wav`, byte-range support, stable content length/ETag or immutable identifier. Do not alter the object.

**Step 2: Audit the audible path**

```bash
rg -n "AudioContext|createMediaElementSource|GainNode|DynamicsCompressor|playbackRate|preservesPitch|mozPreservesPitch|webkitPreservesPitch" src
```

Expected: no processing node or non-default playback-rate/pitch mutation in the audible path. If matches exist, inspect and explain each before proceeding.

**Step 3: Expose only the production preview temporarily**

Keep `npm run preview` serving the fresh `dist/` build. Start a temporary Cloudflare quick tunnel to port 4323 only after explicit approval for that temporary remote access. Configure the preview host allowlist for the generated hostname if Astro rejects it. Do not create DNS, a named tunnel, a deployment, or persistent hosting.

**Step 4: Run the matched same-device A/B listening review**

On the same phone/browser/output route:

- match song, starting position, and playback level;
- compare live versus shadow in short alternating passes;
- listen specifically for high-frequency smearing, transient softening, stereo narrowing, distortion, dropouts, or interruptions;
- confirm Cinema keeps advancing visually while the selected Music WAV remains audible;
- confirm player tray density/scrolling at the phone viewport.

A repeatable fidelity difference is a blocker. Do not attribute it to the tunnel without evidence.

**Step 5: Stop for explicit visual and listening approval**

Report the exact preview URL, source-identity evidence, device/browser/output route, A/B result, and any defects. Shut down the temporary tunnel after review. Do not commit until Justin explicitly approves both visuals and listening.

**Step 6: Commit only after explicit approval**

After approval, rerun:

```bash
npm test
npm run build
git diff --check
git status --short --branch
```

Then stage only the intended implementation and test files and commit:

```bash
git add \
  src/components/HybridMediaEngine.astro \
  src/styles/hybrid-media-engine.css \
  src/pages/index.astro \
  src/data/curated-media.json \
  src/lib/media-library.mjs \
  src/lib/intro-session.mjs \
  src/lib/cinema-continuity.mjs \
  src/lib/audible-source.mjs \
  src/lib/playback-session.mjs \
  src/lib/active-transport.mjs \
  tests/media-library.test.mjs \
  tests/intro-session.test.mjs \
  tests/cinema-continuity.test.mjs \
  tests/audible-source.test.mjs \
  tests/playback-session.test.mjs \
  tests/active-transport.test.mjs \
  tests/hybrid-media-engine.test.mjs \
  tests/index-page.test.mjs
git commit -m "feat: revise VIAIMS entry and compact media player"
```

If an intended file differs from this list, stop and explain before staging it. Report the commit hash, final test count, build result, and clean/dirty status. Do not push, merge, deploy, or begin the mobile-ingestion project.

---

## Plan Self-Review Checklist

- [ ] Every approved design section is covered by a task or an explicit non-goal.
- [ ] No placeholder media, TODO, TBD, “similar to,” or unspecified error path appears in implementation instructions.
- [ ] Welcome completion is event-driven, not timer-driven.
- [ ] Cinema continuity does not consult audible-provider state.
- [ ] Music and Cinema ending events use separate identity tokens.
- [ ] Audible handoff has rollback and exact source/time restoration.
- [ ] Music Video/Media leases remain exact and reversible.
- [ ] Six-row mobile tray sizing and internal scroll are mechanically testable.
- [ ] Entry gate is inactive with the current null asset configuration.
- [ ] Static production preview, not dev/HMR, is used for fidelity review.
- [ ] No implementation commit occurs before explicit visual and listening approval.
- [ ] No push, merge, deployment, hosting, DNS, production, or ingestion action is included.
