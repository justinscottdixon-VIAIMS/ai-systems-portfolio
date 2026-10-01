# VIAIMS launch: concrete review and task selections

Current direction: publish the player and a concise public introduction/contact surface. Credentials, archive routes, store/checkout and automatic media-folder publishing remain withheld. Existing source/media/credentials work is preserved. This document proposes final content and task scopes; it is not itself owner approval.

## Public introduction for approval

Heading: **Music, moving image and creative technology.**

I’m Justin Scott Dixon, a music and video producer, spatial audio engineer and creative technologist. Through VIAIMS—the Voyager Institute of AI Music Systems—I bring together sound, moving image and AI-assisted creative work. Explore the player for selected music and visual projects.

Supporting link: **Explore my YouTube channel ↗** → https://www.youtube.com/@justinscottdixon_voyager (already configured in the site's curated media).

Placement: a readable charcoal-and-gold section below the player, in HTML rather than embedded in artwork. On wider screens the contact block sits alongside the introduction; on mobile they stack. No full biography, credentials, awards or client claims are introduced.

## Contact block for approval

Heading and button: **Discuss a project**

For music production, spatial audio and visual collaborations, share a brief outline of your project, the intended deliverables and your timeframe.

Destination: owner-approved public email (`mailto:`) or existing HTTPS booking page. It is not inferred from private research. No new contact service/form/account, response-time promise, rates or availability claim. The block is omitted until a valid destination is supplied. `VIAIMS_PUBLIC_CONTACT` supplies that destination at build time; it is intentionally public, never a credential.

Confirm that those enquiry categories match the services you want to invite. Alternatives can be revised before publication.

## Search essentials prepared locally

- Title: **Justin Scott Dixon | Music, Video & Spatial Audio | VIAIMS**
- Description: **Music, video and spatial audio by Justin Scott Dixon. Explore selected sound and visual projects from VIAIMS, the Voyager Institute of AI Music Systems.**
- Canonical URL: https://viaims.com/
- Open Graph/social metadata: same title/description/canonical identity; summary card without unapproved imagery.
- Sitemap: only https://viaims.com/ in the public player build. No draft archive links.
- robots.txt: allow public search crawlers and OAI-SearchBot. Optional `VIAIMS_BLOCK_GPTBOT=true` blocks GPTBot training independently. Current build leaves training policy unchanged pending owner choice.
- Person JSON-LD: name, canonical site and existing YouTube channel only. No invented awards, employers, organization legal status, ratings or certifications.
- Preview indexing: keep Vercel preview protection and verify its `X-Robots-Tag: noindex` response. Do not bake a preview noindex directive into an artifact that will later be promoted. Verify production headers separately.
- No analytics, tracking pixels, new dependencies, llms.txt or unsupported SEO promises added.

## Task selections — what I can complete and what you approve

| Selection | Agent work | Owner decision/action | Timing |
| --- | --- | --- | --- |
| A. Launch content and discovery | Implement approved introduction/contact wording, contact link, metadata, sitemap, crawler controls and output checks. Most implementation is prepared; 433 tests passed. | Approve/edit the copy and enquiry categories; supply public contact destination; choose GPTBot policy. | Now, before launch. |
| B. Release verification | Check the final artifact across desktop/mobile, keyboard/focus, all providers, media delivery, failures, Credentials exclusion and performance. Prepare exact release/rollback steps. | Perform/approve real-phone and listening checks on your chosen output route; resolve any visual/content objections. | After A. |
| C. Preview and production release | Package the approved source, create the approved hosted preview, inspect remote build/headers, then perform and verify approved production promotion. | Approve exact preview/deployment/promotion actions after the candidate is reviewable. Keep DNS/media destinations unchanged. | After B and final review. |
| D. Private off-device backup | Copy the verified workspace/media/Git backups to the selected destination, compare hashes and rehearse restore. | Name an existing private cloud location or external disk; authorize its use. No public Git backup of private material. | Before production; independent work can overlap A/B. |
| E. Search measurement | Inspect existing Search Console/Bing access, verify ownership where authorized, submit the public sitemap and record crawl/index baseline. | Approve new account connection/verification only if needed; choose any analytics separately. | Immediately after launch. |
| F. Complete Credentials | Reconcile remaining evidence/artwork/credits, prepare proofreading batches, fix/test deck/archive UI and give you an itemized final approval ledger. | Supply unresolved facts and approve copy/artwork. Credentials stays withheld until the entire section is approved. | Next content milestone; can proceed privately alongside launch. |
| G. Media-folder automation | Prepare isolated remote tests for upload/move/replacement/deletion, caching, discovery and fallback; fix defects, then propose activation. | Approve exact test objects/mutations and later production activation. | After stable public launch. |
| H. Welcome and Music visuals | Implement approved real welcome/ambient/tagged assets and verify continuity/failure handling. | Supply/approve assets and listening/visual experience. | After core launch. |
| I. Services and conversion expansion | Draft dedicated service/accomplishment pages grounded in approved evidence; build approved booking flows. | Approve services, wording, destinations and availability expectations. | Following observed needs and approved archive evidence. |
| J. Commerce | Prepare catalogue/pricing/licensing/checkout design; implement and test the approved flow. | Decide products, terms, provider, fees, taxes, delivery and refund responsibilities. | Separate later project scope. |

Recommended immediate selection: **A + B + D**, followed by **C**, then **E**. Keep **F** as the next private content priority. G–J are optional later batches, not automatic launch blockers.

## Current boundaries

Local code and build evidence do not complete hosted-device/fidelity acceptance. Off-device backup remains pending a destination. Nothing in this pass was pushed, deployed, submitted to search engines, or connected to a new service. Do not publish draft copy or an empty contact flow. The earlier eight-dossier proposal is superseded by the owner's complete Credentials holdback instruction.

## Supporting documentation

- Ordered site completion roadmap: 2026-10-01-site-completion-roadmap.md.
- Current workspace evidence and private backups: outputs/release-readiness-2026-10-01/ at the outer workspace root.
- Google AI discovery guidance: https://developers.google.com/search/docs/fundamentals/ai-optimization-guide
- OpenAI search/training crawler distinction: https://developers.openai.com/api/docs/bots
- Vercel preview noindex headers: https://vercel.com/docs/headers/response-headers
