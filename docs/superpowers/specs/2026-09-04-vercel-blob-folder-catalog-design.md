# Vercel Blob folder catalogue design

Date: 2026-09-04

Status: Approved in conversation; this written specification awaits owner review before implementation planning.

This specification supersedes `2026-09-04-owner-mobile-publishing-design.md` and the Supabase/database direction derived from it. No Supabase schema was applied, no database-backed adapter was executed, and this document does not authorize Blob mutations, deployment, credentials, charges, commits, or publication.

## Purpose

Restore the intended FTP-style workflow: the owner uploads or moves a media file into a named folder, the website discovers the folder contents, and the existing player makes eligible files available after its gate accepts them. The existing Vercel Blob store and Vercel dashboard provide the remote file store and owner upload interface. VIAIMS does not need a second administration website, a custom sign-in flow, or a database for this workflow.

## Authoritative folders

Vercel Blob is the authoritative remote media source. Only these pathname prefixes participate in the catalogue:

| Blob prefix | Player use | Initial eligible media |
| --- | --- | --- |
| `Cinema/` | Cinema | `.mp4`, `.mov`, `.webm` video |
| `Music/` | Music | `.wav`, `.mp3`, `.m4a`, `.flac`, `.aac` audio; `.mov`, `.mp4` video |
| `Media/` | Media | `.mp4`, `.mov`, `.webm` video |
| `Music-Visuals/` | Reusable Music visuals | `.mp4`, `.mov`, `.webm` portrait video |

The first release remains video/audio only. Images and PDF documents need a separate accessible presentation design before they can enter the player.

A file placed in an approved public prefix expresses the owner's intent to make it discoverable. A file outside these prefixes is ignored. Moving or deleting a file so it no longer appears under an approved prefix removes it from subsequent catalogues.

The first implementation discovers files placed directly inside each approved folder. Nested subfolders are ignored so one provider has one visible playlist and one unambiguous `playlist-order.json`.

Vercel Blob pathnames use `/` to represent folders in the dashboard. These are pathname prefixes rather than operating-system directories, but they provide the requested folder-oriented workflow.

## Catalogue endpoint

Add a small server-side Vercel endpoint, conceptually `/api/media-catalog`, that lists the approved prefixes through the server-held Blob read/write token. The browser must never receive that token.

The endpoint must:

1. Fetch every page for each approved prefix and reject an incomplete listing.
2. Normalize and sort the complete result deterministically.
3. Apply the public-field and media-eligibility allowlists.
4. Return one complete authoritative envelope with a fingerprint derived from the normalized listing.

Each public candidate contains only its stable pathname identity, object ETag, provider, inferred media kind, display title, public URL, byte size, and uploaded timestamp. The installed Blob listing API does not return MIME type, so the endpoint classifies only the explicitly allowlisted extensions and leaves actual playback validation to the browser. Private tokens, internal store details, request metadata, and unapproved pathnames never enter the response.

The fingerprint replaces the proposed database revision. Identical complete folder contents produce the same fingerprint. Any accepted add, move, replacement, or deletion produces a new fingerprint.

## Gate and media eligibility

The server gate performs checks that can be established cheaply from the Blob listing and optional sidecars:

- approved prefix and provider mapping;
- allowlisted filename extension and its provider-specific media kind;
- positive byte size;
- public HTTPS delivery URL;
- unique normalized pathname identity;
- valid optional `playlist-order.json` for the provider.

The existing browser media elements complete playback validation through native metadata and error events. Video eligibility requires intrinsic width and height. Unknown dimensions fail closed until the browser has successfully probed them. The mobile Cinema queue remains portrait-only. The website does not re-encode uploaded media.

An object that fails the gate is omitted from the public player catalogue. The failure is recorded in server logs with its safe pathname and reason; credentials and tokens are excluded.

## Ordering and identity

The existing optional `playlist-order.json` contract remains authoritative. Listed files appear first in the sidecar order, followed by unlisted eligible files in natural filename order. An invalid sidecar rejects that provider's update rather than silently changing its order.

Every file in `Music/` is an independent ordered Music item. Audio files receive the audio playback action; `.mov` and `.mp4` files receive the native video action. Matching filename stems do not implicitly pair files or hide either entry.

The Blob pathname is the stable identity. Replacing bytes at the same pathname retains the logical item identity while changing its object metadata and catalogue fingerprint. Renaming or moving a pathname creates a new identity. This keeps the file system behavior understandable and removes the need for database rename and reorder commands.

## Runtime refresh

The player requests the complete catalogue on first visible load, when the page regains focus, and at least every 15 seconds while visible. Only one request may be in flight. A malformed, partial, failed, or internally inconsistent response leaves the last accepted catalogue active.

After the first valid server catalogue is accepted, build-time bootstrap media must never reappear as an authority during a later request failure. The fingerprint detects unchanged contents, and the single-flight rule prevents out-of-order responses from overwriting a newer accepted response.

If an inactive item disappears, it leaves the next navigation queue. If the currently playing object disappears, an already loaded browser resource may finish, but it cannot be selected again. The next navigation uses the current eligible queue. Unrelated items keep playback identity and current time.

## Owner feedback

The Vercel dashboard is the upload and file-management interface. VIAIMS does not add an owner dashboard. Upload progress and storage errors appear in Vercel. Catalogue/gate failures appear in Vercel function logs, while the public player quietly omits ineligible objects.

## Security and cost boundary

Use the existing public Blob store and project. The catalogue endpoint reads with a server-only token and exposes only allowlisted public fields. No Supabase project, custom authentication, private staging area, worker, scanning service, retention database, or new subscription is required for this design.

Implementation must stop if Vercel requires creating a paid resource or changing the current plan. Any Blob upload, deletion, move, deployment, credential change, or production publication remains separately approval-gated.

## Migration from the scope drift

The owner-mobile publishing specification, backend setup proposal, database draft, transactional catalogue, rename/reorder contract, and database-revision refresh model are superseded. Their files remain temporarily as a marked historical record so no existing work is silently discarded. The SQL remains unapplied. A later reviewed cleanup may delete the unused modules, tests, plans, and database draft.

The reusable parts of the prior work are limited to public-field allowlisting, fail-closed response handling, single-flight refresh timing, and active-playback reconciliation. They must be adapted to Blob pathnames and fingerprints before use.

## Verification and acceptance

Local implementation acceptance requires:

- contract tests for full pagination, prefix isolation, normalization, fingerprints, ordering, and malformed listings;
- runtime tests for first load, focus refresh, 15-second visible refresh, one in-flight request, last-good retention, and no bootstrap resurrection;
- native media metadata tests for playable and rejected video/audio candidates;
- both build modes and the complete existing test suite;
- browser verification that adding, moving, replacing, and deleting test objects changes the preview player without a website rebuild;
- final owner review on an actual phone before production release.

The remote Blob verification step needs separate approval because it mutates remote storage. Deployment and production publication need their own explicit approval.

## Explicitly outside this design

Custom owner authentication, an upload/admin page, Supabase, a database-backed catalogue, private intake storage, antivirus scanning, re-encoding workers, image/PDF presentation, commerce, and broader website release gates are outside this folder-catalogue slice.
