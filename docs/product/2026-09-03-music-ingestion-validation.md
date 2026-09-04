# Music ingestion validation

**Validated:** 2026-09-03  
**Scope:** Local adaptive-media shadow only  
**Publication state:** Not uploaded, synchronized, published, or deployed

## Result

Seven Music candidates are staged in `media-ingest/Music` and resolve in the explicit order stored in `playlist-order.json`. Source copies remain in the main checkout.

All seven files:

- are MPEG Layer III audio;
- contain a decodable stereo stream at 48 kHz and 320 kbps;
- pass complete FFmpeg audio decoding;
- match their source MP3 bytes by SHA-256 after staging.

The staged Music set totals 64,169,506 bytes, or approximately 64.2 MB in decimal units.

## Staged order

| Order | Filename | Duration |
|---:|---|---:|
| 1 | `1._metafysion one.mp3` | 3:21.00 |
| 2 | `V_edges fade_voo1.1.2_48k24b_mstr.mp3` | 4:30.40 |
| 3 | `V_experlénčë_v12.mp3` | 4:18.00 |
| 4 | `V_manic_manIA__mstr.mp3` | 3:29.72 |
| 5 | `V_motion_mine_mk4.15.mp3` | 3:41.80 |
| 6 | `V_msnic_M_alpha_v01 (1).mp3` | 3:19.96 |
| 7 | `V_saymynane_v45_agtr_stem4.1.mp3` | 4:02.84 |

The filenames are preserved as supplied. Visitor-facing titles can be curated independently later without renaming the media or changing playlist position.

## Remaining gate

The reduced Cinema and Music trees are now locally supplied, ordered, and validated. Creating temporary remote preview access, uploading media, synchronizing Blob objects, replacing the production manifest, deploying, or changing production still requires separate explicit approval.
