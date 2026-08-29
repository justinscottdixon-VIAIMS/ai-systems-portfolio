# viaims.com Launch Runbook

## Protected DNS Records

- Preserve the Resend DKIM TXT record beginning at `resend._domainkey.viaims.com`.
- Preserve every record not explicitly named by Vercel's domain-verification screen.
- Record screenshots and values for the apex A record and `www` CNAME before editing.

## Preflight

```bash
npm ci
npm test
npm run build
git status --short --branch
```

All tests and the build must pass. The only expected generated content change after media sync is `src/data/media.json`.

## Media Delivery

Verify one audio URL and one video URL directly from `src/data/media.json`:

```bash
node --input-type=module -e "import { readFile } from 'node:fs/promises'; const manifest = JSON.parse(await readFile('src/data/media.json', 'utf8')); const samples = [manifest.items.find((item) => item.kind === 'audio'), manifest.items.find((item) => item.kind === 'video')]; for (const item of samples) { const response = await fetch(item.src, { headers: { Range: 'bytes=0-1023' } }); console.log(item.id, response.status, response.headers.get('content-range'), response.headers.get('content-type')); if (response.status !== 206 || !response.headers.get('content-range')) process.exitCode = 1; }"
```

Require HTTP `206`, `Content-Range`, the correct `Content-Type`, and no authentication redirect.

## Preview Acceptance

- Desktop widths: 1440 and 1024 CSS pixels.
- Mobile widths: 768, 430, and 390 CSS pixels.
- Validate every cue, play/pause, seek, ±10 seconds, next/previous, auto-advance, timecode, mute state, and mutual audio exclusion.
- Validate portrait and widescreen video without distortion.
- Validate a missing-media response does not break navigation or the publications section.

## Cutover

1. Attach `viaims.com` and `www.viaims.com` in the approved Vercel project.
2. If Vercel reports the domain belongs to another team, stop and have the existing owner release or transfer the association.
3. Apply only the exact DNS values Vercel reports as required.
4. Re-run the DNS and HTTPS verification commands below.

```bash
dig +short viaims.com A
dig +short www.viaims.com CNAME
dig +short viaims.com TXT
curl -I https://viaims.com
curl -I https://www.viaims.com
```

Require valid HTTPS, the approved Vercel deployment, and the preserved Resend TXT value.

## Rollback

1. Reassign the domain to the previous Vercel project if it remains available.
2. Otherwise restore the recorded pre-cutover apex A and `www` CNAME values in Wix.
3. Verify both hostnames and HTTPS externally.
4. Do not delete the new Blob store during rollback.

## Launch Evidence

### 2026-08-29 preview verification

- Canonical launch-branch preview URL: `https://ai-systems-portfolio-git-7a3678-justinscottdixon-5528s-projects.vercel.app`
- Browser-QA deployment: `https://ai-systems-portfolio-lg05po009-justinscottdixon-5528s-projects.vercel.app` (`dpl_33Xq8DHGSASHTkE4rirp6SsN1THY`, `Ready`, inspected at `2026-08-29T21:38Z`).
- Post-evidence deployment: `https://ai-systems-portfolio-7iit2fthn-justinscottdixon-5528s-projects.vercel.app` (`dpl_DDDdFNCZdwmAcsMcvr9eUxEhE1Jj`, `Ready`, inspected after commit `27291d5`). That commit changed only this runbook, so the tested application bundle and media manifest were unchanged. Evidence-only commits create new immutable deployment URLs; the branch alias above is the stable verification target.
- Preflight ran from `2026-08-29T20:21:58Z` to `2026-08-29T20:22:05Z`:
  - `npm ci` completed successfully (234 packages installed; `fsevents` remained an unapproved optional install script).
  - `npm test` passed: 23 tests, 23 passed, 0 failed, 0 skipped (194.39 ms).
  - `npm run build` passed: Astro generated one static route and completed in 558 ms.
  - `git status --short --branch` was clean on `codex/viaims-launch` tracking `origin/codex/viaims-launch` before this evidence update.
- Media range validation ran at `2026-08-29T20:22:24Z` with `Range: bytes=0-1023`:
  - Audio: `audio-v-edges-fade-voo1-1-2-48k24b-mstr` — `206`, `Content-Range: bytes 0-1023/77875244`, `Content-Type: audio/wav`; source `https://5vqpsktuycwubnaj.public.blob.vercel-storage.com/portfolio/audio/6e2a596866faeb135ec1ae5540fb741600d9e5681404b50c434ab9a54055c03e-v-edges-fade-voo1-1-2-48k24b-mstr.wav`.
  - Video: `video-3i-atlas-8` — `206`, `Content-Range: bytes 0-1023/178146457`, `Content-Type: video/mp4`; source `https://5vqpsktuycwubnaj.public.blob.vercel-storage.com/portfolio/video/237896e8ac6de130432c1d587eb45444f86f82249d53417a1534250b4a1e8a5b-3i-atlas-8.mp4`.
- Browser / preview access check:
  - Direct preview request at `2026-08-29T21:06:22Z` returned `302` to Vercel SSO (`cache-control: no-store`; no preview HTML was served).
  - Chrome was switched to the owning `justinscottdixon-5528` Pro workspace and authenticated without creating a shareable link. The branch alias `https://ai-systems-portfolio-git-7a3678-justinscottdixon-5528s-projects.vercel.app` then loaded the same launch-branch deployment successfully.
- Responsive acceptance completed at `2026-08-29T21:37:55Z`:
  - Chrome responsive mode reported exact widths of 1440, 1024, 768, 430, and 390 CSS pixels.
  - `document.documentElement.scrollWidth === window.innerWidth` at every required width; no horizontal overflow was present.
  - The operational modules remained three columns at 1440 and 1024, then stacked at 768, 430, and 390. Controls remained visible and operable.
  - Portrait and widescreen video cues retained their aspect ratios without stretch or distortion; the ambient matte filled the stage around portrait footage.
- Exhaustive playback acceptance completed against the deployed Blob media at every required width:

  | Width | Layout | Overflow | Video cue suites | Audio cue suites | Result |
  | ---: | --- | --- | ---: | ---: | --- |
  | 1440 | 3 columns | none | 15/15 | 2/2 | pass |
  | 1024 | 3 columns | none | 15/15 | 2/2 | pass |
  | 768 | 1 column | none | 15/15 | 2/2 | pass |
  | 430 | 1 column | none | 15/15 | 2/2 | pass |
  | 390 | 1 column | none | 15/15 | 2/2 | pass |

  - Each of the 85 cue/viewport suites independently verified matching title and source load, finite duration and rendered timecode, 25% scrub seek, -10/+10-second nudge, play/pause, previous/next round-trip, and ended-event auto-advance.
  - Starting the DSP master changed video audio from `LIVE` to `MUTED`; enabling video audio changed the DSP transport from `PAUSE MASTER` to `PLAY MASTER`.
  - The earlier manual browser pass reported `No errors`. The exhaustive harness intentionally issued rapid `play()`/`pause()` transitions and produced only expected `AbortError` promise diagnostics from those test transitions; all application assertions passed.
- Missing-media resilience:
  - A deliberately absent Blob URL returned HTTP `404`.
  - The deployed page remained functional with the video/audio queue controls and Publications & Credits section intact.
- No application defect was observed, so no source or test changes were required.
