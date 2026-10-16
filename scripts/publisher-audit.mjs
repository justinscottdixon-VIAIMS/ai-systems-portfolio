import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { parseMusicIdentity } from '../src/lib/music-title.mjs';

const run = promisify(execFile);
const AUDIO = new Map([['.mp3', ['mp3']], ['.wav', ['pcm_s16le', 'pcm_s24le']], ['.m4a', ['aac']], ['.aac', ['aac']], ['.flac', ['flac']]]);
const VIDEO = new Set(['.mp4', '.mov', '.webm']);
export const MEDIA_EXTENSIONS = new Set([...AUDIO.keys(), ...VIDEO]);

export class AuditHold extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

export async function fileHash(filename) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filename)) hash.update(chunk);
  return hash.digest('hex');
}

export function auditMetadata(probe, { filename, provider, title }) {
  const extension = path.extname(filename).toLowerCase();
  const hold = (code, message) => { throw new AuditHold(code, message); };
  if (!['Cinema', 'Music', 'Media'].includes(provider) || !MEDIA_EXTENSIONS.has(extension)
      || (provider !== 'Music' && !VIDEO.has(extension))) hold('UNSUPPORTED_TYPE', 'This file type is not supported by this player.');
  if (/[\x00-\x1f\x7f]/.test(filename) || filename.length > 220) hold('INVALID_FILENAME', 'Use a shorter filename without control characters.');
  if (/(?:^|[ _-])(draft|test|temp|unfinished|demo|alpha|pre[ _-]?mstr)(?=[ _.(-]|$)/i.test(filename)) hold('REVIEW_NAME', 'The filename suggests a draft or test. Review and rename before publishing.');
  const duration = Number(probe.format?.duration);
  if (!Number.isFinite(duration) || duration <= 0 || duration > 14_400) hold('INVALID_DURATION', 'Duration must be readable, positive, and no longer than four hours.');
  const format = probe.format?.format_name?.split(',') ?? [];
  const expected = { '.mp4': 'mp4', '.mov': 'mov', '.m4a': 'm4a', '.mp3': 'mp3', '.wav': 'wav', '.flac': 'flac', '.aac': 'aac', '.webm': 'webm' }[extension];
  if (!format.includes(expected)) hold('MISLEADING_EXTENSION', 'The actual container does not match the filename extension.');
  const streams = probe.streams ?? [];
  const video = streams.filter(row => row.codec_type === 'video' && !row.disposition?.attached_pic);
  const audio = streams.filter(row => row.codec_type === 'audio');
  const kind = VIDEO.has(extension) ? 'video' : 'audio';
  if (kind === 'video') {
    const row = video[0];
    const codecs = extension === '.webm' ? ['vp8', 'vp9'] : ['h264'];
    if (video.length !== 1 || !codecs.includes(row?.codec_name) || !['yuv420p', 'yuvj420p'].includes(row?.pix_fmt)
        || !Number.isInteger(row.width) || row.width <= 0 || !Number.isInteger(row.height) || row.height <= 0) {
      hold('VIDEO_COMPATIBILITY', 'Use H.264 MP4/MOV or VP8/VP9 WebM with 8-bit 4:2:0 video.');
    }
    if (audio.some(row => !(extension === '.webm' ? ['opus', 'vorbis'] : ['aac', 'mp3']).includes(row.codec_name))) hold('AUDIO_COMPATIBILITY', 'The video audio codec needs review for browser playback.');
  } else if (video.length || audio.length !== 1 || !AUDIO.get(extension)?.includes(audio[0]?.codec_name)) {
    hold('AUDIO_COMPATIBILITY', 'Use MP3, AAC, FLAC, or 16/24-bit PCM WAV audio.');
  }
  if (audio.some(row => ![1, 2].includes(row.channels) || Number(row.sample_rate) < 8000 || Number(row.sample_rate) > 192000)) hold('AUDIO_LAYOUT', 'Use mono or stereo audio at a supported sample rate.');
  const identity = provider === 'Music' ? parseMusicIdentity(filename, title === undefined ? undefined : { overrideTitle: title }) : null;
  if (identity?.visualTag) hold('VISUAL_REVIEW', 'Tagged music visuals need a matching approved visual; this item is held for review.');
  const displayTitle = identity?.title ?? title ?? path.basename(filename, path.extname(filename)).replaceAll('_', ' ').trim();
  if (typeof displayTitle !== 'string' || !displayTitle.trim() || displayTitle.length > 250 || /[\x00-\x1f\x7f]/.test(displayTitle)) hold('INVALID_TITLE', 'A readable display title is required.');
  return {
    kind, title: displayTitle.trim(), duration,
    ...(kind === 'video' ? { width: video[0].width, height: video[0].height, aspect: video[0].height > video[0].width ? 'portrait' : video[0].height < video[0].width ? 'landscape' : 'square', codec: video[0].codec_name } : { codec: audio[0].codec_name, sampleRate: Number(audio[0].sample_rate), channels: audio[0].channels }),
  };
}

export async function auditSnapshot(snapshot, { filename, provider, title, runner = run } = {}) {
  const environment = { PATH: process.env.PATH ?? '/opt/homebrew/bin:/usr/bin:/bin', LANG: 'C' };
  let metadata;
  try {
    const { stdout } = await runner('ffprobe', ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', snapshot], { timeout: 120_000, maxBuffer: 2_000_000, env: environment });
    metadata = auditMetadata(JSON.parse(stdout), { filename, provider, title });
  } catch (error) {
    if (error instanceof AuditHold) throw error;
    throw new AuditHold('UNREADABLE_MEDIA', 'The file could not be inspected. It may be corrupt or incomplete.');
  }
  try {
    const { stderr = '' } = await runner('ffmpeg', [
      '-nostdin', '-hide_banner', '-nostats', '-v', metadata.kind === 'audio' ? 'info' : 'error', '-xerror', '-i', snapshot,
      ...(metadata.kind === 'audio' ? ['-map', '0:a:0', '-vn', '-af', 'volumedetect'] : ['-map', '0:v?', '-map', '0:a?']), '-f', 'null', '-',
    ], { timeout: 30 * 60_000, maxBuffer: 2_000_000, env: environment });
    if (metadata.kind === 'audio' && /max_volume:\s*-inf\s*dB/.test(stderr)) throw new AuditHold('SILENT_AUDIO', 'The audio is silent. Review before publishing.');
  } catch (error) {
    if (error instanceof AuditHold) throw error;
    throw new AuditHold('DECODE_FAILED', 'The complete media file could not be decoded without errors.');
  }
  return { ...metadata, contentHash: await fileHash(snapshot) };
}
