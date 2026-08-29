# viaims.com Portfolio Hosting Design

## Goal

Launch the existing Astro portfolio at `viaims.com` under Justin Scott Dixon's
own hosting account, preserve the current Wix-managed domain and email-related
DNS records during cutover, and keep the site easy to update through GitHub.

## Confirmed Current State

- The source repository is `justinscottdixon-VIAIMS/ai-systems-portfolio`.
- The working copy contains uncommitted portfolio changes that must be
  preserved before deployment.
- The app is Astro 7 with static output; no server adapter is currently
  configured.
- Local media totals about 2.3 GB, including one video near 985 MB.
- Media binaries are intentionally ignored by Git and cannot be delivered as a
  normal Vercel source deployment.
- Wix is the registrar and DNS authority for `viaims.com`.
- The apex A record is `76.76.21.21`, currently routing to Vercel.
- `www.viaims.com` currently aliases to Wix.
- A Resend DKIM TXT record exists and must be preserved.
- No MX records currently provide inbound domain email.
- The domain is unassigned to a Wix site and renews July 26, 2027.
- The registration is subject to the initial 60-day transfer lock until about
  September 24, 2026.

## Selected Architecture

### Ownership and billing

Justin owns a single-seat Vercel Pro account/team. Keith collaborates through
GitHub and may receive a free Vercel viewer role if useful, but does not receive
a paid Vercel developer or administrator seat. Justin retains control of
billing, environment secrets, domains, and production settings.

### Application hosting

Vercel builds the Astro repository from GitHub and publishes immutable preview
deployments before production. The site remains static unless a future feature
demonstrates a concrete need for server rendering.

### Media hosting

Video and WAV masters are stored in a public Vercel Blob store owned by
Justin's Vercel team. Files larger than 100 MB use multipart upload. A tracked
media manifest maps stable display metadata to Blob URLs so static builds do
not depend on Git-ignored local binaries.

The ingestion workflow must preserve the existing drop-folder convenience:
new local files are uploaded by a repeatable sync command, then the manifest is
updated and validated. Blob object keys should be URL-safe while display names
remain human-readable.

### Domain and DNS

Wix remains registrar and DNS authority during launch. The existing Resend TXT
record is left unchanged. The current apex record is changed only if Vercel's
verified project instructions require it. The `www` record is updated only
after the production project has passed preview validation.

The domain is attached to the new Vercel project only after the current
deployment relationship is understood. If Vercel reports that the domain is
owned by another project or team, Keith must release or transfer that project
association before cutover.

Full registrar transfer away from Wix is a separate post-launch operation. It
may begin on or after September 24, 2026, provided the domain is unlocked and
no later contact-information change has restarted the transfer lock.

## Launch Flow

1. Preserve and review the existing uncommitted portfolio work.
2. Make the repository build reproducibly from a clean checkout.
3. Create Justin's Vercel Pro project and connect the GitHub repository.
4. Create the team-owned Blob store.
5. Upload the current media and generate the tracked media manifest.
6. Deploy a Vercel preview without changing production DNS.
7. Validate desktop and mobile layout, every video and audio transport,
   timecode, seeking, auto-advance, mutual playback exclusion, HTTP range
   delivery, cache headers, and error states.
8. Attach `viaims.com` and `www.viaims.com` to the production project.
9. Apply only the DNS changes Vercel verifies as required, preserving unrelated
   TXT records.
10. Verify HTTPS, apex and `www` behavior, media playback, and rollback access
    from an external network.

## Failure Handling and Rollback

- The existing live site remains untouched until preview validation passes.
- DNS changes are recorded before editing and made one record at a time.
- The previous Vercel deployment or domain assignment remains the rollback
  target until the new production deployment is verified.
- A failed media upload does not publish a partial manifest.
- Missing or unreachable media renders an explicit unavailable state without
  breaking the rest of the page.
- DNS or domain-verification failure stops the launch; it does not trigger
  speculative record deletion or nameserver replacement.

## Cost Model

- One Vercel Pro developer seat: approximately $20 per month.
- Blob storage for 2.3 GB: approximately $0.05 per month at the verified rate.
- Blob delivery is usage-based, beginning around $0.05 per GB, with the Pro
  account's included usage credit applied according to Vercel billing terms.
- Wix domain renewal remains separate until registrar transfer.

## Explicitly Out of Scope for Initial Launch

- Moving nameservers or registrar before the new site is stable.
- Adding a paid Vercel seat for Keith.
- Adding inbound email service.
- Re-encoding, mastering, or otherwise altering the source audio.
- Unrelated portfolio redesign or publication-data completion.
- Cloudflare R2 migration; it remains a later cost-optimization option.

## Acceptance Criteria

- Justin owns the Vercel project, Blob store, billing, and production domain.
- A clean GitHub build produces a working preview.
- All current media is available through Blob-backed URLs and supports seeking.
- `https://viaims.com` and `https://www.viaims.com` serve the approved portfolio
  with valid TLS.
- The Resend DKIM record remains present.
- The previous site can be restored promptly during the launch window.
- Future repository commits generate preview deployments and can be promoted
  without manual file copying.
