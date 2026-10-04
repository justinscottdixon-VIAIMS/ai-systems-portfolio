# VIAIMS launch: concrete review and task selections

Current direction: publish the player and a concise public introduction/contact surface. Credentials, archive routes, store/checkout and automatic media-folder publishing remain withheld. Existing source/media/credentials work is preserved. Owner selected A + B + C on 2026-10-01: launch content, release verification and private backup. This approves the proposed wording and enquiry categories. Public contact destination and private backup destination remain required inputs; crawler preference remains optional. Publication is selection D, outside this batch.

## Approved public introduction

Heading: **Music, moving image and creative technology.**

Justin Scott Dixon’s creative work spans music, video, spatial audio and the technology that connects them. Through VIAIMS, the Voyager Institute of AI Music Systems, he explores how sound, moving image and AI-assisted workflows can support one another, with an emphasis on thoughtful experimentation and personal expression.

This site brings together a curated selection of that work, offering visitors a place to listen, watch and discover connections between the projects. Whether arriving with a particular interest or simply a little curiosity, visitors are welcome to spend time with the collection.

The site’s player reflects that same care, bringing a little of the tactile character and visual feedback of studio hardware into a web interface. It is an expression of Justin’s commitment to thoughtful presentation and technology that serves the experience.

Supporting link: **Explore the YouTube channel ↗** → https://www.youtube.com/@justinscottdixon_voyager (already configured in the site's curated media).

Placement: a readable charcoal-and-gold section below the player, in HTML rather than embedded in artwork. On wider screens the contact block sits alongside the introduction; on mobile they stack. No full biography, credentials, awards or client claims are introduced.

## Approved contact wording — destination pending

Heading and button: **Discuss a project**

For music production, spatial audio and visual collaborations, share a brief outline of your project, the intended deliverables and your timeframe.

Destination: owner-approved public email (`mailto:`) or existing HTTPS booking page. It is not inferred from private research. No new contact service/form/account, response-time promise, rates or availability claim. The block is omitted until a valid destination is supplied. `VIAIMS_PUBLIC_CONTACT` supplies that destination at build time; it is intentionally public, never a credential.

The owner approved this wording with selection A. The destination must be supplied before the contact block can appear.

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
| A. Launch content and discovery | Implement approved introduction/contact wording, contact link, metadata, sitemap, crawler controls and output checks. Most implementation is prepared; 433 tests passed. | Copy and enquiry categories approved; supply public contact destination; optionally choose GPTBot policy. | Now, before launch. |
| B. Release verification | Check the final artifact across desktop/mobile, keyboard/focus, all providers, media delivery, failures, Credentials exclusion and performance. Prepare exact release/rollback steps. | Perform/approve real-phone and listening checks on your chosen output route; resolve any visual/content objections. | After A. |
| C. Private off-device backup | Copy the verified workspace/media/Git backups to the selected destination, compare hashes and rehearse restore. | Name an existing private cloud location or external disk; authorize its use. No public Git backup of private material. | Before production; independent work can overlap A/B. |
| D. Preview and production release | Package the approved source, create the approved hosted preview, inspect remote build/headers, then perform and verify approved production promotion. | Approve exact preview/deployment/promotion actions after the candidate is reviewable. Keep DNS/media destinations unchanged. | After B and final review. |
| E. Search measurement | Inspect existing Search Console/Bing access, verify ownership where authorized, submit the public sitemap and record crawl/index baseline. | Approve new account connection/verification only if needed; choose any analytics separately. | Immediately after launch. |
| F. Complete Credentials | Reconcile remaining evidence/artwork/credits, prepare proofreading batches, fix/test deck/archive UI and give you an itemized final approval ledger. | Supply unresolved facts and approve copy/artwork. Credentials stays withheld until the entire section is approved. | Next content milestone; can proceed privately alongside launch. |
| G. Media-folder automation | Prepare isolated remote tests for upload/move/replacement/deletion, caching, discovery and fallback; fix defects, then propose activation. | Approve exact test objects/mutations and later production activation. | After stable public launch. |
| H. Welcome and Music visuals | Implement approved real welcome/ambient/tagged assets and verify continuity/failure handling. | Supply/approve assets and listening/visual experience. | After core launch. |
| I. Services and conversion expansion | Draft dedicated service/accomplishment pages grounded in approved evidence; build approved booking flows. | Approve services, wording, destinations and availability expectations. | Following observed needs and approved archive evidence. |
| J. Commerce | Prepare catalogue/pricing/licensing/checkout design; implement and test the approved flow. | Decide products, terms, provider, fees, taxes, delivery and refund responsibilities. | Separate later project scope. |

Recommended immediate selection: **A + B + C** (selected), followed by **D**, then **E**. Keep **F** as the next private content priority. G–J are optional later batches, not automatic launch blockers.

## Current boundaries

Local code and build evidence do not complete hosted-device/fidelity acceptance. Off-device backup remains pending a destination. Nothing in this pass was pushed, deployed, submitted to search engines, or connected to a new service. Do not publish draft copy or an empty contact flow. The earlier eight-dossier proposal is superseded by the owner's complete Credentials holdback instruction.

## Supporting documentation

- Ordered site completion roadmap: 2026-10-01-site-completion-roadmap.md.
- Current workspace evidence and private backups: outputs/release-readiness-2026-10-01/ at the outer workspace root.
- Google AI discovery guidance: https://developers.google.com/search/docs/fundamentals/ai-optimization-guide
- OpenAI search/training crawler distinction: https://developers.openai.com/api/docs/bots
- Vercel preview noindex headers: https://vercel.com/docs/headers/response-headers
