# Automatic local media publishing

The owner approved automatic publication of technically valid files on 16 October 2026. New drops belong in a dedicated `VIAIMS Publishing` folder, with direct `Cinema`, `Music` and `Media` subfolders. Existing `media-ingest` preparation files are separate and are not automatically enrolled.

## Daily operation

1. Export a finished file and copy it into the intended player folder.
2. Open `Publishing Status.html` in the publishing folder. It refreshes every 15 seconds.
3. The watcher waits at least 15 seconds after the last observed change, snapshots the file, checks metadata and fully decodes it. Accepted files upload and register automatically. The website refreshes its catalogue while visible without rebuilding the site.
4. Duplicates and questionable files remain local with an explanation. Originals are never moved or deleted. Deleting a local original does not remove a public release.

`Start Publishing.command` and `Stop Publishing.command` control the installed login service. The Mac must be awake, logged in, and online. Interrupted operations retry with backoff. The portable runtime under `.viaims-publisher/runtime` continues working independently of a development worktree. Do not delete that hidden folder.

## Supported delivery files

Cinema and Media accept H.264 MP4/MOV with 8-bit 4:2:0 video, or VP8/VP9 WebM. Video audio uses AAC/MP3 or Opus/Vorbis as appropriate. Music accepts compatible video, MP3, AAC/M4A, FLAC, or 16/24-bit PCM WAV. Audio must be mono/stereo, 8–192 kHz. Files must be nonempty, at most 2 GiB and four hours long. Unsupported codecs, corruption, silence in audio-only files, draft/test names, changing sources, symlinks, title collisions and unmatched tagged Music visuals are held for review. These are delivery checks, not artistic/mastering certification. There is no automatic conversion or AI processing.

Default titles come from filenames, using the existing Music formatting rules. An optional `Song.mp3.json` beside `Song.mp3` can contain `{"title":"Preferred title"}`. A metadata edit or source change triggers a new audit. A different recording with an already published title requires review instead of replacing it automatically. Playlist entries append in publication order; this version does not provide a reorder/unpublish interface. Images and PDF documents require a future presentation design.

## Architecture and recovery

- `scripts/publisher-audit.mjs`: native inspection, complete decode and SHA-256.
- `scripts/publisher-watcher.mjs`: stable-copy detection, private snapshots, lock, persistent status and retry handling.
- `scripts/publisher-upload.mjs`: immutable content-addressed upload followed by conditional catalogue commit.
- `src/lib/approved-catalogue*.mjs`: strict public registry, origin reads, ETag concurrency and endpoint handling.
- `scripts/seed-approved-catalogue.mjs`: register existing approved URLs without uploading media again.
- `scripts/prepare-publisher-service.mjs`: prepare a standalone bundled runtime and a macOS LaunchAgent definition; it does not install the LaunchAgent itself.

The single authoritative public registry is `VIAIMS/approved-catalogue.json` in the existing Blob store. Only allowlisted public media fields are stored there. Local file paths, owner reports and credentials stay local. `get(..., {useCache:false})` reads origin to avoid stale registry data. Registry updates use `ifMatch` and retry against the latest registry. Failed uploads and failed commits cannot publish partial playlist entries. Failed runtime catalogue reads retain the player's last accepted library. The server returns 503 if the registry is missing or malformed.

`VIAIMS_CATALOGUE_REFRESH=enabled` enables both client refresh and the server catalogue for the full site. Remove that setting and redeploy, or roll back the application deployment, to return to bundled playlists. Turning off the publisher stops new releases while already published files remain online. Do not clear the registry or delete local state as a recovery shortcut.

## Setup commands

From the site checkout, use a dedicated empty publishing root and the existing private environment file. Do not enter tokens in commands or chat.

```sh
node scripts/seed-approved-catalogue.mjs --env-file /path/to/existing/.env.local
node scripts/seed-approved-catalogue.mjs --env-file /path/to/existing/.env.local --write
node scripts/prepare-publisher-service.mjs --root '/path/to/VIAIMS Publishing' --env-file /path/to/existing/.env.local --node /opt/homebrew/bin/node
```

Install the prepared `com.viaims.media-publisher.plist` from the root's `.viaims-publisher` directory into the owner's `~/Library/LaunchAgents`, then bootstrap it in their GUI login session. This installation is a host change; verify the intended root and existing service before installing. Tokens are read from the existing environment file and are not embedded in the plist or runtime. The Node executable and ffmpeg/ffprobe must remain installed.

For manual audit-only scans use `npm run media:publisher -- --root '/path/to/VIAIMS Publishing' --once`. The first scan observes new files; repeat after the settling interval to audit them. Omit `--once` to keep scanning. Actual uploads require `--publish --env-file /path/to/existing/.env.local`.
