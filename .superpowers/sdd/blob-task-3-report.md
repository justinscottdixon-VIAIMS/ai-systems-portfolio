# Blob catalogue Task 3 report

Date: 2026-09-04

## Delivered contract

Added `api/media-catalog.mjs`, a read-only Vercel Node Function source. Its exported `createMediaCatalogueHandler({ listPage, readText })` accepts injected dependencies for local tests, while the default handler supplies `@vercel/blob` `list()` with only `process.env.BLOB_READ_WRITE_TOKEN` and an origin-refreshing sidecar reader.

- `GET` builds and returns the complete `buildBlobFolderCatalogue()` envelope with `Content-Type: application/json; charset=utf-8` and `Cache-Control: public, s-maxage=15, must-revalidate`.
- Methods other than `GET` return `405`, `Allow: GET`, and a JSON error.
- Blob listing and sidecar-read failures return only `503`, `Cache-Control: no-store`, and `{ "error": "Media catalogue unavailable" }`. Error details, request headers, credentials, and client query options are not returned.
- Sidecar reads use `cache: 'no-store'`, reject failed HTTP responses, and reject payloads over 64 KiB.

The plan's sample relied on Vercel's response `.json()` to supply JSON content type. The implementation sets that header explicitly so the same HTTP contract is observable with lightweight Node response fakes. This does not change the external contract.

## TDD evidence

1. Created `tests/media-catalog-endpoint.test.mjs` before the Function module existed.
2. Ran `node --test tests/media-catalog-endpoint.test.mjs`; it failed with the expected `ERR_MODULE_NOT_FOUND` for `api/media-catalog.mjs`.
3. Added the smallest injectable handler implementation.
4. The first green run exposed an incorrect expected SHA-256 fingerprint for the empty item array in the test. Corrected that test expectation to the catalogue module's actual deterministic fingerprint, then reran it successfully: 4/4 endpoint tests passed.

The endpoint tests use only injected `listPage` and `readText` fakes. They cover the successful envelope and fixed list options, method rejection, an error containing a token-like internal message, and a failed playlist-order sidecar. No test uses a Blob store, network call, credential, upload, deployment, or remote mutation.

## Verification

- `node --test tests/blob-folder-catalogue.test.mjs tests/media-catalog-endpoint.test.mjs` — 13/13 passed.
- `npm test` — 341/341 passed.
- `npm run build` — Astro static build passed.
- `git diff --check` — passed before committing the implementation.

## Files and commits

- `api/media-catalog.mjs`
- `tests/media-catalog-endpoint.test.mjs`
- Implementation commit: `29d6012 feat: expose Blob media catalogue endpoint`

This report is committed separately as Task 3 documentation.

## Self-review and concerns

The Function never reads request query fields, tokens, cursors, or headers into its Blob call. The Blob access token remains confined to the default server-side dependency. The error branch deliberately logs only a fixed server message, avoiding accidental credential or sidecar-detail logging.

`npm run build` confirms the static Astro project still builds with the Function directory present, but it does not emulate Vercel routing or execute the default dependency against a configured Blob store. Those checks require separately authorized deployment-environment verification; no remote action was taken here.
