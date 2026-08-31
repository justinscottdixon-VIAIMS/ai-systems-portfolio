# VIAIMS YouTube Channel Destination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Present Justin Scott Dixon / Voyager's canonical YouTube channel as the primary branded destination in the YouTube tab while keeping individual curated videos independent and truthful.

**Architecture:** Extend the curated media model with one optional validated channel identity, expose it separately from the individual-video list, and render a compact external channel destination above that list. Do not add an API client, automatic synchronization, embedded playback, or fabricated individual videos.

**Tech Stack:** Astro, ECMAScript modules, JSON configuration, CSS, Node.js `node:test`, static Astro build.

## Global Constraints

- The canonical channel URL is `https://www.youtube.com/@justinscottdixon_voyager`.
- The primary label is `Justin Scott Dixon / Voyager`; the handle is `@justinscottdixon_voyager`.
- Keep `youtubeChannel` independent from the curated `youtube` video array.
- Keep the individual YouTube video list empty until real videos are explicitly curated.
- Open the external channel in a new tab with `rel="noopener noreferrer"`.
- Do not activate the existing YouTube source card, embed host, API integration, or automatic synchronization.
- Do not commit implementation until Justin approves the completed local visual gate.
- Do not push, merge, deploy, modify production, or alter hosting/DNS without separate explicit approval.

---

### Task 1: Channel Model and Presentation

**Files:**
- Modify: `src/data/curated-media.json`
- Modify: `src/lib/media-library.mjs`
- Modify: `src/components/HybridMediaEngine.astro`
- Modify: `src/styles/hybrid-media-engine.css`
- Modify: `tests/media-library.test.mjs`
- Modify: `tests/hybrid-media-engine.test.mjs`

**Interfaces:**
- Produces: `library.youtubeChannel: { title: string, handle: string, href: string } | null`
- Preserves: `library.youtube` as the independent curated individual-video list

- [ ] **Step 1: Write failing library tests**

Add to the curated fixture in `tests/media-library.test.mjs`:

```js
youtubeChannel: {
  title: 'Justin Scott Dixon / Voyager',
  handle: '@justinscottdixon_voyager',
  href: 'https://www.youtube.com/@justinscottdixon_voyager',
},
```

Add assertions:

```js
assert.deepEqual(library.youtubeChannel, {
  title: 'Justin Scott Dixon / Voyager',
  handle: '@justinscottdixon_voyager',
  href: 'https://www.youtube.com/@justinscottdixon_voyager',
});
```

Add:

```js
test('YouTube channel identity requires an HTTPS destination', () => {
  assert.throws(
    () => toMediaLibrary(manifest, {
      version: 1,
      music: [],
      media: [],
      youtube: [],
      youtubeChannel: {
        title: 'Justin Scott Dixon / Voyager',
        handle: '@justinscottdixon_voyager',
        href: 'http://www.youtube.com/@justinscottdixon_voyager',
      },
    }),
    /youtube channel href must be an HTTPS URL/,
  );
});
```

- [ ] **Step 2: Run the library tests to verify RED**

Run:

```sh
node --test tests/media-library.test.mjs
```

Expected: FAIL because `youtubeChannel` is not exposed or validated.

- [ ] **Step 3: Validate and expose the channel identity**

Add to `src/lib/media-library.mjs`:

```js
function toYoutubeChannel(value) {
  if (value == null) return null;
  return {
    title: required(value.title, 'youtube channel title'),
    handle: required(value.handle, 'youtube channel handle'),
    href: httpsUrl(value.href, 'youtube channel href'),
  };
}
```

Return it independently:

```js
return {
  experience: toExperience(curated.experience),
  cinema,
  music,
  media,
  youtubeChannel: toYoutubeChannel(curated.youtubeChannel),
  youtube,
};
```

- [ ] **Step 4: Configure the approved channel without individual fixtures**

Add before the empty `youtube` array in `src/data/curated-media.json`:

```json
"youtubeChannel": {
  "title": "Justin Scott Dixon / Voyager",
  "handle": "@justinscottdixon_voyager",
  "href": "https://www.youtube.com/@justinscottdixon_voyager"
},
```

Keep `"youtube": []` unchanged.

- [ ] **Step 5: Write the failing component test**

Add to `tests/hybrid-media-engine.test.mjs`:

```js
test('YouTube tab leads with the approved channel and keeps curated videos independent', async () => {
  const component = await source(componentPath);
  assert.match(component, /library\.youtubeChannel/);
  assert.match(component, /class="youtube-channel"/);
  assert.match(component, /target="_blank"/);
  assert.match(component, /rel="noopener noreferrer"/);
  assert.match(component, /library\.youtube\.map/);
});
```

- [ ] **Step 6: Render the destination above the independent video list**

At the top of `panel-youtube`, render:

```astro
{library.youtubeChannel && (
  <a
    class="youtube-channel"
    href={library.youtubeChannel.href}
    target="_blank"
    rel="noopener noreferrer"
    aria-label={`Open ${library.youtubeChannel.title} on YouTube`}
  >
    <strong>{library.youtubeChannel.title}</strong>
    <span>{library.youtubeChannel.handle} · OPEN CHANNEL ↗</span>
  </a>
)}
```

Keep the existing `library.youtube.map(...)` rows and truthful empty message beneath it. Do not unhide or activate `youtube-source-card` or `youtube-player-host`.

- [ ] **Step 7: Add compact styling**

Add to `src/styles/hybrid-media-engine.css`:

```css
.youtube-channel {
  display: flex;
  min-height: var(--provider-row-height);
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding-inline: 0.75rem;
  border: 1px solid rgb(181 155 102 / 0.65);
  background: rgb(181 155 102 / 0.08);
  color: white;
  font: 0.6875rem ui-monospace, SFMono-Regular, Menlo, monospace;
}

.youtube-channel span {
  overflow: hidden;
  color: rgb(161 161 170);
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

- [ ] **Step 8: Run focused tests to verify GREEN**

Run:

```sh
node --test tests/media-library.test.mjs tests/hybrid-media-engine.test.mjs
```

Expected: all focused tests pass. Do not commit; record the checkpoint in `.superpowers/sdd/progress.md`.

### Task 2: Build and Local Approval Gate

**Files:**
- Modify: `.superpowers/sdd/progress.md` (ignored evidence)
- Verify only: Task 1 product and test files

**Interfaces:**
- Produces: local visual and command evidence for Justin's approval decision

- [ ] **Step 1: Run full verification**

Run:

```sh
npm test
npm run build
git diff --check
git status --short --branch
```

Expected: all tests pass, Astro builds one static page, diff check emits no output, and no media, hosting, or deployment artifact is staged.

- [ ] **Step 2: Review the YouTube tab locally**

Review the static build in Safari and Chromium at desktop and 390 CSS pixels. Confirm:

- the channel destination appears before the individual-video area;
- the exact label, handle, and URL are correct;
- the empty individual-video message remains truthful;
- the source card and embed host remain inactive;
- the channel row remains compact and does not create horizontal document overflow;
- both browser consoles remain free of errors.

- [ ] **Step 3: Stop for approval**

Present the evidence to Justin. Do not commit implementation, push, merge, deploy, or modify production/hosting until separately approved.
