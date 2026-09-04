# VIAIMS Sidecar Media Playlist Order Design

**Date:** 2026-09-01  
**Status:** Approved in conversation; implementation deferred until the linked-folder ingestion phase

## 1. Purpose

Give the portfolio owner deterministic control of playlist display and playback order without renaming media files. Apply the rule independently to the future linked Cinema, Music, and Media folders.

## 2. Authoritative sidecar file

Each provider folder may contain one UTF-8 `playlist-order.json` file whose JSON value is an ordered array of source filenames:

```json
[
  "Opening.mp4",
  "Atlas.mp4",
  "Finale.mp4"
]
```

To insert `Interview.mp4` between the first two items, add one line at that position. Existing media filenames do not change.

- Entries are filenames only, not absolute paths or remote URLs.
- Every entry must name exactly one existing media file in the same provider folder.
- A filename may appear only once in its provider order file.
- Filename matching is exact, including extension and letter case.
- The order file itself is never treated as playable media.
- The Cinema order file cannot reference Music or Media files, and the same boundary applies to the other providers.

## 3. Listed and unlisted files

- Listed files appear first in the exact array order.
- Valid media files absent from the order file follow the listed files using case-insensitive natural filename order.
- This fallback makes newly added files visible without silently inserting them into a curated position.
- An empty array intentionally leaves every valid media file in fallback order.
- If `playlist-order.json` is absent, the entire provider uses fallback order.

## 4. Validation and failure behavior

Ingestion rejects the affected provider update when the order file:

- is not valid JSON;
- is not an array of non-empty filename strings;
- contains duplicate entries;
- references a missing file;
- contains a path separator, parent-directory traversal, or absolute path;
- references an unsupported file type for that provider.

The rejection reports the provider, order-file path, and offending entry. It does not publish a partial or guessed ordering. The last validated generated manifest remains available.

## 5. Ingestion and runtime contract

- The ingestion process reads each provider folder and its optional sidecar before any controlled upload or publication step.
- It records the original source filename before any service adds a content hash or rewrites the remote URL.
- It writes a validated numeric `playlistOrder` value into the generated manifest based on the resolved sidecar-plus-fallback sequence.
- Runtime library construction sorts each provider by the validated `playlistOrder` value.
- The rendered playlist and Previous/Next/automatic-advance playback consume the same sorted provider array. Display order and play order cannot diverge.
- Editing the sidecar changes order on the next successful local ingestion. It does not mutate a currently loaded browser session.

## 6. Provider boundaries

Cinema, Music, and Media each own an independent `playlist-order.json`. The order files do not combine the providers into one queue and do not alter YouTube channel behavior.

## 7. Replacement-media gate

The remote mobile/fidelity gate must not begin until Justin supplies the reduced-file-size replacement videos and songs. Receipt of those files authorizes local inspection and ingestion preparation only; upload, synchronization, or publication still requires the separate controlled-media-publication approval already defined by the project sequence.

## 8. Testing

The later ingestion implementation must use strict RED/GREEN tests covering:

- exact listed order;
- insertion without media-file renaming;
- deterministic natural ordering of unlisted files;
- absent and empty sidecars;
- independent Cinema, Music, and Media sequences;
- duplicate, missing, traversal, absolute-path, and unsupported-type rejection;
- identical display, Previous/Next, and automatic-advance order.

No media upload, synchronization, publication, deployment, hosting change, or DNS change is authorized by this design.
