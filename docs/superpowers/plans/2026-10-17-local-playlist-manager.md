# Local Visual Playlist Manager Implementation Plan

Owner approved building the local visual playlist manager on 17 October. Reuse the existing audited publisher and Blob registry; preserve active media, stable identities, originals and unrelated changes. No website deployment is needed for catalogue changes.

## Approved design

Private localhost app with Music, Music Videos and Cinema sections. Sidebar lists genre playlists/series, including empty groups. Main area shows every published track in playlist order plus pending files. Drag or use accessible move buttons to reorder; edit titles and membership without renaming files. Native preview dock plays selected media. Add files by picker/drop, audit automatically, publish valid additions and display errors/duplicates. Explicit replacement selection audits first, then presents a confirmable replacement. Removing an item from the site is reversible and does not delete its media.

On activation, preserve the public registry and prior folder configurations, import existing groups and folder intent, and disable the old Music/Cinema numbering controllers. A duplicated copied folder identity with different media becomes a new pending recording; never overwrite its original release. Local files stay in place. Existing flat intake remains compatible. Manager refreshes from the authoritative registry and uses conditional writes with concurrency checks. Every edit keeps a local recovery snapshot.

## Units and validation

1. `scripts/playlist-manager-model.mjs`: validated playlists, pure rename/move/order/remove/restore operations, catalogue-field preservation. Test order, kind isolation, duplicate titles, stable IDs and unrelated providers.
2. `scripts/playlist-manager-service.mjs`: persistent local groups/jobs, safe read-only folder import, serialized edits, fresh registry CAS/retries, audited immutable intake and explicit replacement. Test failed writes, concurrent changes, duplicate identity migration and held files.
3. `scripts/playlist-manager-server.mjs`: loopback-only HTTP server, per-launch session bootstrap, same-origin mutation guard, bounded JSON/uploads, fixed static assets, authenticated local previews with ranges. Test host/origin/auth/path/size rejection and functional routes.
4. `tools/playlist-manager/`: responsive, keyboard-accessible HTML/CSS/JS UI with playlist editing, drag and move controls, file drop, progress/status, previews and reversible remove. No credentials in browser data.
5. Existing publisher starts the manager when enabled. Bundle UI with portable runtime; activate only after tests, independent review, recovery snapshots and local browser checks. Verify real import, a reversible live metadata change and unchanged media identities; leave an Open Playlist Manager shortcut.

## Completion

Run focused tests then full suite/build, independent code/security-boundary review, browser desktop/narrow checks and authenticated real-service read/write/read-back. Document local URL/launcher, automatic sync behavior and limitations. Do not claim installation, publishing or playback based only on a mock. Do not deploy site changes or push this feature without a corresponding owner request.
