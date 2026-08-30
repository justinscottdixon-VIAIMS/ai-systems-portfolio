# Adaptive Cinema Stage and Mastering Console Design

**Date:** 2026-08-30

**Status:** Approved visual and interaction design

**Project:** VIAIMS / Justin Scott Dixon portfolio

**Selected directions:** Cinematic Mirror Wings (D) and Mastering Console Shelf (J)

## 1. Context

The portfolio currently presents every video inside a fixed-height, full-width cinema stage. A sharp foreground video uses `object-contain`, while a synchronized, heavily blurred background video fills the remaining frame. This preserves source aspect ratio, but most of the catalog is 9:16. On wide desktop displays, the portrait master occupies only a narrow center column and the blurred surround reads as unused space.

Audio is currently presented as one of three equal operational modules beneath the stage. Its custom native-HTML5 transport is functional, but its placement and scale make the audio work feel secondary to the video stage.

The approved design makes portrait video intentional on wide screens and gives the lossless audio player the visual authority of a mastering console. It preserves the current native playback model and the existing audible-source arbitration rule.

## 2. Goals

1. Keep every master video undistorted and uncropped.
2. Anchor 9:16 video exactly at the horizontal center of the stage.
3. Use synchronized mirrored video wings to turn surplus desktop width into cinematic atmosphere.
4. Preserve native full-width presentation for 16:9 video.
5. Promote audio playback into a substantial, immediately discoverable console directly beneath the video stage.
6. Allow the audio master to play while video motion continues; audio playback mutes only the video's soundtrack.
7. Preserve the portfolio's cyber-minimal, executive AV identity without adding fake meters, generated waveforms, or decorative telemetry that implies measurement.
8. Improve tablet and mobile module distribution without changing the page's three-discipline narrative.
9. Preserve or improve accessibility, failure isolation, and media performance.

## 3. Non-goals

- No Web Audio `AnalyserNode`, `AudioWorklet`, synthetic meter, waveform generator, or PCM processing.
- No video stretching, AI outpainting, invented side imagery, or crop applied to the sharp master.
- No new content-management system or manifest format.
- No change to Vercel Blob ingestion, immutable media keys, or the atomic manifest workflow.
- No sticky player that follows the visitor through the complete page.
- No autoplaying audible audio.
- No redesign of Publications & Credits in this change.

## 4. Approved page hierarchy

The order remains:

1. Header and system telemetry.
2. Adaptive cinema stage.
3. Mastering Console Shelf.
4. Three-module operational deck.
5. Publications & Credits.

The Mastering Console Shelf is a new primary interface layer, not a fourth informational card. It owns active audio transport. The Spatial DSP module remains part of the three-pillar deck but changes purpose from duplicate transport to catalog depth, technical metadata, notes, and the full audio queue.

## 5. Adaptive cinema stage

### 5.1 Aspect classification

After the sharp master video emits `loadedmetadata`, classify its source from `videoWidth` and `videoHeight`:

- `portrait`: width is less than height.
- `landscape`: width is greater than height.
- `square`: width equals height.

Square media uses the portrait composition because it otherwise leaves substantial lateral space. The classifier must be a pure helper with unit tests. The stage exposes the result through a single state attribute such as `data-media-aspect` so CSS owns layout changes.

While a newly selected clip is waiting for metadata, keep the previous stage state only until the new master has enough metadata to classify. Do not flash an incorrect expanded frame. If metadata fails, use the neutral contained-master fallback and hide the mirrored wings.

### 5.2 Portrait and square state

- The sharp master is full-height, centered within one CSS pixel, and rendered with its intrinsic aspect ratio using `object-contain`.
- Two decorative wing videos occupy the left and right sides.
- Both wing videos use the active master source and remain muted, pointer-free, unfocusable, and hidden from the accessibility tree.
- The left wing reflects outward with a horizontal mirror transform; the right wing keeps the corresponding outward crop.
- Wing treatment is deliberately subordinate:
  - approximately 55-65% lower perceived luminance than the master;
  - approximately 35-45% lower saturation;
  - light blur rather than the current 64 px Gaussian wash;
  - feathered masks near the master seam;
  - a dark vignette at the outside edges.
- The master receives no color, blur, brightness, scale, or mirror treatment.
- No metadata badge, title, or transport is added over the master image.

The wing composition should read as a continuous environmental panorama, not as three equal video panels.

### 5.3 Landscape state

- Pause and hide both wing videos.
- Expand the sharp 16:9 master across the complete available stage.
- Preserve `object-contain` and the source aspect ratio.
- Do not retain blurred or mirrored imagery behind a source that already fills the stage naturally.

### 5.4 Stage sizing

- Desktop, 1280 px and above: stage height is bounded from 540 px to 720 px and scales with viewport width.
- Tablet/compact desktop, 768-1279 px: stage height is bounded from 448 px to 576 px.
- Phone, 767 px and below:
  - portrait/square uses a bounded height up to 70% of the small viewport height, with a 640 px maximum;
  - landscape uses a native 16:9 stage ratio;
  - mirrored wings are disabled.

Aspect changes may animate dimensions and opacity, but the transition must not distort the master. Honor `prefers-reduced-motion` by disabling decorative wing motion and aspect-transition animation.

## 6. Wing playback architecture

The sharp master remains the only playback clock and the only semantic video element.

### 6.1 Source and lifecycle

- Wing elements start with `preload="none"` and no active source.
- After a clip is classified as portrait or square, assign the active source to both wings and begin muted playback.
- When switching to landscape, pause the wings, remove them from presentation, and release their active source when safe so landscape playback does not retain unnecessary decoders.
- A video change updates the sharp master first. Wings follow only after the new source is classified.

### 6.2 Synchronization

Propagate master events to both wings:

- play;
- pause;
- seek/scrubber input;
- previous/next selection;
- ±10-second navigation;
- automatic queue advance.

During master `timeupdate`, correct a wing only when its time differs from the master by more than 0.25-0.30 seconds. Avoid continuous assignment that creates unnecessary decode or main-thread work.

The wing elements are always muted regardless of the master video's audible state.

### 6.3 Failure isolation

- A wing load, decode, or play failure must never stop, pause, replace, or delay the sharp master.
- If either wing fails, hide both wings to preserve symmetry and reveal the neutral dark ambient stage background.
- If metadata is unavailable, show only the contained sharp master.
- Rejection from a decorative `play()` promise is handled without surfacing an intrusive error.

## 7. Mastering Console Shelf

### 7.1 Placement and scale

The console sits directly below the cinema stage and above the three-module deck.

- Desktop height: approximately 140-180 px depending on available metadata and queue content.
- Tablet: full width with wrapped metadata and complete controls.
- Phone: full width and fully playable; it must not collapse into a slim mini-player.

The console is visually substantial but lower contrast than the active video master. It should read as precision studio equipment rather than a streaming-service widget.

### 7.2 Required content

The console contains:

1. `02 / SPATIAL DSP MASTER` identity.
2. Active track title.
3. Accurate format/specification text from the media manifest.
4. Lossless/native playback status where supported by known source metadata.
5. Elapsed and total timecode.
6. A large, keyboard-operable scrubber.
7. Previous, −10 seconds, play/pause, +10 seconds, and next controls.
8. Explicit bus state, such as:
   - `AUDIO MASTER LIVE`;
   - `VIDEO MOTION LIVE · VIDEO AUDIO MUTED`.
9. A compact preview of the current track and next two queue entries.

The console must not display a moving waveform, spectrum, level meter, spatial field, or any visualization that is not derived from an approved truthful data source. Native HTML5 audio remains the playback engine.

### 7.3 Spatial DSP module after promotion

Module 02 remains in the operational deck, but no longer duplicates the complete transport. It provides:

- full queue browsing and track selection;
- technical metadata and provenance;
- release/master notes when available;
- count and auto-advance state.

Selecting a track in Module 02 updates and activates the Mastering Console Shelf.

## 8. Audible-source arbitration

Video motion and audible media ownership are separate states.

### 8.1 Required behavior

- Video may continue playing while muted.
- Starting the audio master:
  1. starts or resumes native audio playback;
  2. leaves sharp video and mirrored-wing motion running;
  3. mutes the sharp video's soundtrack if necessary;
  4. leaves both wing videos muted;
  5. updates the visible bus state.
- Deliberately unmuting video while audio is playing:
  1. pauses the audio master;
  2. makes the sharp video the only audible source;
  3. updates both audio and video controls.
- Pausing or ending the audio master does not automatically unmute video. The visitor's explicit video-audio preference is preserved.
- Queue auto-advance for either medium preserves these arbitration rules.

This retains the existing behavior while making it clearer in the interface and tests.

## 9. Responsive operational deck

### Desktop: 1280 px and above

- Three equal columns: Visual Systems, Spatial DSP library, Enterprise AV.

### Tablet/compact desktop: 768-1279 px

- Visual Systems spans the first row because it controls the active cinema stage.
- Spatial DSP and Enterprise AV share the second row.
- Mirrored wings remain visible but use lower opacity and stronger suppression than desktop.

### Phone: 767 px and below

- Mirrored wings are disabled.
- The Mastering Console Shelf remains fully playable.
- Queue preview becomes a horizontal row that can reveal additional cues without narrowing transport controls.
- Modules stack in this order:
  1. Visual Systems;
  2. Spatial DSP;
  3. Enterprise AV.

## 10. Component boundaries

The current `HybridMediaEngine.astro` combines stage markup, visual transport, audio transport, queues, and all interaction code. This change should introduce only the seams needed for testability:

1. **Media aspect helper** — pure classification of source dimensions.
2. **Adaptive stage presentation** — sharp master plus two decorative wing elements and stage state styling.
3. **Mastering console presentation** — active audio metadata and transport controls.
4. **Playback coordinator** — owns playlist indices, synchronization, queue advance, and audible-source arbitration.

The media manifest remains the single source for media URLs, titles, and specifications. Do not create a second playlist or copy metadata into presentation code.

The implementation plan may keep these boundaries in one Astro file if extraction would increase coupling, but the aspect helper and playback state transitions must remain independently testable.

## 11. Accessibility

- The sharp master is the only semantic video.
- Wing videos use `aria-hidden="true"`, `tabindex="-1"`, `muted`, and `pointer-events:none`.
- All console controls have explicit accessible names and visible focus states.
- Play/pause and bus state updates are reflected in button labels and a polite status region without announcing every time tick.
- Scrubbers remain operable by keyboard and expose useful current/min/max values.
- Status is never encoded only by LED color.
- Reduced-motion mode disables decorative wing animation or substitutes a non-moving dark ambient treatment.

## 12. Performance and loading

- Do not preload decorative wings before portrait classification.
- Landscape playback should require only the sharp master decoder.
- Mirror effects use CSS transforms, masks, opacity, and modest blur; avoid canvas drawing or per-frame JavaScript effects.
- Synchronization uses coarse drift correction, not animation-frame polling.
- Existing media connection hints and manifest-backed URLs remain unchanged.
- Test portrait playback on Safari and Chromium with representative high-resolution assets. If two wing decoders cause unacceptable CPU, dropped frames, or thermal load, the approved fallback is one subdued synchronized ambient layer or the neutral gradient—not degradation of the sharp master.

## 13. Testing and acceptance criteria

### Automated tests

1. Aspect classifier covers portrait, landscape, square, zero, missing, and non-finite dimensions.
2. Portrait/square classification activates the mirrored stage state.
3. Landscape classification disables and pauses wing presentation.
4. Audio play mutes video audio without pausing video motion.
5. Video unmute pauses active audio.
6. Audio pause/end does not implicitly unmute video.
7. Audio and video queue advance preserve the audible-source rule.
8. Play, pause, seek, previous/next, and ±10-second operations propagate to active wings.
9. Drift correction occurs only outside the approved threshold.
10. Wing failure leaves the sharp master operational.
11. Manifest parsing, media syncing, and existing queue behavior remain green.

### Visual and interaction acceptance

Test at minimum 1440, 1280, 1024, 768, 430, and 390 CSS-pixel viewport widths with representative 9:16 and 16:9 assets.

- Portrait master is centered within one CSS pixel.
- Sharp master has no distortion, crop, blur, mirror, or color treatment.
- Wings are symmetrical, subordinate, and free of a visible center seam.
- Landscape master uses the complete stage and has no residual wings.
- Mastering console is visible directly beneath the stage and remains fully usable.
- Tablet module distribution matches the approved 1 + 2 layout.
- Phone has no wings and uses the approved module order.
- Only one audible source can exist.
- Video motion continues during audio-master playback.
- No control overlap, horizontal page overflow, inaccessible focus target, or clipped timecode occurs.
- Reduced-motion and decorative-video failure fallbacks remain legible and functional.

### Completion gate

Before deployment:

- all automated tests pass;
- the production Astro build succeeds;
- `git diff --check` succeeds;
- existing media interaction QA is rerun for both aspect classes;
- Safari and Chromium playback are manually checked;
- no measurable regression is accepted in sharp-master playback caused by decorative wings.

## 14. Delivery boundary

This design authorizes implementation of the adaptive cinema stage, mastering console, responsive operational deck, and associated tests. It does not authorize changes to portfolio credits, public claims, media assets, domain configuration, or hosting infrastructure.
