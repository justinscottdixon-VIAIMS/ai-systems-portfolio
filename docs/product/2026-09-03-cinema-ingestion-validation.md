# Cinema ingestion validation

**Validated:** 2026-09-03  
**Scope:** Local adaptive-media shadow only  
**Publication state:** Not uploaded, synchronized, published, or deployed

## Result

Thirteen Cinema candidates are staged in `media-ingest/Cinema` and resolve in the explicit order stored in `playlist-order.json`. The source files in the main checkout remain preserved.

All staged files:

- open successfully as MP4 containers;
- contain a decodable video stream and a decodable stereo audio stream;
- pass full FFmpeg video-and-audio decode;
- place the `moov` atom immediately after `ftyp` for Fast Start playback.

`3I | ATLAS_1`, `3I | ATLAS_2`, and `3I | ATLAS_3` required container-only Fast Start repair. FFmpeg stream-copy mode was used; their video and audio were not recompressed.

## Staged order and technical profile

| Order | Asset | Video | Frame | Rate | Audio | Approx. total bitrate |
|---:|---|---|---|---:|---|---:|
| 1 | 3I \| ATLAS 1 | H.264 | 720x1280 | 30 | AAC, 48 kHz stereo | 4.62 Mbps |
| 2 | 3I \| ATLAS 2 | H.264 | 720x1280 | 30 | AAC, 48 kHz stereo | 4.87 Mbps |
| 3 | 3I \| ATLAS 3 | H.264 | 720x1280 | 30 | AAC, 48 kHz stereo | 4.85 Mbps |
| 4 | 3I \| ATLAS 4 | H.264 | 720x1280 | 30 | AAC, 48 kHz stereo | 3.19 Mbps |
| 5 | 3I \| ATLAS 5 | H.264 | 720x1204 | 30 | AAC, 48 kHz stereo | 3.19 Mbps |
| 6 | 3I \| ATLAS 8 | H.264 | 1920x1080 | 30 | AAC, 48 kHz stereo | 3.19 Mbps |
| 7 | 3I \| ATLAS 10 | HEVC | 1080x608 | 30 | AAC, 44.1 kHz stereo | 12.39 Mbps |
| 8 | 3I \| ATLAS 11 | H.264 | 1080x1920 | 30 | AAC, 48 kHz stereo | 3.19 Mbps |
| 9 | 3I \| ATLAS 12 | H.264 | 1080x1920 | 30 | AAC, 48 kHz stereo | 3.19 Mbps |
| 10 | 3I \| ATLAS 13 | H.264 | 1080x1920 | 30 | AAC, 48 kHz stereo | 3.19 Mbps |
| 11 | 3I \| ATLAS 14 | H.264 | 1080x1920 | 29.97 | AAC, 48 kHz stereo | 3.24 Mbps |
| 12 | 3I \| ATLAS 15 | H.264 | 1080x1920 | 30 | AAC, 48 kHz stereo | 3.20 Mbps |
| 13 | V Neuron Pong 2026 MSTR | H.264 | 1920x1080 | 30 | AAC, 48 kHz stereo | 5.20 Mbps |

## Size result

The 12 ATLAS source files total 1,341,794,666 bytes. Their staged counterparts total 385,199,908 bytes, a 71.3% reduction. The new Neuron asset adds 56,566,199 bytes, producing a complete staged Cinema set of approximately 441.8 MB in decimal units.

## Exceptions for approval awareness

- `ATLAS_5` is 720x1204 rather than 720x1280.
- `ATLAS_8` and the Neuron asset are 1920x1080 landscape.
- `ATLAS_11` through `ATLAS_15` remain 1080x1920 portrait rather than 720x1280, although their bitrate is near 3.2 Mbps.
- `ATLAS_10` is HEVC at approximately 12.4 Mbps with 44.1 kHz AAC. It is Fast Start compliant but differs materially from the H.264/48 kHz delivery profile.
- `ATLAS_2` and `ATLAS_3` are approximately 4.85 Mbps with roughly 300 kbps AAC rather than the newer 3 Mbps/192 kbps target.

These exceptions are documented rather than silently transcoded. Any further recompression requires an explicit quality decision.

## Remaining gate

The Cinema tranche is ready for local shadow use. The remote mobile/fidelity gate remains incomplete until reduced Music assets are supplied and validated. Upload, Blob synchronization, production-manifest replacement, deployment, and production changes still require separate approval.
