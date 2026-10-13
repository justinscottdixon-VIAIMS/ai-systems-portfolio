# Unified release-card presentation

12 October 2026. Local implementation and preview only; this document does not record production publication or a Git commit/push.

## Presentation rule

Each child release has one card containing its artwork, release facts and contribution details. Artwork changes within that card; additional images and ordinary credits do not create additional dossier slides. A future exception for unusually long information requires an actual desktop and narrow-layout review. No current release needs an extra information card, and no arbitrary length threshold is implemented.

The four collections contain **64 release cards**, preserving **210 presentation-eligible child artwork views** and **48 credit sections**:

| Collection | Release cards | Artwork views |
| --- | ---: | ---: |
| Cosmic Records | 17 | 33 |
| Singles and remixes | 18 | 20 |
| Production, engineering and mastering | 13 | 47 |
| Compilation appearances | 16 | 110 |

## Implemented behavior

- Cosmic's sixteen paired circular labels retain their flip interaction and information-side-first order; Cosmic 017 remains a single image.
- Other multi-image releases use the reusable artwork gallery. Clicking the artwork rotates to the next view; galleries with three or more views also provide Previous/Next and numbered view buttons. Images load and decode on demand before replacing the visible face. Failed loads keep the current image visible and expose original-image links.
- Artwork returns to its first view when the release card is selected. Stale asynchronous image loads cannot undo that reset. Enter/Space use native button activation; Left/Right remain dossier-slide navigation.
- All existing credit fields, including collaborators, notes and evidence qualifications, appear within native **Credits & contribution** disclosures. Space opens a focused disclosure without toggling playback. Credit styling is scoped separately from the release-fact grid.
- Standalone music releases with multiple artwork images also keep those images together in their cover-card gallery. Full archive links remain available.

Catalogue data, image files, artwork selection, source provenance and gallery order are unchanged by this presentation pass. The existing exclusion policy still keeps original owner capture photographs out of rendered presentations; preserving all eligible gallery items does not reintroduce that evidence-only material.

## Verification and remaining acceptance

`outputs/credentials-artwork-2026-10-12/unified-release-cards/rendered-verification.json` in the parent workspace records a passing check for both the authoritative local build and isolated preview: 64 cards, all 210 child artwork views, all 48 credit sections, folded standalone music galleries and unchanged catalogue data. The collection decks now contain 24, 22, 16 and 20 total slides respectively, including their collection-level material.

Both builds and 486 tests completed successfully in this implementation pass. Browser verification is underway at the time of this handoff. Physical-device acceptance, broader Credentials editorial/evidence review and publication remain separate gates; this local implementation does not close them.

## Final local validation

Both 20-page builds and all 486 tests passed. Rendered preservation checks confirm 64 child cards, 210 eligible artwork views and all 48 credit sections. Browser checks covered Singles rotation and keyboard credit disclosures, the 15-view compilation gallery and wrap/reset behavior, a nine-view production sampler with three inline credits, existing Cosmic rotation, and the standalone One gallery. Narrow 507×800 layout has no horizontal page overflow; selector navigation follows the active number. Artwork frames remain bounded while credits expand. The temporary viewport override was reset. No new commit, push or publication; physical-device acceptance remains separate. Evidence: `outputs/credentials-artwork-2026-10-12/unified-release-cards/verification.json`.
