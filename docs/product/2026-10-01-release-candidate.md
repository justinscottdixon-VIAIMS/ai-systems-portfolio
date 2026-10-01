# Selected portfolio release candidate — 2026-10-01

## Build and scope

The full development archive remains the default: `npm run build` builds all 18 dossiers. `VIAIMS_RELEASE_SCOPE=selected npm run build` builds the player, archive index and eight explicit dossiers selected in `src/lib/release-scope.mjs`: Time Travel, One, Two Worlds, Someone Else, Audio Shock, Unexpected, Navigator and Groove Me Anniversary. Selection is a proposed publication scope, not a new claim of editorial approval. Final owner review remains open.

All archive consumers use the same selector. Related links to excluded dossiers are removed from the selected projection, not the source data. Unknown scopes, missing selected IDs and selected records with verification-pending status fail the build. Source records and all previous work remain intact.

Automatic Blob-folder refresh is disabled only in the selected build. It plays the current checked-in media manifest. The full development build retains discovery for further preview acceptance. Existing manifests were not modified. Both currently contain the same 20 media assets with video aspect metadata; the September 4 missing-metadata warning is historical.

Not included in this first release proposal: the ten remaining dossier pages, unfinished bio/contact/bookings sections, store/cart/checkout, welcome/ambient assets and the unverified automatic folder-publishing workflow. No placeholder conversion section is added. A dedicated source package freezes selected scope in its build command so a deployment cannot accidentally use the full default archive.

## Evidence and remaining acceptance

- 427 tests passed after release-selection integration, including no discovery requests/timers in selected mode; final results live in the private workspace release-readiness report.
- Default and preview-manifest builds each produced 20 pages before selection; selected build produces 10.
- All 216 archive reference image paths exist in public-deploy; generated default pages had no broken local path references.
- All 20 manifest URLs returned HTTP 206 for a one-byte range request; content-hash filenames match files in the full local preservation snapshot. This is delivery/backup evidence, not a subjective listening test.
- Browser review covered 390px mobile and 1280px desktop, selected credentials, fullscreen entry, no horizontal overflow and 44px primary mobile controls. A clipped mobile dossier slide was identified and repaired; final visual check required.
- Real iOS/Safari and output-route listening acceptance are still open. Do not call browser emulation a phone test.
- Hosted preview endpoint access returned an authentication redirect through the connector, so remote catalogue acceptance remains unverified.
- Production remains Vercel deployment dpl_GeDwKNfiUDrdSMHTocXWfbSftEXM at commit 2b609242f842297f7565e654b4b5c97efea2de37. Both viaims.com and www.viaims.com were listed as aliases on that deployment. Retain it as the rollback target.

## Continuing work

Keep developing in the existing adaptive-media-shadow worktree. Do not reset it to the selected dataset. Resolve proofreading batches marked pending while preserving the first three approved batches. Reconcile remaining credit/artwork evidence, draft conversion content for owner review, and verify the named-folder catalogue workflow on an approved remote preview. Commerce remains a separate scope decision.

The public repository is not a private evidence store. Untracked research, superseded backend plans and private source material are preserved in the workspace backup and classified in document-placement.json; do not blanket-stage them. public-deploy is the configured Astro static directory, so matching source/deployment artwork copies are intentional. The unused pure-cover-2025.jpg remains source-only, and audio/stereo-peak-worklet.js correctly remains deployment-only.

## Release procedure

1. Review the selected local candidate and exact source package.
2. Confirm off-device backup destination and verify a copied backup independently.
3. Commit/push only the reviewed public source/assets; retain private evidence separately.
4. Deploy the selected package to a preview and verify the exact deployed artifact, media, archive routes and phone/listening acceptance.
5. Approve production promotion of that exact preview and retain the recorded rollback deployment.
6. After promotion verify root, archive index, all eight dossiers, playback, media ranges and domain aliases. Do not change DNS or overwrite media for this release.

No production promotion is authorized by this document. The dated September checklist remains historical and is not evidence of current completion.
