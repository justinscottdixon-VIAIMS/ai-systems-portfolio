# VIAIMS local media-ingestion tree

This folder is the empty, local preparation surface for future replacement media:

```text
media-ingest/
  Cinema/
  Music/
  Media/
```

Each provider may contain a UTF-8 `playlist-order.json` array listing filenames in the desired order. Listed files appear first; valid unlisted files follow in natural filename order.

Example:

```json
[
  "Opening.mp4",
  "Interview.mp4",
  "Finale.mp4"
]
```

The current ingestion catalog is validation-only. It does not upload files, call Vercel Blob, replace `src/data/media.json`, publish media, or alter production. Those actions remain behind the separate controlled-media-publication approval gate.

For a future externally linked folder, pass that provider-tree path as `rootDirectory` to `discoverIngestionCandidates`. The external root must contain the same `Cinema`, `Music`, and `Media` subfolders.
