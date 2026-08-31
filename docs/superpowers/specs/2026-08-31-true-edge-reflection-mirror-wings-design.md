# VIAIMS True Edge-Reflection Mirror Wings

**Date:** 2026-08-31

**Status:** Approved design; implementation plan pending written-spec review

**Scope:** Refine the existing Cinematic Mirror Wings presentation so portrait and square native-stage media extend atmospherically without showing obvious duplicate faces or characters. This design does not authorize media ingestion, upload, deployment, production changes, push, merge, hosting changes, or Task 10 remote review.

## 1. Purpose

The current Mirror Wings render broad, blurred copies of the complete portrait frame. When a face or character occupies the center of the source, that subject appears again in each wing. The result reads as three copies of the character instead of one center subject surrounded by a cinematic environmental extension.

The revised effect keeps recognizable people and characters in the center master. Each wing reflects only the nearest outer edge of the source frame, allowing scenery, color, light, texture, and motion to fill unused stage width without competing with the center image.

## 2. Selected approach

Use true edge reflection rather than full-frame mirroring or a generic blurred background.

- The left wing samples the source frame's outer left edge and reflects that sample outward.
- The right wing samples the source frame's outer right edge and reflects that sample outward.
- Both samples are horizontally reflected around the corresponding center-master boundary.
- The center master overlaps the reflection seams slightly and remains above the wings in the stacking order.
- The wings are strongest beside the master for visual continuity, then become darker, softer, and less saturated toward the stage's outer boundaries.

The implementation must not mirror the complete frame into either wing. The initial edge sample targets approximately the outermost 25–30 percent of each side of the source. The exact value may be tuned during the local visual gate, but both wings must use the same approved edge-sampling rule unless a later design explicitly adds per-item overrides.

## 3. Subject-preservation rule

The center master is the only intentionally clear and recognizable presentation of a person or character.

The wings are decorative and atmospheric. Their default crop, blur, brightness, saturation, and vignette must prevent an obvious full duplicate of a centered subject. No facial recognition, subject detection, or content-analysis service is introduced. If a source places a subject at an extreme outer edge, the stronger blur and outer vignette are the fallback concealment.

## 4. Shared-stage provider policy

Mirror Wings remain a shared-stage capability controlled by internal provider configuration, not by a visitor-facing control.

Initial policy:

| Native stage provider | Mirror Wings capability |
| --- | --- |
| Cinema | Enabled |
| Music Video | Enabled |
| Media | Disabled, capability available |
| VIAIMS welcome video | Disabled, capability available |
| YouTube presentation card | Not applicable |

The capability also remains aspect-aware:

- portrait and square media may show wings when their provider is enabled;
- landscape media suppresses the wings even when its provider is enabled;
- unknown aspect suppresses the wings until reliable metadata is available;
- mobile suppresses the wings for clarity and processing efficiency.

The provider policy is an internal code-level configuration. Visitors do not see or operate a Mirror Wings switch. Per-video overrides are outside this revision and should be added only when a real asset demonstrates that provider-level policy is insufficient.

## 5. Music Video stage leases

A portrait or square Music Video receives the same true edge-reflection treatment while it holds the shared-stage lease.

- Acquiring a Music Video lease preserves the exact Cinema source, position, play/pause state, mute state, aspect state, and Mirror Wings state.
- Directly switching to another Music Video retains the lease and recalculates the edge-reflection presentation for the new source.
- Selecting audio-only Music releases the lease according to the approved player behavior and restores Cinema with its correct presentation state.
- `RETURN TO CINEMA` releases the lease and restores the parked Cinema source and its correct wings.
- A Music Video ending continues to follow the approved Music queue behavior; it does not alter Cinema's independent continuity rules.

The revised crop is a presentation-layer concern. It must not change playback ownership, audible-source arbitration, queue behavior, or lease semantics.

## 6. Presentation geometry

The existing center master and two synchronized decorative follower videos remain the stage primitives.

For an enabled portrait or square source:

1. Determine the reliable aspect from master metadata.
2. Keep the master centered with `object-fit: contain` and above the wings.
3. Constrain each wing to the unused side region.
4. Bias the left follower to the source's outer-left sample and the right follower to its outer-right sample.
5. Reflect both samples outward from the master boundary.
6. Extend each sample beneath the master by a small overlap so the master conceals crop and reflection seams.
7. Apply the approved blur, reduced saturation, reduced brightness, and outer-edge vignette.

The inner edge next to the master must retain enough image energy to feel continuous. The outer stage edge must receive the deepest visual suppression. The treatment must not introduce document overflow or change the master video's intrinsic presentation.

## 7. Failure handling

Mirror Wings remain non-authoritative decoration.

- A follower load, metadata, play, or synchronization failure never pauses or replaces the master.
- If either follower cannot provide a stable presentation, both wings fade or hide so the stage remains visually balanced.
- Existing mirror-failure state remains recoverable through source changes and stage-lease restoration.
- A source with disabled provider policy, landscape aspect, unknown aspect, reduced-motion preference, or mobile layout uses the center master without wings.
- Failure status must not claim that master playback failed when only decoration failed.

## 8. Performance and accessibility

- Reuse the existing two muted, `aria-hidden` follower videos; do not add another playback or audio path.
- Followers remain non-interactive and excluded from keyboard and accessibility navigation.
- Reduced-motion behavior continues suppressing decorative followers.
- Mobile continues using the center master alone.
- The revision must not insert audio processing, change audio fidelity, or affect meter routing.

## 9. YouTube tab destination

The canonical VIAIMS YouTube destination is:

`https://www.youtube.com/@justinscottdixon_voyager`

The YouTube tab will use this channel as its primary branded destination, with individually curated videos presented beneath it. The presentation-card behavior remains separate from native shared-stage playback and therefore does not use Mirror Wings.

This decision records identity and placement only. YouTube API integration, automated channel synchronization, and live embedded playback remain outside this revision.

## 10. Test strategy

Strict test-first RED/GREEN execution is required.

Automated coverage must verify:

- the provider-policy defaults: Cinema and Music Video on; Media and welcome off;
- portrait and square eligibility and landscape, unknown, mobile, and reduced-motion suppression;
- distinct left-edge and right-edge sampling with outward horizontal reflection;
- center-master overlap and stacking sufficient to conceal both seams;
- no full-frame wing contract remains;
- Music Video lease acquisition, direct replacement, audio-only release, and `RETURN TO CINEMA` restoration preserve correct Mirror Wings state;
- follower failure remains isolated from master playback;
- the YouTube destination uses the approved canonical channel URL.

## 11. Local visual acceptance gate

Review the production-equivalent static build locally in Safari and Chromium before requesting approval.

The gate must include:

- a portrait Cinema video with a centered recognizable face or character;
- a portrait Music Video stage lease;
- direct switching between portrait Music Videos when fixtures exist;
- `RETURN TO CINEMA` restoration;
- desktop and tablet layouts;
- mobile confirmation that wings remain absent;
- console inspection for playback or presentation errors.

Acceptance requires:

- the center master retains the only intentionally recognizable subject;
- wings read as continuous environmental reflections rather than duplicate videos;
- reflection seams remain concealed behind the center master;
- outer edges remain subdued and do not compete with the subject;
- master playback, Music playback, Cinema continuity, leasing, and audio fidelity remain unchanged.

If real Music Video fixtures are not yet configured, executable lease tests and a controlled local visual fixture may establish implementation correctness, but final real-asset approval remains pending until a representative portrait Music Video is available.

## 12. Preserved approval boundaries

- Do not commit implementation until the local visual gate is approved.
- Do not begin Task 10 remote phone or fidelity review until the local gate is approved.
- Do not sync or publish the locally replaced ATLAS 14 asset without separate approval.
- Do not upload or ingest remaining Cinema replacements until their approved delivery encodes are available and publication is separately authorized.
- Do not push, merge, deploy, modify production, or alter hosting or DNS without separate explicit approval.
