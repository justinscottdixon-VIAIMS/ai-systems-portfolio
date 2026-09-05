# VIAIMS release readiness — 2026-09-04

## Scope and decision

The objective remains the completed, published website, including the corrected Vercel Blob folder-to-player workflow. The prior mobile administration/Supabase interpretation is withdrawn. The site is **not release-ready**. This report does not remove any item from `portfolio-completion-checklist.md` or authorize external changes.

Initial audited checkout: `codex/adaptive-media-shadow`, HEAD `57c5ba7`. Local Blob catalogue implementation subsequently reached `0a85f2c` before the Task 7 cleanup checkpoint below. Separate playback style/test changes and current player runtime tests remain uncommitted; the pre-existing `.DS_Store` modification is preserved. The research-only review in the main checkout does not cover these shadow-worktree changes.

## Current evidence and remaining gates

| Requirement | Evidence inspected | Result / next action |
| --- | --- | --- |
| Existing media foundation and mobile transport | `src/components/HybridMediaEngine.astro`, associated library modules and runtime tests | Implemented locally, with follow-up fixes for navigation, fullscreen state/control parity, empty mobile queues, and inline mute. These changes still need rendered browser verification and final independent review. |
| Production mobile Cinema | `src/data/media.json` | 17 total assets; all 15 videos lack aspect metadata. Zero eligible portrait videos. Validated replacement metadata/media must be released through the approved publication workflow; do not bypass portrait eligibility. |
| Preview mobile Cinema | `src/data/media.preview.json` | 20 assets, 13 videos, 10 portrait videos, no missing video aspect metadata. This is separate from production. Local file contents alone do not prove remote preview readiness or media fidelity. |
| Replacement-media release | Ingestion validation reports, sync scripts, unchanged tracked manifests | Prior local validation is documented. Exact release set/destination approval, remote byte/MIME/range verification, and publication remain separate requirements. |
| Welcome and ambient experience | `src/data/curated-media.json`: `experience: null` | Real approved assets are not configured. Entry-state implementation alone is not completion of the experience. |
| Reusable tagged Music visual | `media-ingest/Media/Music-Visuals/` contains only `.gitkeep` | Supply an approved portrait visual and test real tagged playback, transitions, and failure recovery. |
| Stereo engineering meters | Component displays `METERS PENDING`; no analysis implementation found in `src` | Confirm meter specification and approved source/output route. Implement after real experience assets, preserving playback on analysis failure. |
| Bio, accomplishments, contact, bookings | `src/pages/index.astro`, `PublicationsAndCredits.astro`, checklist | Approved copy, evidence, public contact details, booking destination, and presentation design are still required. Do not infer private details or accomplishments. |
| Truthful credit links and claims | `PublicationsAndCredits.astro` | Four platform landing-page links and two `#` links appear under `VERIFIED EXTERNAL LINKS`. Obtain actual work-specific destinations and evidence before publishing these claims. |
| Technical status claims | Header and Enterprise AV block | Clock lock, calibration, bit-perfect audio, and production-ready labels are static copy, not observed telemetry. Confirm their intended meaning and evidence; do not present them as measured website state. |
| Portable player / commerce | Single page route; fixed cart count; checklist | Persistence scope, catalog, prices, licensing, checkout, fulfillment/refunds, and transaction testing remain unspecified/unimplemented. |
| Blob folder discovery | `api/media-catalog.mjs`, Blob folder catalogue, refresh, native metadata probe, and runtime player integration tests | Read-only endpoint and player refresh are implemented and verified locally, including complete listing, folder allowlisting, ordering, fingerprints, metadata eligibility, and playback reconciliation. Remote dashboard upload/move/replacement/deletion discovery, preview deployment, and actual-phone/fidelity acceptance remain unverified. Supabase, custom authentication, and an owner admin page are outside this scope. |
| Browser, accessibility, device/fidelity checks | Prior validation report plus latest browser-access attempt | Historical browser results do not certify subsequent changes. In-app browser access is currently blocked by the locked Mac. Real-device listening and remote comparison remain open. |
| Final security and independent review | Prior validation report and later uncommitted changes | Prior clean review predates follow-up fixes and the remote-upload scope. Review the actual final patch and new upload security boundaries before release. |
| Integration and production release | Branch/status, configured origin, checklist | Origin URL is configured, but this audit did not verify live GitHub access or deployment state. Integration strategy and specific release actions need approval; post-release validation has not occurred. |

## Corrected folder publishing requirement

The owner requests the familiar FTP-style model: upload or move files into named folders and have the player discover eligible contents without a developer or per-upload website rebuild. Vercel Blob provides those remotely accessible folders through its existing dashboard.

Confirmed design:

- `Cinema/`, `Music/`, `Media/`, and `Music-Visuals/` are the only discoverable Blob prefixes.
- A small server-side endpoint lists every page under those prefixes, applies the allowlist, and returns a complete catalogue fingerprint without exposing the Blob token.
- The player refreshes the catalogue on visible load, focus regain, and at least every 15 seconds while visible. Browser media metadata completes playback eligibility checks.
- Placement in an approved public folder is the owner's publication instruction; removing or moving the object removes it from later catalogues.

The active specification is [Vercel Blob folder catalogue design](../superpowers/specs/2026-09-04-vercel-blob-folder-catalog-design.md). The first release supports native browser video/audio. Images and PDFs require a later presentation design.

The prior Supabase schema, durable adapter, custom upload UI, and database rename/reorder contracts are superseded and must not be deployed. Task 7 removed the enumerated unused implementation, unapplied SQL, obsolete tests, and foundation dispatch files. Superseded documents retain their historical warning banners. No SQL was applied.

## Verification evidence boundaries

Task 7 local cleanup verification: 44 focused Blob catalogue/refresh/metadata/runtime tests passed; the complete suite passed 353 tests with zero failures or skips. Default and preview-manifest builds passed, and `git diff --check` was clean. Refresh bootstrap validation is now local to the active module, uses the Blob folder/kind allowlist, preserves strict public-field and video-metadata validation, and has no dependency on the removed publishing modules. Consumer scans find no active references to the removed path and no Supabase/database implementation in `src`, `api`, `scripts`, or `tests`. The Blob token name remains only in the server endpoint, existing owner synchronization script, and endpoint secret-redaction tests; browser source contains none. No remote service, credentials, media mutation, preview deployment, or production action was performed.

At the initial audit, the preceding implementation pass had recorded 271 passing tests, successful default and preview builds, and a clean `git diff --check`. Those were local build/regression results, not proof of production deployment, actual browser behavior, real-device fidelity, or upload readiness. That initial audit made no application-code changes and did not rerun the suite; the fresh Task 7 verification is recorded above.

The 2026-09-03 validation report describes an older preview manifest without aspect metadata; the current preview file inspected here has validated aspect fields. Its old manifest limitation is superseded by this observation, but its uncompleted remote/device approval gates remain open.

## Next actions

1. Complete owner review of the corrected written folder-catalogue specification and the locally implemented endpoint/runtime; obtain separate preview approval before remote upload/move/replacement/deletion verification.
2. Unlock the Mac for in-app browser regression checks; do not substitute control of the owner's personal browser.
3. Collect approved experience assets, narrative/credit evidence, contact/booking content, meter specification, and commerce decisions without inventing them.
4. Finish remaining implementation, independent review, security/accessibility and real-device/fidelity verification.
5. Obtain exact integration/media publication/deployment approvals, execute the release, and verify the public result.

## Playback review follow-up

The subsequent read-only review of the actual shadow patch found a pre-existing lease-return eligibility gap. Returning from Media/Music Video after a mobile breakpoint change restored the saved Cinema source even when that source was excluded from the current portrait queue.

The controller now validates saved source identity before restoration. An eligible snapshot retains its position; an ineligible snapshot uses the current eligible Cinema source from zero, or clears the master source when the queue is empty, preserving independent Music authority. URL comparisons use canonical browser URLs so valid HTTPS spelling differences do not spuriously reset playback.

Evidence:

- Four new lease-return reproductions failed before the fix; all six restoration cases pass after it, including Music and empty-queue cases.
- Browser-style URL normalization exposed two additional continuity failures before canonical comparison; both now pass.
- Complete suite: 277 passed, zero failed or skipped.
- Default and preview-manifest builds: passed.
- Final read-only reviewer response: no remaining Critical/Important findings in the reviewed patch.
- Browser/device acceptance, real media fidelity, new remote-upload design/security, and the full release checklist remain uncompleted. This review does not authorize merge or publication.
