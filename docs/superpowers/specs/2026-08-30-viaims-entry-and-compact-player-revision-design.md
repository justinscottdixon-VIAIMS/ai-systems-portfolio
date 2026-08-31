# VIAIMS Entry Experience and Compact Player Revision

**Date:** 2026-08-30

**Status:** Approved design; implementation plan pending

**Scope:** Revise the uncommitted adaptive-media foundation before visual approval. This design does not authorize deployment, production changes, media ingestion, push, merge, or hosting changes.

## 1. Purpose

The current shadow player establishes the correct independent provider model, but its mobile command surface and playlist rows are too deep. The controls feel detached from the tabbed library, Cinema stops advancing while Music Audio owns playback, and the development-server listening gate produced a reported high-frequency smearing difference from the live build.

This revision creates one compact player dock beneath the shared stage, preserves independent Cinema and Music continuity, defines a visitor-initiated VIAIMS opening experience for future real assets, and replaces the oversized opening masthead with a centered institutional identity card.

## 2. Non-goals and preserved boundaries

- Do not implement the deferred numeric-series/random-playback preference in this revision.
- Do not fabricate a welcome video, ambient track, music video, owned Media item, or YouTube item.
- Do not activate the entry gate until both the real welcome video and real ambient track are configured.
- Do not implement live YouTube playback, production meters, commerce, checkout, or persistence.
- Do not alter media ingestion, Vercel Blob objects, production hosting, DNS, Publications & Credits, deployment state, or the production site.
- Preserve stable Music product identity and the existing reversible Music Video/Media stage-lease model.

## 3. Opening institutional identity

Replace the oversized left-aligned opening treatment with a compact, centered precision title card. Typography, not excess vertical space, establishes hierarchy.

The approved copy and order are:

```text
JUSTIN SCOTT DIXON
VOYAGER INSTITUTE OF AI MUSIC SYSTEMS
(VIAIMS)

AI SYSTEMS ARCHITECT · CREATIVE TECHNOLOGIST
MUSIC / VIDEO PRODUCER

SPATIAL AUDIO ENGINEER · SONGWRITER
SOUND DESIGNER · VISUAL STORYTELLER

INNOVATOR · MOTIVATOR · CREATOR
```

`VOYAGER INSTITUTE OF AI MUSIC SYSTEMS (VIAIMS)` replaces a separate `A.K.A. VOYAGER` line. The current long opening paragraph is removed from this opening position; its detailed professional context may be presented later in the portfolio.

Mobile name sizing targets approximately 24–28 CSS pixels. Desktop name sizing targets approximately 32–38 CSS pixels. Supporting lines remain readable and may wrap as centered groups rather than shrinking below a practical reading size.

## 4. Visitor-initiated opening experience

The future configured experience begins with one explicit control:

```text
CLICK TO ENTER THE VIAIMS EXPERIENCE
```

The click is the browser-required user gesture for audible playback. It starts the configured ambient track and VI-AIMS welcome video together.

The welcome video:

- is a purpose-made VIAIMS graphic;
- targets approximately 15 seconds;
- plays once and does not loop;
- uses its actual `ended` event as the authoritative handoff to Cinema;
- hands the stage to the normal Cinema playlist at completion.

The ambient track:

- begins from the same entry gesture;
- loops continuously;
- remains the audible source after the welcome video hands the stage to Cinema;
- continues until the visitor manually selects a Music track or explicitly chooses Cinema audio.

If the welcome asset fails after entry, report the failure and continue directly to Cinema. If ambient playback fails, continue the visual experience and report that ambient audio is unavailable. Until both real assets exist in the catalog, the entry gate remains inactive and the current Cinema experience remains the truthful fallback.

## 5. Shared-stage and audible-source behavior

Cinema motion and Music Audio are independent playback continuums.

While ambient or Music Audio is audible:

- the Cinema master and active Mirror Wings remain visually active;
- Cinema audio remains muted;
- a Cinema `ended` event advances immediately to the next Cinema item;
- Cinema advancement does not depend on the active audible provider;
- a Music Audio `ended` event advances only the Music queue;
- Music does not wait for Cinema, and Cinema does not wait for Music.

Music Video and owned Media remain reversible stage leases. A lease parks Cinema at its exact source, time, play/pause state, mute state, aspect state, and mirror state. Releasing the lease restores that state.

The previously discussed numeric-series/random mode is not approved. It remains an unresolved preference in `docs/player-todo.md`.

## 6. Cinema-audio invitation

Cinema starts visually muted while ambient or Music Audio is authoritative. A compact stage-edge chip provides a discoverable invitation:

```text
HEAR CINEMA
```

The chip is anchored inside the lower stage edge without obscuring important imagery. When Cinema begins, it receives a brief directional shimmer or sound-wave pulse, then settles. The treatment is noticeable but not large, persistent, or distracting. It has a textual accessible name, keyboard focus treatment, and a non-animated reduced-motion state.

Activating `HEAR CINEMA`:

- pauses the current ambient or Music track at its exact position;
- makes Cinema the audible source;
- updates the chip to `CINEMA AUDIO LIVE`.

Activating `CINEMA AUDIO LIVE` reverses the handoff:

- remutes Cinema;
- restores the previous ambient or Music track at its saved position;
- returns the chip to `HEAR CINEMA`.

Only one source is audible at a time.

## 7. Compact integrated player dock

The stage immediately follows the institutional title card. The former command surface above the stage is removed.

One unified module beneath the stage contains, in order:

1. Provider tabs: `Cinema | Music | Media | YouTube`.
2. Compact Now Playing and active transport strip.
3. Compact pending-meter and cart status.
4. The active provider tray.

The complete command surface therefore belongs to the tabbed player experience rather than appearing as a separate pre-stage block.

Browsing tabs remains separate from playback. Changing the visible tab never pauses media, changes source, changes queue position, acquires or releases a stage lease, or changes audible authority.

## 8. Compact provider trays

Each populated provider tray shows six visible rows before internal vertical scrolling. Mobile rows target approximately 44–48 CSS pixels in height—roughly half the current depth.

Each row prioritizes:

- concise title;
- compact format or status metadata;
- active-selection indication;
- provider-appropriate activation actions.

Metadata remains on one line where practical and truncates accessibly rather than forcing deep cards. Music retains one stable product row with Audio and optional Video actions. Media and YouTube preserve truthful empty states until real content exists.

The tray owns vertical scrolling. The page must not expand to display every catalog item. Provider tabs remain horizontally scrollable on narrow screens without causing page-level horizontal overflow.

## 9. Fidelity-preserving preview gate

The live build and shadow build resolve the same immutable WAV object URLs. The first verified master is served directly from Vercel Blob as `audio/wav`, supports byte ranges, and is not transported or transcoded by the Cloudflare tunnel.

The prior remote gate used an Astro development server with HMR and development tooling. Future fidelity review must use a freshly built, production-equivalent static preview with no development runtime.

Before approval:

- verify that live and shadow resolve the identical audio object URL;
- verify response content type, length, range support, and immutable source identity;
- confirm no volume, playback-rate, pitch, EQ, compressor, resampler, or meter-processing node enters the audible path;
- compare live and shadow on the same phone, browser, output route, song, and matched playback level;
- specifically listen for high-frequency smearing, transient softening, stereo narrowing, distortion, or interruptions;
- treat a repeatable difference as a blocker rather than expected tunnel behavior.

## 10. Error handling

- Entry assets missing: do not expose a misleading active entry gate; retain current Cinema fallback.
- Welcome failure: report and continue to Cinema.
- Ambient failure: report, retain visual playback, and keep all other controls usable.
- Cinema auto-advance failure: keep the intended new Cinema selection visible in status, offer retry, and do not interrupt Music Audio.
- Audible-source handoff failure: preserve or restore the previously audible source and report the failed transition.
- Provider browsing and empty states never create playback errors.

## 11. Test seams and acceptance gates

Tests target public behavior at these approved seams:

1. Intro-session state: inactive fallback, entry activation, welcome end, and welcome/ambient failure.
2. Independent playback continuity: Cinema advances under ambient/Music Audio while Music advances on its own ending.
3. Audible-source handoff: Cinema-audio activation and exact ambient/Music restoration.
4. Stage leases: existing exact restoration remains intact.
5. Component hierarchy: institutional card, stage, then integrated player dock.
6. Compact tray contract: six visible rows, 44–48-pixel mobile target, internal vertical scrolling, and no page-level overflow.
7. Accessibility: entry control, tabs, transport state, Cinema-audio cue, live status, keyboard operation, and reduced motion.
8. Browser gate: Safari and Chromium at 1440, 1024, 768, 430, and 390 CSS pixels.
9. Fidelity gate: production-equivalent static remote preview and same-device A/B comparison against the live build.

Task completion still requires focused tests, full tests, production build verification, diff hygiene, independent code review, macOS browser review, remote phone review, and Justin's explicit visual and listening approval before the implementation is committed.

## 12. Deferred mobile ingestion project

Phone-accessible media intake and automated playlist publication is a separate project. It will require its own design for authentication, Dropbox or portal intake, validation, naming, provider assignment, Blob transfer, catalog updates, preview approval, failure recovery, and production publication policy. No ingestion implementation is authorized by this revision.
