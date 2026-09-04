# VIAIMS Mobile Portrait Fullscreen and Tagged Music Visuals Design

**Date:** 2026-09-03

**Status:** Approved in conversation; implementation plan written
**Scope:** Add a portrait-only mobile video catalogue, a branded mobile fullscreen transport, deterministic Music display-title formatting, and reusable tag-triggered Music visuals. This design does not authorize commit, push, merge, production deployment, DNS changes, or production-manifest publication.

## 1. Purpose

The mobile portfolio needs an intentional portrait-video experience rather than a scaled version of the desktop stage. Viewers must be able to enter a branded fullscreen presentation without surrendering VIAIMS transport control. Music titles must display consistently without erasing creative capitalization, and multiple songs must be able to trigger one reusable visual through an explicit filename tag.

This design preserves the existing independent Cinema and Music continuums. Music remains the audible authority when a song is playing. The fullscreen image may be a tagged Music visual or muted Cinema without changing which queue owns Music transport.

## 2. Preserved boundaries

- Reuse the existing master video, Cinema continuity, Music queue, audible-source arbitration, and reversible stage-state patterns.
- Do not create a second audible source for a Music visual. Tagged visuals are always muted.
- Do not rename source media during ingestion.
- Do not infer creative capitalization when an authoritative title override exists.
- Do not expose landscape, square, or unknown-aspect video as playable mobile catalogue items.
- Do not make the mobile fullscreen project responsible for production meters, commerce, portfolio narrative sections, mobile upload authentication, or production release.

## 3. Mobile video eligibility

The existing layout breakpoint at a maximum width of 767 CSS pixels defines the mobile catalogue policy.

Every native video manifest item must carry validated dimensions and a derived aspect classification. On mobile:

- only `portrait` items appear in browsable video lists and provider playback queues;
- `landscape`, `square`, and `unknown` items are absent rather than disabled;
- Previous, Next, automatic advance, and empty-state decisions consume the same filtered queue;
- an empty portrait queue produces a truthful unavailable state and never falls back to an ineligible video.

Desktop retains every otherwise valid video. The rule applies to Cinema, owned Music Video, owned Media, and reusable tagged Music visuals whenever those providers are available on mobile. YouTube remains an external destination and does not enter the native fullscreen queue.

Dimensions are ingestion metadata, not filename guesses. A video whose dimensions cannot be validated is `unknown` and is therefore excluded on mobile.

## 4. Fullscreen presentation model

Fullscreen is entered only through a dedicated, accessible button. Starting video playback never forces fullscreen.

The fullscreen shell contains the existing authoritative stage and media elements. Entering or leaving fullscreen must not restart the active source, seek it, change its mute state, change queue identity, or acquire a second playback authority.

The controller uses two presentation paths behind one state model:

1. On browsers that support fullscreening the complete stage wrapper, request element fullscreen from the visitor gesture.
2. On iPhone or when element fullscreen is unavailable or rejected, use a fixed, safe-area-aware `100dvh` viewport takeover.

The fallback is intentionally called fullscreen in the interface even though mobile browser chrome may remain visible. Both paths expose identical VIAIMS controls and state. The complete portrait frame uses `object-fit: contain`, remains centered, and is never cropped to fill the device.

The explicit states are:

- `inline`;
- `fullscreen-controls-visible`;
- `fullscreen-controls-hidden`.

Native `fullscreenchange` and `fullscreenerror` events reconcile browser state. A rejected request falls back to the viewport takeover. An unexpected fullscreen exit returns to the inline presentation without interrupting playback.

## 5. Inline and fullscreen transport

The inline mobile transport contains:

- Previous;
- Play/Pause;
- Next;
- Mute/Unmute where applicable;
- Enter Fullscreen;
- a seek/scrub control;
- elapsed time;
- remaining time.

The seek control is exclusive to the inline transport. Elapsed and negative remaining time remain visible continuously while inline. Unknown duration displays `--:--` rather than a guessed value.

The fullscreen overlay contains:

- Exit Fullscreen;
- Previous;
- Play/Pause;
- Next;
- Mute/Unmute;
- read-only elapsed time;
- read-only remaining time;
- the active formatted title.

The bottom transport uses a soft, floating dark-glass visual language: a rounded primary capsule groups Previous, Play/Pause, and Next; a second rounded utility capsule groups Mute/Unmute with the read-only elapsed and remaining time. Controls use crisp white icons rather than boxed text labels, retain at least 44-by-44 CSS-pixel touch targets, and expose their state through accessible names. Exit Fullscreen is a separate circular glass icon at the upper-right. The translucent capsules may blur supported backdrops but must retain a legible opaque-dark fallback.

Fullscreen never exposes a scrubber, swipe-to-seek gesture, or tap-to-seek surface. Tapping the image reveals controls without pausing or seeking.

While playing, fullscreen controls remain visible for three seconds after the last relevant interaction and then fade. They remain visible while paused. The elapsed time, remaining time, and title are visible only while the fullscreen transport is visible.

The title appears transparently at the upper-left inside the device safe area. It uses at most two lines, never marquee-scrolls, and does not receive a separate opaque box. After the transport times out, the title begins a 1.25-second fade with the overlay. A new interaction cancels the pending fade and restores the complete overlay.

Transport ownership follows the audible provider. When Music is audible, fullscreen Previous and Next navigate the Music queue even if muted Cinema supplies the fullscreen image.

## 6. Global Music row action label

Every Music track-row action currently labeled `AUDIO` becomes `PLAY`. The visible label and accessible action name must remain synchronized with actual playback state and product identity. Provider/type metadata may still identify the asset as MP3 or audio; only the row action label changes.

## 7. Music display-title formatter

Formatting changes presentation metadata only. It never renames the source file, changes its stable identity, or changes playlist order.

The automatic formatter:

1. removes the file extension and a leading numeric order marker;
2. extracts and removes the reserved `VIZ-` tag before display cleanup;
3. removes an existing outer `V_` prefix and trailing framing underscore before rebuilding them once;
4. replaces structural filename separators with readable spaces;
5. removes only recognized technical tokens such as mastering markers, sample-rate/bit-depth markers, copy suffixes, stem markers, and version identifiers;
6. preserves tokens containing intentional mixed or unusual capitalization, such as `manIA`;
7. capitalizes ordinary all-lowercase words for the initial generated title;
8. emits the result using the global `V_<creative title>_` frame.

Representative results:

```text
1._metafysion one.mp3                    -> V_Metafysion One_
V_edges fade_voo1.1.2_48k24b_mstr.mp3   -> V_Edges Fade_
V_manic_manIA__mstr.mp3                  -> V_Manic manIA_
```

Automation must be conservative. A tracked Music metadata sidecar may provide an exact display-title override. The override is authoritative, still receives one `V_..._` frame, and is used consistently in playlist rows, the active Music identity, fullscreen presentation, and accessible labels.

## 8. Reusable filename-tagged Music visuals

Multiple songs may trigger one reusable Music visual through a reserved filename token:

```text
V_manic manIA__VIZ-VOID.mp3
V_motion mine__VIZ-VOID.mp3
```

Reusable visual files live in a system-only library:

```text
media-ingest/Media/Music-Visuals/VIZ-VOID.mp4
```

The canonical tag is the uppercase, URL-safe `VIZ-<NAME>` token. Matching is case-insensitive at ingestion and resolves to one canonical uppercase tag. A track may declare no more than one visual tag. Duplicate tags, ambiguous matches, a tag without a matching visual, or multiple visual files for one canonical tag fail validation before upload or manifest replacement.

The `Music-Visuals` directory is not a normal Media provider playlist. Its files are referenced only through validated Music visual tags. An optional metadata-sidecar alias may map a legacy tag to a canonical tag, but direct matching remains the default.

On mobile, a matching visual must be portrait. An ineligible or failed visual never blocks its MP3; Music continues audibly and the stage uses the normal muted-Cinema fallback.

## 9. Tagged-visual playback lifecycle

The MP3 is always the authoritative clock, audible source, and Music transport target. A tagged visual is a separate muted presentation layer that bypasses Cinema playback ownership without mutating the Cinema queue.

When a tagged song starts:

- resolve the canonical visual tag;
- prepare the associated muted video;
- present it in the shared fullscreen/inline stage;
- loop it when it is shorter than the song;
- keep Music Play/Pause, Previous, Next, elapsed time, and remaining time bound to the MP3.

When consecutive songs use the same visual tag, the visual continues seamlessly. It does not restart, seek, flash, or reacquire the source at the track boundary. Changing to a different tag prepares and activates the new tagged visual.

When a tagged song ends and automatic Music advance selects an untagged song:

1. keep fullscreen active;
2. start the next eligible Cinema video muted from `00:00` underneath the current tagged visual;
3. keep the new MP3 audible and uninterrupted;
4. fade only the tagged visual to transparent;
5. reveal the already-started Cinema video directly;
6. remove the tagged visual after the fade completes.

There is no separate Cinema fade-in and no intentional fade-to-black. If Cinema cannot be prepared, the visual may fade to the stage's truthful unavailable background while Music continues.

While untagged Music is audible over muted Cinema, fullscreen Previous and Next continue to navigate Music. Cinema visual progression remains independent and does not take audible transport ownership.

## 10. Failure and interruption behavior

- Fullscreen request rejection: enter the fixed viewport fallback and report no false failure if that fallback succeeds.
- Unexpected fullscreen exit: return to inline state with the same source, time, queue, and audible authority.
- Tagged visual missing or invalid: reject publication during ingestion when detectable; at runtime continue Music and use muted Cinema.
- Tagged visual runtime failure: isolate the visual, preserve Music, and reveal or start the eligible muted-Cinema fallback.
- Cinema fallback failure: preserve Music, show a truthful visual-unavailable state, and keep transport usable.
- Stale readiness, error, ended, or fade completion from a superseded visual cannot mutate the current presentation.
- Duration unavailable: show `--:--`; do not expose an enabled scrubber until seeking is valid.
- Mobile portrait queue empty: do not expose fullscreen entry for an unavailable native visual.

## 11. Accessibility and reduced motion

- All buttons have state-derived accessible names and at least a 44-by-44 CSS-pixel touch target.
- Fullscreen entry moves focus into the overlay without trapping it permanently; exit restores focus to the entry button.
- The visible title and accessible media identity use the same formatted title.
- Time updates do not create continuous screen-reader announcements.
- The fullscreen shell respects safe-area insets and device zoom.
- Reduced motion shortens or removes decorative easing but retains a brief tagged-visual opacity transition so ownership changes remain understandable. Playback state never depends on animation completion alone.

## 12. Test seams and approval gates

Strict RED/GREEN tests cover:

1. dimension-derived portrait eligibility and identical display/playback filtering;
2. fullscreen state transitions, native-event reconciliation, viewport fallback, and focus restoration;
3. source/time/mute/queue continuity across entry and exit;
4. three-second control visibility, paused persistence, and 1.25-second title fade;
5. absence of fullscreen seeking and presence of inline seeking;
6. elapsed and remaining time formatting, including unknown duration;
7. Music-owned fullscreen Previous/Next while tagged visual or muted Cinema is visible;
8. `AUDIO` to `PLAY` label replacement and accessible naming;
9. deterministic title cleanup, creative capitalization preservation, outer framing, and exact override behavior;
10. `VIZ-` extraction, canonical matching, validation failures, and hidden system-library behavior;
11. seamless same-tag continuity, different-tag replacement, and stale-event guards;
12. tagged-to-untagged automatic advance with next-Cinema start at `00:00` and a single visual fade-out;
13. visual and Cinema failure fallbacks that never interrupt Music;
14. focused tests, complete automated suite, default production build, preview-manifest build, and diff hygiene;
15. independent Critical/Important review;
16. local Safari and Chromium checks at 390 and 430 CSS pixels;
17. remote iPhone approval using portrait Cinema, same-tag consecutive Music, tagged-to-untagged Music, and failure recovery fixtures.

No implementation is approved for commit, push, merge, production deployment, production manifest replacement, hosting, or DNS changes by this design.
