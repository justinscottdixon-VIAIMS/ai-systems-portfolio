# Local media publisher

Approved direction: the owner accepted automatic publication after a technical audit on 16 October 2026. Files needing attention and duplicate content remain held. This extends the earlier folder catalogue design with a local watcher and an audited catalogue; it does not reinstate the superseded upload website/database design.

## Owner workflow

Use a stable local `VIAIMS Publishing` folder in the project workspace, with `Cinema`, `Music`, and `Media` subfolders. A background process periodically scans direct files, waits for writes to settle, copies a stable private snapshot, validates format and metadata, decodes the whole snapshot, computes SHA-256, and publishes accepted content. Originals remain untouched. Removing a local file does not remove a public release. Replacements and filename/title conflicts are held instead of overwriting. Status is recorded locally as JSON and a readable HTML report. Existing preparation folders are not enrolled as new publication instructions.

## Publication boundary

Upload immutable media to content-addressed paths in the existing public Blob store only after audit. Commit its public catalogue entry separately with an ETag-conditional write to `VIAIMS/approved-catalogue.json`. Failed uploads or failed registry writes cannot become visible playlist entries. Retries reuse immutable media. Registry writes merge with the latest complete registry and fail on conflicting titles or content. No automatic deletion, conversion, new service, or paid plan is introduced.

Seed the registry with the current approved manifest and curated native media, preserving titles, order and URLs. Verify each existing URL against the configured store before registering it. The registry contains public player fields only. Local paths, audit reports, credentials and owner data never enter it. An explicit migration marker distinguishes an initialized empty catalogue from missing data. The existing live-refresh switch stays off until the seeded catalogue is verified against the current players.

## Runtime

The server reads the audited registry directly from Blob origin, validates the complete snapshot, and returns the existing strict authoritative envelope. Failed, missing, partial or invalid registries produce no-store 503; clients retain their last accepted library. Existing native browser metadata checks, visibility/focus refresh and 15-second polling continue. Media remains hidden until playable Media entries exist; then it appears without a rebuild and keyboard navigation includes it.

## Checks and lifecycle

Use installed ffprobe/ffmpeg for codecs, dimensions, audio channels/rate, duration and full decode. Reject empty, corrupt, unsupported, changing, symlinked or misleading-extension files. Hold draft/test names and title collisions. Match checksums within a provider to prevent duplicate publication. Serialize local scans with an exclusive process lock; use conditional remote registry writes to handle concurrent clients. Persist published/held states and retry transient failures with bounded backoff. Stop cleanly on SIGTERM, resume after restart, and run while the Mac is awake with network access. Credentials are loaded from the existing private environment file, never copied into the drop folder or plist.

Acceptance: meaningful audit, registry, retry, lock, duplicate and partial-failure tests; full regression suite/build; real-file read-only audit; isolated remote round trip; seeded migration preserves current released items; browser confirms polling, retained playback and Media-tab visibility; production endpoint and a post-launch local watcher status check. Start the watcher only after the pipeline and live migration are verified.
