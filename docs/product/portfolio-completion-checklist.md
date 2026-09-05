# VIAIMS Portfolio Completion Checklist

**Updated:** 2026-09-04
**Working branch:** `codex/adaptive-media-shadow`  
**Policy:** Local shadow work only until each named approval gate is cleared.

Current-state release audit: [2026-09-04 release readiness](2026-09-04-release-readiness.md). Historical checked verification items below do not certify subsequent uncommitted changes or a production release.

## Completed in the adaptive-media shadow

- [x] Tabbed Cinema, Music, Media, and YouTube provider foundation.
- [x] Independent Cinema continuity and Music playback state.
- [x] True edge-reflection Mirror Wings policy and implementation.
- [x] Canonical YouTube channel destination separated from individual selections.
- [x] Focused/full automated verification, production build, independent review, and prior local Safari/Chromium gate for Mirror Wings and YouTube.
- [x] Compact institutional nameplate implementation prepared locally with preserved identity copy.
- [x] Dedicated fine-pointer playlist scroll rail prepared locally; playlist rows retain page-wheel behavior and touch retains direct scrolling.
- [x] Read-only Cinema/Music/Media ingestion tree prepared locally.
- [x] Optional per-provider `playlist-order.json` resolution prepared locally without filename renaming.

## Current local approval gate

- [x] Re-run the complete automated suite and production build after the nameplate, scroll rail, and ingestion-foundation changes.
- [x] Complete independent Critical/Important review of those changes.
- [x] Approve the compact nameplate at the 938px desktop reference width.
- [x] Approve page-wheel behavior over playlist rows.
- [x] Approve wheel and keyboard behavior over the dedicated playlist rail.
- [x] Confirm coarse-pointer/mobile layout does not reserve rail width.

## Replacement-media dependency

- [x] Justin supplies the reduced-file-size Cinema videos.
- [x] Inspect Cinema formats, sizes, durations, names, provider assignment, decodability, and Fast Start locally.
- [x] Create the Cinema `playlist-order.json` using the approved explicit order.
- [x] Validate the Cinema replacement tree locally.
- [x] Justin supplies reduced-file-size Music songs.
- [x] Inspect Music formats, sizes, durations, names, provider assignment, byte integrity, and decodability locally.
- [x] Create the Music `playlist-order.json` using the approved explicit order.
- [x] Validate the Music replacement tree locally.
- [ ] Obtain separate approval before any upload, synchronization, or publication.

Cinema validation evidence is recorded in `docs/product/2026-09-03-cinema-ingestion-validation.md`; Music evidence is recorded in `docs/product/2026-09-03-music-ingestion-validation.md`. The reduced-media dependency is closed. The remote mobile/fidelity gate remains approval-gated and has not started.

## Remote mobile/fidelity gate

- [ ] Create temporary remote preview access only after explicit approval.
- [ ] Perform matched-device shadow/live mobile visual comparison.
- [ ] Perform matched-device listening/fidelity comparison on the approved output route.
- [ ] Record browser, device, output route, source identity, and results.
- [ ] Shut down temporary access after review.

## Mobile portrait fullscreen and tagged Music visuals

- [x] Implement portrait-only native mobile video queues with desktop parity retained.
- [x] Implement branded VIAIMS fullscreen with Previous, Play/Pause, Next, Mute, Close, title, and elapsed/remaining time.
- [x] Keep the scrubber exclusively in the inline transport.
- [x] Enforce 44px minimum mobile touch targets and safe-area-aware fullscreen layout.
- [x] Implement global Music title formatting, one `V_` frame, exact creative-case overrides, and the `PLAY` row action label.
- [x] Implement reserved filename visual tags and a hidden reusable `Music-Visuals` ingestion provider.
- [x] Implement seamless same-tag continuity, different-tag replacement, and a single visual fade to fresh muted Cinema for untagged continuation.
- [x] Isolate stale source and transition events by replacing the tagged-visual media element per generation.
- [x] Complete focused/full tests, both build modes, final independent Critical/Important review, and local Chromium/Safari checks.
- [ ] Supply and approve at least one real portrait reusable Music visual.
- [ ] Publish an updated isolated preview manifest and media only after separate explicit approval.
- [ ] Complete real-device mobile and fidelity approval against the published preview.

Validation evidence is recorded in `docs/product/2026-09-03-mobile-fullscreen-and-tagged-visual-validation.md`.

## Controlled media publication

- [ ] Approve exact validated replacement-media set.
- [ ] Approve upload/synchronization command and destination.
- [ ] Publish immutable media objects without overwriting prior releases.
- [ ] Atomically replace the manifest only after every media operation succeeds.
- [ ] Verify public MIME type, content length, byte-range support, and immutable identity.

## Real experience assets

- [ ] Supply and approve the real welcome video.
- [ ] Supply and approve the real ambient audio bed.
- [ ] Verify visitor-initiated entry, welcome handoff, Cinema continuity, and truthful failure fallback.

## Production engineering meters

- [ ] Confirm the approved meter specification immediately before implementation.
- [ ] Implement real browser-derived stereo analysis for meterable native sources.
- [ ] Preserve playback if meter initialization or processing fails.
- [ ] Keep YouTube explicitly labeled `External Source · Metering Unavailable`.
- [ ] Do not animate simulated or decorative signal values.
- [ ] Run focused/full tests, build, listening check, and visual approval.

Meter implementation remains sequenced after real experience assets.

## Portfolio narrative and conversion content

- [ ] Approve concise Bio copy.
- [ ] Approve Accomplishments list, evidence, dates, and external links.
- [ ] Approve public Contact Information and privacy boundary.
- [ ] Approve Bookings services, availability language, destination, and response expectations.
- [ ] Approve desktop/mobile presentation design for Bio, Accomplishments, Contact, and Bookings.
- [ ] Implement accessible semantic sections without inventing claims or private contact details.
- [ ] Verify navigation, links, responsive layout, and screen-reader hierarchy.

These sections are blocked on approved copy and presentation design, not media files.

## Portable player, store, and commerce

- [ ] Approve portable player persistence scope and cross-page behavior.
- [ ] Approve product catalog, pricing, licensing terms, cart ownership, checkout provider, taxes, delivery, and refund policy.
- [ ] Implement store/cart bridge without coupling commerce state to media playback identity.
- [ ] Complete security, accessibility, and transaction testing.

## Vercel Blob folder catalogue

- [x] Confirm the FTP-style model: use the existing Vercel dashboard and named Blob folders, without Supabase, a database, custom login, or an owner administration page.
- [x] Confirm the discoverable prefixes: `Cinema/`, `Music/`, `Media/`, and `Music-Visuals/`.
- [x] Approve the corrected design in conversation; the written [Vercel Blob folder catalogue specification](../superpowers/specs/2026-09-04-vercel-blob-folder-catalog-design.md) awaits owner review.
- [x] Mark the prior mobile-admin specification and backend/database setup documents as superseded before any remote setup occurred.
- [ ] Review the corrected written specification and its implementation plan.
- [x] Implement complete Blob listing pagination, prefix allowlisting, deterministic fingerprints, and optional sidecar ordering in a server-only catalogue endpoint.
- [x] Adapt runtime refresh to folder fingerprints and complete native media metadata probing.
- [x] Remove the superseded local database implementation, unapplied SQL, obsolete contract tests, and foundation dispatch; preserve historical documents and current player tests.
- [ ] Verify through a preview that a Vercel dashboard upload, move, replacement, and deletion are discovered without rebuilding the website.
- [ ] Obtain separate approval before any Blob mutation, preview deployment, production deployment, or publication. Local task commits are separately authorized.

Local Blob cleanup checkpoint: 44 focused catalogue/runtime tests and all 353 tests pass; default and preview-manifest builds pass. These checks do not complete the preview, actual-phone, fidelity, or full website release gates.

## Final release

- [ ] Resolve every Critical and Important review finding.
- [ ] Verify full tests, production build, responsive browsers, media fidelity, accessibility, security, and commerce.
- [ ] Approve final branch integration strategy.
- [ ] Obtain separate approval for commit, push, merge, deployment, production, hosting, and DNS actions.
- [ ] Perform release and post-release verification only after those approvals.

## Actions not authorized by this checklist

- Stage or commit files outside the explicitly approved implementation scope; the 2026-09-03 implementation commit is separately authorized.
- Push, merge, or deploy.
- Create remote access.
- Upload, synchronize, or publish media.
- Modify the production manifest.
- Alter production, hosting, or DNS.
