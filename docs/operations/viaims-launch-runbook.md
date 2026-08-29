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
