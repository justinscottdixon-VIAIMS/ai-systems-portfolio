# Presentation recovery — 16 October 2026

The audit compares finished presentation packages with the deployed-data rendering path. It is not a claim that every research file or alternative artwork candidate is approved for publication.

## Gaps recovered in this change

| Prepared work | Cause of omission | Public placement |
| --- | --- | --- |
| Tranceport.3 signal-flow chart | Committed in docs, outside Astro's publicDir; no release-card field or renderer | Visible “View production flowchart” button on the Tranceport.3 card in theater and full dossier |
| Perfecto Presents workflow, including the equipment imagery, Reaktor modifications, automation, review and handoff stages | Same docs-only storage and missing link | Visible button on the Perfecto album card in both views; one album with two CDs |
| Sandra Collins / Scott Dixon shared musical-language story, including Cosmic Fugue and Spectacle | Public editorial draft committed as Markdown but never rendered | `/production-notes/sandra-collins/`, linked from Tranceport.3, Cream and Perfecto |
| Spice Market — Blackjack Remix Series | Finished entry and distributor artwork remained in outputs, never injected | One 2009 card in Music releases & credits, including Voyager / DXN, DXN aka Voyager, and owner-confirmed mastering of the whole RYR021 release |

The original Sandra source files remain intact. Only the already-public editorial checkpoint is used; raw interviews, private research and local paths are excluded. The two public chart copies add return navigation. Firsthand technical uncertainty and image-source attribution stay visible. The detailed finishing chain applies only to Tranceport.3. Cream has no separate completed chart.

The album cards also recover the previously unapplied full-album co-production/studio-production/mixing account, explicitly labelled firsthand. Direct inspection of the public Tranceport.3 CD credit sheet confirms the unnumbered S&S DAY FOUR intro and writing/production for Motion, with Sam Frost’s additional keyboard production retained. Perfecto’s Cosmic Fugue and Spectacle writing/production are attributed to Scott’s account; printed booklet wording remains qualified. No final-mastering credit for Perfecto is assigned to Scott.

## Finished work already connected

Inspected the data and renderer paths for these packages rather than treating old preparation receipts as current deployment status:

- Explorations / Cosmic 018: six presentation images including the joined inside spread and physical CD panels, in Cosmic and its theater card.
- Transformed: release card and expanded packaging in Cosmic; third-party releases follow it.
- Synergy article/interview: accessible typeset article, selected studio photograph, equipment sidebar and original-page comparison in Articles & interviews.
- Friction & Spice further resources / YouTube: Cosmic dossier end sections through DossierMedia.
- Someone Else / Light Wave and The Interactions EP: two release cards with labelled archive title artwork, track lists and matched listening links.
- Gemini YouTube matches: ReleaseListening shared by theater and archive cards; matched uploads are separate from release/credit evidence.
- Tranceport.3 human-history passages: already present on its consolidated card; preserved here.
- Sunshine State of Mind, Sueños Groove Me and MAD Free: retained in Cosmic after the requested consolidation; Diversity Twins remains removed.

## Prepared leads with specific remaining checks

These are in `outputs/gemini-content-review-2026-10-16/REVIEW.md`; they are not finished presentations that can simply be linked.

| Lead | Remaining work |
| --- | --- |
| The Art of Joy | Final artwork selection; the prepared source confirms artist/release identity but not additional production/mastering roles |
| Again & Again — Voyager & Micke Remix | Wording review was requested; establish final artwork/edition representation; no additional mastering claim |
| Pulse — Voyager Remix | Catalogue/edition date comparison and artwork; reuse existing Pulse passage inside the eventual release card |
| Cosmic Duo — Nu Energy / Friction’s Flavour | Printed credits and personnel comparison |
| Superconscious — Muzik review | Inspect page scan, byline and rating placement before creating a clipping |
| Pure — Muzik advertisement | Inspect scan/page number; retain advertisement versus editorial distinction |
| ElectroTech Summit | Organiser listing exists; actual appearance, talk title and recording remain unconfirmed |
| Legacy Effects making-of films | Inspect end credits or production paperwork before attaching film-specific sound credits |
| San Francisco release-party photographs | Owner said Railyard and S.C.I.; folder location, date, venue and captions still missing |
| VIBE / Remix Sandra feature | Requested article pages remain unlocated; cover/OCR leads alone are not an interview presentation |

Chart-ranking links intentionally removed at the owner's request (`2026-09-30-chart-link-removal.json`) are not restored. Alternative/AI artwork candidates, originals excluded by the presentation policy and private evidence are not treated as missing public content.

## Acceptance

- Both chart buttons must be present inside the corresponding consolidated card in `index.html` and the full release dossier, not just uploaded at unlinked URLs.
- The shared story must be linked from all three albums; every local chart image and return link must resolve.
- `node scripts/verify-release-presentations.mjs` checks card placement, public targets, dependent local assets and absence of local-file paths.
- Full and player-only builds must retain their established publication boundary; player-only output excludes archive, production-notes and reference material.
- Final browser/deployment evidence is saved under `outputs/presentation-recovery-2026-10-16/`.
