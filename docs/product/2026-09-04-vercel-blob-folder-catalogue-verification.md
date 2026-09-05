# Vercel Blob folder catalogue: local verification and preview gate

**Evidence captured:** 2026-09-04 America/New_York, beginning 22:58 (2026-09-05 UTC).

**Checkout:** `site/.worktrees/adaptive-media-shadow`, branch `codex/adaptive-media-shadow`, implementation HEAD `daa44ec35867eff909fc7fdc6c6455449d761117`.

**Decision:** Local automated and injected-HTTP checks pass. Browser checks below pass within the stated fixture limits. Remote preview, actual-phone, fidelity, final visual acceptance, and release gates remain open. No Blob object, remote service, credential, deployment, or production resource was accessed or changed by this verification.

## Fresh automated evidence

Runtime: Node `v26.4.0`, npm `11.17.0`. The linked project file specifies Node `24.x`; its remote runtime has not been tested here.

| Command | Observed result |
| --- | --- |
| `npm test` | 353 tests passed; 0 failed, cancelled, skipped, or todo. |
| `npm run build` | Exit 0; Astro built one page successfully. |
| `VIAIMS_MEDIA_MANIFEST_PATH=src/data/media.preview.json npm run build` | Exit 0; Astro built one page successfully. |
| `git diff --check` | Exit 0; no whitespace errors. |
| Focused endpoint, catalogue, refresh, metadata, library, controller, and transport tests listed below | 70 passed; 0 failed, cancelled, skipped, or todo. |

```bash
node --test tests/media-catalog-endpoint.test.mjs \
  tests/blob-folder-catalogue.test.mjs tests/catalogue-refresh.test.mjs \
  tests/media-metadata-probe.test.mjs tests/runtime-catalogue-controller.test.mjs \
  tests/runtime-media-library.test.mjs tests/transport-navigation-runtime.test.mjs

rg -n 'xqvdbqljaxqvjlovktdi|SUPABASE|BLOB_READ_WRITE_TOKEN\s*=|BEGIN PRIVATE KEY' \
  src api scripts tests package.json
rg -n 'SUPABASE|supabase|xqvdbqljaxqvjlovktdi|BEGIN PRIVATE KEY' \
  src api scripts tests package.json
rg -n 'BLOB_READ_WRITE_TOKEN' src api scripts tests package.json
```

The required first scan has one intentional match: `tests/media-catalog-endpoint.test.mjs:84` throws `BLOB_READ_WRITE_TOKEN=secret-value` to prove error redaction. That literal is a fake test fixture, not a credential. The broader Supabase/project/private-key scan has no matches. Token-name references are limited to the server endpoint, existing owner synchronization script, and secret-redaction tests. There are no token-name matches in browser `src`. These are scoped source scans, not proof about credentials or deployed infrastructure.

Retained local evidence is under Git-ignored `.superpowers/sdd/`: `blob-task-8-tests.log`, `blob-task-8-build-default.log`, `blob-task-8-build-preview.log`, `blob-task-8-focused.log`, `blob-task-8-local-server.log`, and `task8-local/`. Logs and fixture code are local review aids and are excluded from the Task 8 commit. Git exclusion does not establish Vercel upload exclusion; the deployment preflight below addresses that separate boundary.

## Local HTTP and browser method

The harness is `.superpowers/sdd/task8-local/server.mjs`, started with:

```bash
node .superpowers/sdd/task8-local/server.mjs
```

It binds only `127.0.0.1:4388`, serves the preview build's HTML/styles, and calls the actual `createMediaCatalogueHandler` with in-memory `listPage`/`readText` dependencies. Listings paginate one object per page. Its seven initial candidates include portrait and landscape Cinema, separate Music WAV/portrait MP4/landscape MP4 rows, Media video, and a hidden Music visual. Synthetic assets are a 30-second silent WAV and two static-color H.264/yuv420p MP4s, 180×320 and 320×180. No owner media is used.

The browser validates synthetic HTTPS catalogue URLs normally. A **test-only `probeItems` injection** then maps `https://viaims-task8.invalid` to the loopback origin before the actual native metadata probe and player application. The harness bundles the current component script with that injection and replaces bootstrap media URLs in served HTML with fixture URLs. Application source, checked-in manifests, and default endpoint dependencies are unchanged. A same-origin Content Security Policy blocks non-local media, scripts, connections, fonts, and images. The test proves local endpoint-to-player behavior; it does not prove public HTTPS, Blob/CDN caching, Vercel Function packaging, or real media delivery.

The browser was Codex's in-app Chromium **152.0.7977.64**, obtained from `navigator.userAgentData.getHighEntropyValues(['fullVersionList'])` on a local diagnostic page. Reported platform: macOS/MacIntel; device pixel ratio: 2. The ordinary UA reduces the version to `Chrome/152.0.0.0`; the full-version value above is the captured value. Local Google Chrome `152.0.7977.76` and Safari `26.6.2` are installed, but neither completed this browser run.

| Check | Fresh observation |
| --- | --- |
| HTTP endpoint | GET: 200, authoritative envelope, complete seven-item initial catalogue, SHA-256 fingerprint, JSON MIME, `public, s-maxage=15, must-revalidate`. POST: 405 with `Allow: GET`. |
| Failure response | Injected listing failure: 503, `Cache-Control: no-store`, body `{"error":"Media catalogue unavailable"}`. |
| Local range and MIME | Synthetic MP4 range `bytes=0-99`: 206, `video/mp4`, `Accept-Ranges: bytes`, `Content-Range: bytes 0-99/21671`, 100-byte body. This describes the fixture server only. |
| Native metadata | Rows show 180×320 portrait and 320×180 landscape metadata; silent WAV loads with 30-second duration. |
| Pointer and keyboard | Cinema row selection changes the active identity to `QA-1-portrait`; selecting Music exposes independent rows. Right Arrow from focused Music tab selects Media. Media row activation reports `MEDIA LIVE`. |
| Mixed Music order | Audio `QA-1-audio.wav`, portrait video `QA-2-video.mp4`, landscape video `QA-3-landscape.mp4` render as three separate rows in that order. Next advances audio to video; Previous returns to audio after the asynchronous lease restoration settles. |
| Mobile breakpoint | At 390×844, portrait Music/Cinema remain enabled, landscape rows are disabled/ineligible, and fullscreen is enabled for the portrait stage. |
| Desktop return | At 938×900, all three Music row actions are enabled and the mobile fullscreen action is disabled. Screenshots at both widths showed populated player UI. |
| Fullscreen behavior | Entry reports `data-fullscreen-mode="native"`; branded controls and title are exposed, Play/Pause changes the accessible label, Next accepts input, and Exit restores inline mode/focus. The native-fullscreen screenshot was unusually small within the capture; this is not sufficient evidence for final fullscreen visual acceptance or screen-filling geometry. |
| Periodic refresh | Server request timestamps contain consecutive browser requests at 14,999–15,007 ms intervals. Changed catalogue rows appear without navigation or rebuild. |
| Failure retention | During injected 503 responses, all accepted Music rows remain. Browser logs contain the generic retention diagnostic once per failure episode; no raw injected error is exposed. |
| Inactive removal | Removing `Music/QA-3-landscape.mp4` removes that row on refresh. |
| Current removal | With Music audio selected and paused, removing its row preserves the loaded `music-audio` source; only the surviving Music video row remains. Next selects that remaining video, skipping the removed item. |
| Safe dynamic rendering | A Cinema filename `<img onerror=alert(1)>.mp4` appears as literal title text. DOM inspection reports zero `img`, `script`, or `[onerror]` nodes inside the playlist. |
| Browser diagnostics | Captured application warning/error log contains only the two deliberately induced catalogue retention warnings. A locator wait timed out during one asynchronous audio handoff; the subsequent full accessibility snapshot confirmed the requested audio state. This is recorded as a tool/timing limitation, not an application pass inferred from the timeout. |

HTTP evidence files in `task8-local/` include `http-get.headers/json`, `http-post.headers`, `http-range.headers`, `range.bin`, `http-failure.headers/json`, and `http-status.json`. Screenshots and accessibility snapshots were inspected through CUA; the tool did not return persistent screenshot file paths.

### Remaining local limitations

- `agent-browser` is not installed. A separate headless Playwright launch of installed Chrome failed with `Target page, context or browser has been closed`, `SIGABRT`, and `kill EPERM`. No software was installed to resolve it.
- The initial loopback bind failed with `listen EPERM: operation not permitted 127.0.0.1:4388`; ordinary sandboxed curl could not reach it. Automatic review subsequently allowed the exact loopback server and HTTP checks. The successful in-app browser run used that local server.
- Background CUA operations did not provide a conclusive native focus-loss/focus-regain event. Immediate focus refresh and hidden-page suspension are covered by the fresh controller tests, but their browser acceptance remains open. A temporary local control-tab navigation returned `ERR_BLOCKED_BY_CLIENT`; its in-memory state change had reached the harness, and state was reconciled through loopback HTTP before continuing.
- Responsive emulation is not touch-device testing. Safari, physical pointer/touch behavior, owner-phone fullscreen, and listening/fidelity remain open. No remote or personal-browser fallback was used.
- The temporary tabs were closed, viewport override reset, and local server stopped (exit 130 after Ctrl-C). Test files remain only as ignored local evidence.

## Future remote preview: exact approval gate, not executed

The following is a reviewable proposal. **Do not run its remote commands until the owner explicitly approves the exact objects, existing store/project binding, one Preview deployment, test mutations, and cleanup.** Approval of local implementation or local task commits does not approve this procedure. These are public, shared Blob folders: any other existing consumer may discover the test objects, and downloaded/cached bytes cannot be revoked by cleanup.

### Target assumptions to revalidate before any mutation

- Local `.vercel/project.json` names project **`ai-systems-portfolio`**, project ID `prj_SZoniggZqLSZjIuTaRm5Qna6uiD8`, organization `team_GnZbu6hOGuqA72HfTvfr1eJ1`, Astro, Node `24.x`, build `npm run build`, output `dist`. This is local configuration, not confirmation of live linkage or access.
- Destination is that project's **existing public Blob store**, with the existing four direct-child prefixes below. The store identifier and its Preview environment binding have not been verified. Stop if the store, account, environment, or linkage differs; do not create a store, change credentials, or relink the project implicitly.
- Deploy a complete, clean, reviewed source snapshot, including `api/media-catalog.mjs`, to **Preview only**. Do not deploy directly from this dirty worktree, or use an old static `.vercel/output`, bare `dist/`, `--prod`, or production promotion. Record the approved Git commit/patch digest because unrelated WIP exists.
- Prepare the upload directory at `/private/tmp/viaims-blob-qa-preview-20260904-01a06edd` from the approved commit plus only an explicitly approved patch, then rerun its tests/build. Copy only the non-secret `.vercel/project.json` binding needed for that target, not credentials or environment files. The current `.vercelignore` omits `.superpowers/`; explicitly exclude `.superpowers/`, generated diagnostics/fixtures, `.env*`, and every unapproved file in the staged payload. Review the actual upload file list using the subsequently approved CLI's documented tooling and record its digest. Stop if exclusion or the exact file set cannot be established. This staging and CLI upload behavior have not been verified here.
- No `vercel` CLI is currently on PATH or in `node_modules/.bin`. CLI installation/setup requires separate approval. After approved setup, verify its documented Preview flags before the proposed command below. Existing owner authentication and the server-only Blob token must remain undisclosed; do not print, paste, log, or commit token values, and do not pull all environment secrets locally.

Proposed deployment command, **only after those checks and approvals**:

```bash
cd '/private/tmp/viaims-blob-qa-preview-20260904-01a06edd'
vercel deploy --target=preview
```

Record the returned immutable Preview URL and deployment ID. Keep that same deployment for every mutation test, with no intervening rebuild/redeploy. Before creating objects, verify `GET /api/media-catalog` returns the expected JSON endpoint rather than HTML/404 and `POST` returns 405. This is the Function-packaging gate. Save the complete baseline envelope/fingerprint and fully paginated SDK listings of all four prefixes, including sidecar metadata/content, without changing any sidecar.

### Exact public object names and harmless bytes

| Role | Initial exact pathname |
| --- | --- |
| Cinema, initial teal / replacement purple | `Cinema/VIAIMS-QA-20260904-01a06edd-Cinema.mp4` |
| Silent tagged Music audio | `Music/VIAIMS-QA-20260904-01a06edd-Audio__VIZ-QA-20260904-01A06EDD.wav` |
| Media clip to move into Music | `Media/VIAIMS-QA-20260904-01a06edd-Media.mp4` |
| Reusable Music visual | `Music-Visuals/VIZ-QA-20260904-01A06EDD.mp4` |

The single move destination is **`Music/VIAIMS-QA-20260904-01a06edd-Media.mp4`**. No other names, folder mutations, sidecar writes, or real media releases are included. Abort on any collision across these five names; do not overwrite an existing object or silently choose new names.

The three synthetic source fixtures were prepared locally for this approval packet with the commands below. Fresh `ffprobe` inspection confirms eight seconds, H.264 360×640 for both MP4s, and PCM 16-bit stereo/48 kHz for the WAV; `ffmpeg -v error -i <fixture> -f null -` decoded all three without errors. Each is below 2 MiB. Nothing has been uploaded. The directory is temporary: verify these hashes immediately before the later remote gate; if files no longer exist, regenerate and approve the resulting identities before upload. Do not rerun `mkdir` against the existing directory or overwrite unverified files.

| Local file under `/private/tmp/viaims-blob-qa-20260904-01a06edd/` | Bytes | SHA-256 |
| --- | ---: | --- |
| `teal.mp4` | 7,962 | `91a2acd82840a29c37961db476d55e4c77c34b354d2b5a35054add5c793a950d` |
| `purple.mp4` | 7,963 | `c344b47c21d829892ef44a6a5374e831f0b8119da39acf03a41f4cd862b4a86f` |
| `silence.wav` | 1,536,078 | `a8afe1d08e7568df3453bc921d84ff787b885afcf517e5dc69da239b71cb0f4e` |

Commands used to prepare the review fixtures (local only):

```bash
mkdir '/private/tmp/viaims-blob-qa-20260904-01a06edd'
ffmpeg -hide_banner -loglevel error -f lavfi -i color=c=teal:s=360x640:r=24 -t 8 -c:v libx264 -pix_fmt yuv420p -movflags +faststart '/private/tmp/viaims-blob-qa-20260904-01a06edd/teal.mp4'
ffmpeg -hide_banner -loglevel error -f lavfi -i color=c=purple:s=360x640:r=24 -t 8 -c:v libx264 -pix_fmt yuv420p -movflags +faststart '/private/tmp/viaims-blob-qa-20260904-01a06edd/purple.mp4'
ffmpeg -hide_banner -loglevel error -f lavfi -i anullsrc=r=48000:cl=stereo -t 8 '/private/tmp/viaims-blob-qa-20260904-01a06edd/silence.wav'
shasum -a 256 /private/tmp/viaims-blob-qa-20260904-01a06edd/teal.mp4 /private/tmp/viaims-blob-qa-20260904-01a06edd/purple.mp4 /private/tmp/viaims-blob-qa-20260904-01a06edd/silence.wav
```

### Ordered remote operations after approval

Use the existing dashboard to confirm folders and perform the owner-facing discovery checks. If exact conditional operations are needed, the installed `@vercel/blob` **2.8.0** SDK supports the explicit calls below; its local `dist/index.d.ts` is the API evidence. Run them only in an approved authenticated environment against the verified store. Keep a local ledger of exact returned pathname, URL, ETag, operation, timestamp, and byte hash after **every** successful action. An uncertain response requires reconciliation before retrying.

1. **Add four objects.** Fully paginate all prefixes and confirm the five proposed pathnames are absent. `put` each approved initial name with `access:'public'`, `addRandomSuffix:false`, `allowOverwrite:false`, correct MIME, and `cacheControlMaxAge:60`. Save the returned objects and verify public bytes/hashes before accepting them. Teal supplies Cinema and Music visual; purple supplies Media; WAV supplies Music audio. Do not change existing `playlist-order.json` objects: unlisted test files already append using deterministic filename order.
2. **Observe additions.** On the same Preview page, record first discovery time and new fingerprint without rebuilding. Verify the three visible provider rows and hidden Music visual, native metadata, tagged audio/visual playback, keyboard/pointer actions, and ordering relative to the preserved baseline. Perform the HTTP/phone checks in step 5 on these initial objects now, before any move/replacement removes their original identity. Refresh polling and endpoint shared caching each have a 15-second policy; metadata probing also takes time, so do not promise discovery in exactly 15 seconds.
3. **Move Media to Music.** Copy only the ledger-owned Media URL to the exact Music destination with overwrite forbidden. Verify destination pathname, MIME, full bytes/hash, metadata, and the step 5 HTTP/phone checks for the destination. Then delete the source with its recorded ETag. If verification fails, retain the source and conditionally remove only the newly created destination. Verify on desktop and phone that the old Media identity disappears and the independent Music audio and Music video rows both appear in deterministic order. This copy-then-delete procedure has a temporary duplicate window and is not atomic.
4. **Replace Cinema at the same pathname.** Use the approved purple bytes and `ifMatch` against the ledger's current Cinema ETag, with overwrite allowed only for that one test object. Verify unchanged ID, changed ETag/fingerprint, actual purple picture, and playback reset/selection behavior, including step 5 HTTP/phone checks for the replacement. The application reloads the same public URL; a new ETag alone does not prove new bytes reached playback. Keep normal browser caching enabled, observe at least the 60-second object cache window plus catalogue refresh, and record stale playback or lag as a finding. Do not hide a failure by cache-busting or redeploying.
5. **Complete public HTTP and phone acceptance before deleting fixtures.** Apply this check at the initial/move/replacement phases above, then finish any remaining checks while both Music rows and the tagged visual still exist. Record HEAD/content length/MIME and a real range GET for each relevant ledger URL. For example, `curl -sS -D headers.txt -H 'Range: bytes=0-99' "$QA_PUBLIC_OBJECT_URL" -o range.bin`; the variable must be a ledger URL. Verify playable MIME and a usable 206/Content-Range response in the actual browser's media requests, then seek in the player. Repeat discovery, provider navigation, mixed Music, fullscreen, focus/visibility refresh, and playback on the owner's phone. Record OS/browser versions, viewport, source identity/hash, output route, and results. Silent fixtures cannot establish listening fidelity; that remains a separate real-media gate.
6. **Delete inactive and current objects, observing on desktop and phone.** First remove the inactive moved Music video; verify its next-catalogue row and navigation removal. Then load the test Music audio, delete it conditionally, and verify it leaves the catalogue/future navigation while an already loaded resource may finish. Removing a row is not immediate byte revocation. Check the surviving Cinema and visual behavior.
7. **Rollback and cleanup.** Remove remaining test objects one at a time using their latest ledger ETags. Verify all five named paths are absent from fully paginated listings and the endpoint catalogue, and compare baseline public fields/fingerprint. If unrelated objects changed concurrently, report the differences; never overwrite/delete them to force equality. Close browser tabs and remove the temporary Preview deployment only if that cleanup was explicitly included in approval; otherwise record that it remains. No production alias, hosting, DNS, manifest, or real object is changed.

Exact SDK operation shapes for the approved operator session:

```js
import { list, put, copy, del } from '@vercel/blob';
import { readFile } from 'node:fs/promises';
const qa = '/private/tmp/viaims-blob-qa-20260904-01a06edd';
const options = { access: 'public', addRandomSuffix: false,
  allowOverwrite: false, cacheControlMaxAge: 60, contentType: 'video/mp4' };

// Collision/baseline preflight: repeat for all four prefixes until hasMore=false.
await list({ prefix: 'Cinema/', limit: 1000 }); // Continue with the returned cursor.
// Run only after complete absence checks; persist each result immediately.
const cinema = await put('Cinema/VIAIMS-QA-20260904-01a06edd-Cinema.mp4', await readFile(`${qa}/teal.mp4`), options);
const audio = await put('Music/VIAIMS-QA-20260904-01a06edd-Audio__VIZ-QA-20260904-01A06EDD.wav', await readFile(`${qa}/silence.wav`), { ...options, contentType: 'audio/wav' });
const media = await put('Media/VIAIMS-QA-20260904-01a06edd-Media.mp4', await readFile(`${qa}/purple.mp4`), options);
const visual = await put('Music-Visuals/VIZ-QA-20260904-01A06EDD.mp4', await readFile(`${qa}/teal.mp4`), options);

// Later approved phase: verify the copy's full bytes before deleting source.
const moved = await copy(media.url, 'Music/VIAIMS-QA-20260904-01a06edd-Media.mp4', options);
await del(media.url, { ifMatch: media.etag });

// Later approved phase: one conditional test-object replacement.
const replacement = await put(cinema.pathname, await readFile(`${qa}/purple.mp4`), {
  ...options, allowOverwrite: true, ifMatch: cinema.etag,
});

// Later phases: inactive removal, current removal, then remaining cleanup.
await del(moved.url, { ifMatch: moved.etag });
await del(audio.url, { ifMatch: audio.etag });
await del(replacement.url, { ifMatch: replacement.etag });
await del(visual.url, { ifMatch: visual.etag });
```

These are ordered phase excerpts, not a script to run continuously. The observation, byte verification, and ledger persistence gates between calls are mandatory parts of the procedure. Stop on an ETag/precondition failure. Never bulk-delete a prefix. A partial upload failure is rolled back using only the objects already recorded as created by this run. No rollback overwrites baseline objects.

## Worktree and release boundary

This task changes only this document, `portfolio-completion-checklist.md`, and `2026-09-04-release-readiness.md`. Local task commits are authorized. The prior `.DS_Store`, playback style/test edits, two untracked player runtime test files, and historical product/spec/plan documents remain outside this commit. No task evidence certifies those unrelated changes for release. The project remains **not release-ready**.
