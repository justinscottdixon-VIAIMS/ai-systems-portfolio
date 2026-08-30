# Tabbed Media Library and Adaptive Music Player Design

**Date:** 2026-08-30

**Status:** Approved interaction design; implementation pending

**Project:** VIAIMS / Justin Scott Dixon portfolio

**Supersedes:** The Mastering Console Shelf and audio non-goals in `2026-08-30-adaptive-cinema-and-audio-console-design.md`. The approved Cinematic Mirror Wings design remains in force.

## 1. Decision summary

The portfolio will use one shared presentation stage, one compact Stage Command Header, and one tabbed Media Library with four independent catalog providers:

1. `Cinema`
2. `Music`
3. `Media`
4. `YouTube`

The tabs change which catalog the visitor is browsing. They do not change playback by themselves. Playback changes only when the visitor explicitly activates an item.

The Music catalog is a portable, site-wide product-aware player. It supports audio masters, optional music-video assets, a visible queue, transport controls, shuffle/repeat behavior, real browser-derived engineering meters, and a bridge to store/cart functionality.

Music videos and YouTube presentations may temporarily lease the shared stage. They never enter the Cinema hierarchy. When a lease ends, the prior cinematic source and presentation state are restored.

## 2. Baseline and replacement boundary

The approved Cinematic Mirror Wings stage in commit `84816cd` remains the visual-stage foundation.

The Mastering Console Shelf introduced in commit `beecd4b` was rejected as the final music-player design. Its implementation may be reused only where it matches this specification. Its hierarchy, transport-free library assumption, and native-audio-only non-goal are superseded.

No Mastering Console Shelf replacement may be implemented until this design and its replacement implementation plan are approved.

## 3. Goals

1. Preserve the undistorted adaptive cinema stage and Cinematic Mirror Wings.
2. Keep Cinema, Music, Media, and YouTube catalogs structurally independent.
3. Let visitors browse any catalog without interrupting current playback.
4. Let audio-only music play while cinema motion continues silently.
5. Let music videos temporarily use the main stage without becoming Cinema items.
6. Restore the exact prior cinema source, time, play/pause state, mute state, and mirror presentation when a music-video lease ends.
7. Provide a visible music playlist with direct audio/video mode selection, previous/next, seek, shuffle, repeat, and automatic progression.
8. Display truthful stereo L/R sample peak, RMS, peak hold, and clip indication derived from the audible browser signal.
9. Keep track/product identity stable across playback, cart, licensing, checkout, and download workflows.
10. Keep the player portable across the portfolio and store pages while preserving its queue and current playback state.
11. Provide a responsive mobile layout without merging or hiding catalog identity.

## 4. Non-goals

- No simulated meters, decorative meter motion, inferred loudness, or fabricated audio telemetry.
- No LUFS, true-peak, stereo-correlation, spectrum, waveform, or phase display in this phase.
- No attempt to extract, separate, download, or analyze raw audio from YouTube embeds.
- No merging of music videos into the Cinema manifest, playlist, folder hierarchy, or queue.
- No merging of Media or YouTube items into the Cinema hierarchy.
- No pricing, license selection, checkout, entitlement, or download ownership inside the player module.
- No production deployment, domain change, hosting change, or media-ingestion change in this implementation slice.
- No changes to Publications & Credits.

## 5. Approved page hierarchy

The primary media hierarchy is:

1. Header and system telemetry.
2. Stage Command Header.
3. Shared presentation stage with Cinematic Mirror Wings where eligible.
4. Tabbed Media Library.
5. Remaining portfolio content and Publications & Credits.

### 5.1 Stage Command Header

The Stage Command Header sits directly above the shared presentation stage. On desktop it uses three horizontal regions; on phone it compacts into three stacked rows.

It contains:

- active source type and Now Playing identity;
- active title and time/queue position where available;
- compact previous, play/pause, next, shuffle, and repeat controls when the active source supports them;
- stereo engineering meters for meterable native sources;
- explicit source/bus state;
- a compact cart count;
- `Return to Cinema` while a non-cinema source holds a stage lease.

The header describes the active playback source, not merely the currently browsed tab.

## 6. Tabbed Media Library

The Media Library presents one tab bar:

`Cinema | Music | Media | YouTube`

Each tab owns its own catalog model, current selection, queue semantics, labels, and actions. The shared shell does not flatten the data into one universal playlist.

### 6.1 Browse state is independent of playback state

- Selecting a tab changes only the visible catalog.
- Switching tabs never pauses, starts, replaces, mutes, or seeks active playback.
- Playback changes only after an explicit item action such as `Play`, `Audio`, `Video`, or `Present`.
- The active playback source remains identified in the Stage Command Header even when its catalog tab is not visible.
- Returning to a tab restores its prior browsing position and selection.

### 6.2 Cinema provider

Cinema contains curated cinematic films only. It owns the cinematic playlist, cinematic queue, and the long-lived fallback state of the shared stage.

Selecting a Cinema item:

- releases any active external or music-video stage lease;
- loads the selected cinematic source;
- updates Cinema queue state;
- applies the existing portrait/square/landscape mirror-wing rules;
- does not add or remove Music, Media, or YouTube items.

### 6.3 Music provider

Music uses one stable track/product identity per song. A track contains:

- stable product ID;
- title and artist/credit metadata;
- required audio-master asset;
- optional music-video asset;
- technical format metadata;
- store route or product reference;
- optional artwork and descriptive metadata.

One playlist row represents one song. When a music-video asset exists, the row exposes separate `Audio` and `Video` actions without duplicating the song.

The Music queue provides:

- visible multiple-track selection;
- previous and next;
- play/pause;
- bounded seek controls and scrubber where appropriate;
- shuffle that preserves the current track and randomizes upcoming items;
- Repeat Off, Repeat All, and Repeat One;
- automatic next-track progression;
- an unchanged queue position when switching between a song's Audio and Video modes.

The Music queue and current playback state persist when navigating to the store page.

### 6.4 Media provider

Media contains owned non-cinematic visual content, including:

- reels;
- interviews;
- behind-the-scenes material;
- demonstrations;
- short-form clips.

Media items remain outside the Cinema hierarchy. An activated Media item uses the shared stage through its own presentation contract and must not mutate the Cinema or Music queues.

### 6.5 YouTube provider

YouTube contains curated externally hosted YouTube selections. Selecting the tab shows its catalog but does not start playback.

Selecting a YouTube item produces two presentation states:

1. **Source card:** the native stage is parked behind an opaque card that identifies YouTube as the external presentation source and offers an explicit `Present Selected Video` action. No YouTube video plays behind the card.
2. **Visible player:** activation replaces the source card with a fully visible YouTube embedded player in the shared-stage footprint. YouTube controls, branding, attribution, and the complete player viewport remain unobscured.

While YouTube is active, its source status appears outside the player frame. Returning to another activated provider releases the YouTube presentation and restores the appropriate native stage state.

Because the YouTube iframe does not expose decoded PCM to the host page, the engineering meters must show `External Source · Metering Unavailable`. They must not animate from simulated values.

## 7. Playback state model

### 7.1 Cinema Only

- Cinema owns the shared stage.
- Cinema source, position, play/pause, mute, and mirror state are live.
- Cinema is audible only when its mute state is off.

### 7.2 Music Audio plus Cinema Motion

- The native audio master is the authoritative audible source and playback clock.
- Cinema motion may continue.
- Cinema audio is forced silent while music audio owns the audible bus.
- The engineering meters analyze the music audio master.
- The prior Cinema mute state is saved for later restoration.

If the Music queue advances, music remains in control. When the queue reaches its true end with Repeat Off, Music releases the audible bus and restores the saved Cinema mute state. If Cinema was previously audible, its soundtrack returns; if it was muted, it remains muted.

### 7.3 Music-Video Stage Lease

Selecting a song's `Video` action:

1. snapshots the Cinema source, playback position, play/pause state, mute state, and mirror presentation;
2. pauses or stops any separate music audio master;
3. leases the shared stage to the music-video asset;
4. makes the embedded music-video soundtrack the only audible source and the authoritative clock;
5. routes that soundtrack through the browser-derived meters;
6. exposes `Return to Cinema`.

Selecting another music video retains the lease and switches directly.

The lease releases automatically when:

- the music video ends;
- the listener selects an audio-only track or Audio mode;
- the listener presses `Return to Cinema`;
- the listener explicitly activates a Cinema item.

On release, the exact saved Cinema state is restored. Music videos never enter the Cinema playlist or manifest hierarchy.

### 7.4 Media presentation

An activated Media item uses the shared stage without entering the Cinema hierarchy. It uses the same snapshot/restore lease primitive as a music video:

1. snapshot the exact prior Cinema state;
2. lease the stage to the selected owned Media clip;
3. make the clip's native soundtrack authoritative and meterable;
4. retain the lease when switching directly to another Media clip;
5. release and restore Cinema when the clip ends, `Return to Cinema` is pressed, or another provider is explicitly activated.

### 7.5 YouTube presentation

The YouTube embed is authoritative for its own playback and audible soundtrack. Starting YouTube must stop or pause any native audible source so only one source is audible. The host may observe supported player state events but does not claim access to its PCM signal.

## 8. Engineering meters

Meters are visible in the Stage Command Header for native audio and native music-video sources.

Required measurements:

- stereo left/right sample peak;
- stereo left/right RMS;
- peak hold with a defined decay or reset policy;
- independent left/right clip indicators.

Required behavior:

- values derive from the exact native source the visitor hears;
- analysis uses modest browser processing cost;
- meter work starts only after user-authorized playback and a resumed `AudioContext`;
- analysis pauses or disconnects when no meterable source is active;
- source switching reconnects the graph without creating stacked audio paths or gain changes;
- failure to initialize metering never blocks playback;
- meter failure produces an explicit unavailable state, not decorative motion;
- YouTube always uses the explicit external-source unavailable state.

The implementation plan must choose a tested Web Audio graph that preserves native output level and avoids double-routing.

## 9. Commerce and portability boundary

The player owns:

- current Music queue and ordering;
- active track/product ID;
- Audio versus Video mode;
- playback position and transport state;
- meter state;
- compact cart count;
- `Buy / License` navigation for the selected track.

The store page owns:

- product pricing;
- license or buyout choices;
- cart contents and mutations;
- checkout;
- entitlement;
- download delivery.

The same stable product ID links player selection to store selection. Cross-page persistence must not require duplicating media assets or catalog identities.

The player must be implementable as a portable module with an explicit state contract rather than page-specific DOM queries spread through unrelated sections.

## 10. Responsive behavior

### Desktop and wide tablet

- Stage Command Header uses a horizontal Now Playing / transport / meters arrangement.
- The shared stage retains the existing adaptive mirror presentation.
- The Media Library occupies full width beneath the stage.
- The tab bar remains visible and the active provider's catalog uses the available width.

### Phone

- Stage Command Header stacks Now Playing/cart, mini transport, and stereo meters.
- Mirrored wings remain disabled under the existing stage breakpoint.
- The shared stage remains directly below the command header.
- The four-tab bar remains a single identifiable control and may scroll horizontally if needed.
- Only the selected catalog panel is rendered as active, but catalog identity and selection are preserved independently.
- Music rows retain separate Audio and Video actions without horizontal page overflow.
- YouTube player dimensions comply with its minimum viewport and visibility requirements.

## 11. Accessibility

- Tabs use correct tablist, tab, and tabpanel semantics with keyboard navigation.
- Moving between tabs does not trigger playback.
- The active playback source is exposed separately from the selected tab.
- Every Audio, Video, Play, Present, Return, shuffle, and repeat action has an explicit accessible name and visible focus state.
- Now Playing and lease-state changes use a polite status region; meter ticks and time updates are not continuously announced.
- Meter state is conveyed in text as well as color.
- Clip indicators can be reset with an accessible action if the peak-hold policy supports reset.
- The YouTube iframe has a meaningful title and remains fully operable.
- Reduced-motion behavior from the Cinematic Mirror Wings design remains in force.

## 12. Failure isolation

- A metering initialization or processing failure cannot stop playback.
- A music-video failure releases the stage lease and restores Cinema state.
- A YouTube load, playback, or API failure leaves the source card available with a clear recovery state.
- A Media item failure cannot mutate the Cinema or Music queue.
- Cross-page persistence failure falls back to a safe initial Music state without corrupting cart data.
- Existing mirror-wing failure isolation remains in force.

## 13. Data and component boundaries

The implementation plan should introduce explicit seams for:

1. **Catalog providers** — Cinema, Music, Media, and YouTube adapters with independent item schemas.
2. **Playback coordinator** — active source, audible-bus ownership, stage lease, snapshot/restore, and explicit activation.
3. **Music queue** — shuffle/repeat/advance and Audio/Video mode without product duplication.
4. **Stage presentation** — native cinema/music/media elements plus external YouTube presentation state.
5. **Meter engine** — native-source Web Audio attachment and truthful measurement state.
6. **Portable player state** — serializable cross-page Music state and stable product identity.
7. **Commerce adapter** — product navigation and cart-count read model without checkout ownership.

The existing media manifest may remain the source for current Cinema and audio assets, but this design explicitly permits provider-specific catalog structures where one flat manifest would erase domain distinctions.

## 14. Test and acceptance requirements

### Automated behavior

Tests must cover at minimum:

1. Tab changes update browse state without changing playback.
2. Each provider preserves its own selection and queue state.
3. A Music product exposes one entry with Audio and optional Video modes.
4. Audio-only playback forces Cinema audio silent without pausing Cinema motion.
5. Audio queue completion with Repeat Off restores the saved Cinema mute state.
6. Music-video activation snapshots Cinema and acquires a stage lease.
7. Music-video switching retains the lease.
8. End, Audio selection, Return to Cinema, and Cinema activation release the lease and restore exact Cinema state.
9. Native music-video soundtrack is the authoritative clock and meter source.
10. Only one audible source exists across Cinema, Music audio, music video, Media, and YouTube transitions.
11. Sample peak, RMS, peak hold, and clip logic use deterministic signal fixtures.
12. Meter initialization failure leaves playback operational and visibly unavailable.
13. YouTube state never claims real meter values.
14. YouTube selection shows a source card before explicit presentation.
15. Visible YouTube playback has no overlay covering the iframe.
16. Music queue and stable product ID survive the defined cross-page serialization boundary.
17. Buy / License sends the selected stable ID to the store route without owning checkout.
18. Existing Cinematic Mirror Wings behavior remains green.

### Visual and interaction acceptance

Validate at 1440, 1280, 1024, 768, 430, and 390 CSS pixels:

- command header, shared stage, and tabbed library read as one hierarchy;
- tab labels remain legible and keyboard/touch operable;
- changing tabs never interrupts playback;
- Music Audio and Video actions remain distinct;
- meters remain readable without dominating the cinema stage;
- real meter movement corresponds to active native audio;
- external-source metering state is explicit for YouTube;
- YouTube source card and visible-player states are visually distinct;
- the YouTube player is never covered or obscured;
- no horizontal page overflow or clipped controls occur;
- cart count and Buy / License remain available without implying checkout ownership.

### Completion gate

Before requesting visual approval:

- focused RED/GREEN tests pass;
- the complete test suite passes;
- the production Astro build passes;
- `git diff --check` passes;
- Safari and Chromium are manually checked on macOS;
- phone-width behavior is reviewed through a remote-accessible preview when needed;
- no production, DNS, hosting, media-ingestion, push, merge, or deployment action occurs without separate explicit approval.

## 15. Delivery boundary

This design authorizes a replacement implementation plan for the Stage Command Header, tabbed Media Library, Music playback/queue/metering, stage leases, provider boundaries, and commerce bridge.

It does not authorize production publication, hosting changes, store checkout implementation, media acquisition, YouTube data scraping, deployment, merge, or push.
