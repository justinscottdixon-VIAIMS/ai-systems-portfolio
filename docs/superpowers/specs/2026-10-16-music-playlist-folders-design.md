# Music playlist folders

The owner approved trying three genre/playlist folders inside Music, with one folder per track, on 16 October 2026.

Start with 01 Playlist One containing all eight currently published tracks, and empty 02 Playlist Two / 03 Playlist Three. The owner names and arranges genres. Existing releases retain their immutable URLs and IDs. Each folder carries a hidden stable playlist or track identity so moves and renames update metadata rather than duplicating uploads. Leading numbers sort folders naturally and are omitted from public labels. Duplicate ordering numbers, copied identities, ambiguous media, symlinks and replacement recordings are held for review.

New track folders contain one finished supported audio/video export. Artwork and notes may be stored alongside it but are not published by this change. Known tracks can contain an online shortcut instead of a full local media copy. Existing flat drops remain compatible during migration. Deleting a track folder does not unpublish it.

Folder changes settle for 15 seconds, then update genre membership/title/global track ordering through a conditional approved-registry write. Reads use authoritative metadata plus verified ETags, and stale/failed reads preserve current public releases. The local reference refresh uses the folder structure for Music while Cinema and Media retain their existing reference folders.

The website projects allowlisted optional Music playlist metadata and adds an accessible playlist selector. Empty folders are local until populated. Browsing playlists preserves current playback; the selected playlist owns the next queue. Runtime metadata refreshes preserve playing audio position and source identity. Both old and new catalogue shapes remain valid.

Verify migration, rename/reorder/move, quiet interval, concurrent directory changes, replacement holds, symlinks/duplicates, no unpublish, display/queue agreement and playback retention. Test against isolated folders and a local API preview before installing or changing the live registry. No new dependency, credential or paid service is required.

Owner steering during implementation extends this same model to Cinema series and adds `04 Music Videos`. Cinema starts with ATLAS videos together and Neuron Pong in Other Videos. Each provider uses its own controller/state and the same public metadata allowlist. Wrong media kind is held. Four main controls remain Cinema/Music/YouTube/Credentials, with no duplicate Credentials playlist below the theater. Existing native transport/lease/meter behavior is preserved.
