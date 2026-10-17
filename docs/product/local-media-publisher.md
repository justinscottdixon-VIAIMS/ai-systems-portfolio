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

Default titles come from filenames, using the existing Music formatting rules. An optional `Song.mp3.json` beside `Song.mp3` can contain `{"title":"Preferred title"}`. A metadata edit or source change triggers a new audit. A different recording with an already published title requires review instead of replacing it automatically. Flat-folder additions append in publication order; Playlist Studio provides ordering, title edits and reversible removal. Images and PDF documents require a future presentation design.

## Architecture and recovery

- `scripts/publisher-audit.mjs`: native inspection, complete decode and SHA-256.
- `scripts/publisher-watcher.mjs`: stable-copy detection, private snapshots, lock, persistent status and retry handling.
- `scripts/publisher-upload.mjs`: immutable content-addressed upload followed by conditional catalogue commit.
- `src/lib/approved-catalogue*.mjs`: strict public registry, origin reads, ETag concurrency and endpoint handling.
- `scripts/seed-approved-catalogue.mjs`: register existing approved URLs without uploading media again.
- `scripts/prepare-publisher-service.mjs`: prepare a standalone bundled runtime and a macOS LaunchAgent definition; it does not install the LaunchAgent itself.

The single authoritative public registry is `VIAIMS/approved-catalogue.json` in the existing Blob store. Only allowlisted public media fields are stored there. Local file paths, owner reports and credentials stay local. Each read obtains authenticated pointer metadata, then reads an immutable revision named by that ETag. The revision is saved before the conditional pointer update; an existing revision is reused only after authenticated metadata confirms identical bytes. Older registries fall back to a download URL and are accepted only when their body ETag matches the pointer. Stale or failed reads retain the last accepted library. Registry updates use `ifMatch` and retry against the latest registry. Failed uploads and failed commits cannot publish partial playlist entries. Failed runtime catalogue reads retain the player's last accepted library. The server returns 503 if the registry is missing or malformed.

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

## Complete local playlist reference

`LIVE PLAYLISTS.txt` in the publishing root lists every published Cinema, Music and Media title in website order, including older releases whose originals remain elsewhere. `LIVE REGISTRY.json` is the validated machine-readable copy; `LIVE PLAYLISTS STATUS.txt` reports freshness or a failed refresh.

In legacy flat-folder mode, each player folder has a generated `Published Playlist` directory containing numbered `.webloc` shortcuts and a `PLAYLIST.txt`. Sort Finder by Name to see the sequence; open a shortcut to play the hosted media online. These are links, not offline media copies. New exports still go directly into the parent Cinema, Music or Media folder. The watcher ignores the reference directories and `README.txt`.

The local service refreshes this reference about once a minute. A failed read retains the last successful lists and records a generic failure status. Reconciliation removes only unchanged, previously generated shortcuts; unrelated or edited files are preserved. Editing or renaming a reference does not change the public playlist. In folder mode below, playlist/series folders replace these flat references and control ordering. No media or catalogue writes are performed by the reference refresh itself.

## Playlist and series folder mode — 16 October 2026

Music now supports three owner-named audio playlists plus `04 Music Videos`; Cinema supports `01 3I ATLAS`, `02 Other Videos`, and `03 New Series` initially. Each playlist/series contains one numbered folder per release. Renaming or moving that folder controls display title, membership and order. Names omit leading numbers on the website. Existing releases retain stable IDs and hosted media URLs. The hidden `.playlist.json` and `.track.json` markers must stay with their folders. Duplicate numbers or copied identities hold the layout for review.

Place one finished supported audio/video export directly in a new track/video folder. Notes and artwork are retained locally but not published by this change. More than one playable export is held. `Music Videos` requires video; the three audio playlists require audio. Existing releases can use `Listen online.webloc` without duplicating their media. When organized local copies are created, their original flat drops are preserved in `.viaims-publisher/original-flat-drops`; prior generated references are preserved in `previous-music-reference` / `previous-cinema-reference`.

Changes settle for 15 seconds before a conditional metadata-only registry update. Folder moves never reupload media. Different audio/video bytes in an already linked release folder require replacement review. Removing a local folder does not unpublish its release. Status is in `Music Playlist Status.txt`, `Cinema Playlist Status.txt`, and `Publishing Status.html`. `LIVE PLAYLISTS.txt` and `LIVE REGISTRY.json` still mirror the complete approved registry.

The public controls are Cinema, Music, YouTube, Credentials. Music has a playlist selector; Cinema has a series selector. Only populated groups appear online. Genre/series browsing preserves current media playback. The selected group limits rows and the Next/Previous queue. Credentials opens its directory in the theater; its duplicate lower playlist is removed. Media remains outside the four main controls.

Provider folder controllers are implemented in `scripts/music-folder-layout.mjs` with a provider option, shared by Music and Cinema. Initialize folders through `initializeMusicFolders({root,registry,provider,moveLocalFiles})` only after saving the pre-migration registry and validating the target tree. Deploy schema support before enabling folder synchronization against production. Rollback must restore the saved registry without playlist metadata before rolling back to a server that rejects those fields.

## Playlist Studio — current workflow, 17 October 2026

The owner reviewed and approved the installed visual organizer on 17 October. Open `Open Playlist Studio.command` in the publishing folder, or visit `http://127.0.0.1:4350/` on this Mac. The existing login publisher runs it. Music, Music Videos and Cinema have separate groups, including empty groups that appear publicly once populated.

Use the interface to edit titles, move recordings between compatible playlists, and reorder playlists or recordings with dragging or move buttons. Preview recordings before publishing. Drop a finished file into the selected playlist or use the file picker: complete format/decode inspection precedes automatic publication. Duplicates and questionable files remain visible for review. Replacement requires an inspected candidate and explicit confirmation. Remove hides an entry without deleting its media; Removed recordings provides Restore.

Changes update the existing live catalogue automatically without a Git commit or site rebuild. Existing identities and hosted media are preserved. When Playlist Studio is enabled, the earlier numbered-folder controllers are disabled; use the organizer for subsequent title, membership and order changes. Original folders and files remain available locally.

The interface listens only on this Mac. It uses a per-launch session and same-origin checks; cloud credentials stay in the local publisher process. Each catalogue edit saves a private recovery snapshot under `.viaims-publisher/manager/history`. Activation also saves the previous runtime, registry and configurations under `.viaims-publisher/manager-install-backups`. Do not put these private runtime directories or media copies into the public source repository.

Implementation: `scripts/playlist-manager-{model,import,service,server}.mjs`, `tools/playlist-manager/` and `tests/playlist-manager.test.mjs`. `scripts/activate-playlist-manager.mjs` performs initial activation with backups; it is not needed for ordinary operation or a website redeployment. Keep the Mac awake, logged in and online for imports and edits.
