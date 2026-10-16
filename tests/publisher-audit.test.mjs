import test from 'node:test';
import assert from 'node:assert/strict';
import { auditMetadata, auditSnapshot, AuditHold } from '../scripts/publisher-audit.mjs';

const video = { format: { duration: '12', format_name: 'mov,mp4,m4a,3gp,3g2,mj2' }, streams: [{ codec_type: 'video', codec_name: 'h264', pix_fmt: 'yuv420p', width: 720, height: 1280 }] };
const music = { format: { duration: '120', format_name: 'mp3' }, streams: [{ codec_type: 'audio', codec_name: 'mp3', channels: 2, sample_rate: '48000' }] };
test('audit derives actual codec, aspect and audio properties', () => {
  assert.equal(auditMetadata(video, { filename: 'Finished.mp4', provider: 'Cinema' }).aspect, 'portrait');
  assert.equal(auditMetadata(music, { filename: 'V_Track.mp3', provider: 'Music' }).sampleRate, 48000);
  assert.equal(auditMetadata(video, { filename: 'Finished.mp4', provider: 'Music' }).kind, 'video');
});
for (const [name, probe, options, code] of [
  ['wrong container', video, { filename: 'Finished.webm', provider: 'Cinema' }, 'MISLEADING_EXTENSION'],
  ['draft name', video, { filename: 'My draft.mp4', provider: 'Cinema' }, 'REVIEW_NAME'],
  ['unsupported image', video, { filename: 'Finished.jpg', provider: 'Media' }, 'UNSUPPORTED_TYPE'],
  ['unsupported video codec', { ...video, streams: [{ ...video.streams[0], codec_name: 'hevc' }] }, { filename: 'Finished.mp4', provider: 'Cinema' }, 'VIDEO_COMPATIBILITY'],
  ['multichannel music', { ...music, streams: [{ ...music.streams[0], channels: 6 }] }, { filename: 'Track.mp3', provider: 'Music' }, 'AUDIO_LAYOUT'],
  ['missing duration', { ...music, format: { format_name: 'mp3' } }, { filename: 'Track.mp3', provider: 'Music' }, 'INVALID_DURATION'],
  ['unmatched music visual', music, { filename: 'Track__VIZ-SPACE.mp3', provider: 'Music' }, 'VISUAL_REVIEW'],
]) test(`audit holds ${name}`, () => assert.throws(() => auditMetadata(probe, options), { code }));
test('complete decode failure holds an otherwise readable file', async () => {
  await assert.rejects(auditSnapshot('/not-read', { filename: 'Finished.mp4', provider: 'Cinema', runner: async (cmd, args) => {
    if (cmd === 'ffprobe') return { stdout: JSON.stringify(video) };
    assert.ok(args.includes('-xerror')); throw new Error('decode failure');
  } }), { code: 'DECODE_FAILED' });
});
test('silent audio is held and upstream diagnostics are not exposed', async () => {
  await assert.rejects(auditSnapshot('/not-read', { filename: 'Track.mp3', provider: 'Music', runner: async cmd => cmd === 'ffprobe' ? { stdout: JSON.stringify(music) } : { stderr: 'max_volume: -inf dB' } }), { code: 'SILENT_AUDIO' });
  await assert.rejects(auditSnapshot('/not-read', { filename: 'Finished.mp4', provider: 'Cinema', runner: async () => { throw new Error('private/path token'); } }), error => error instanceof AuditHold && !error.message.includes('private'));
});
test('empty Music title is held with useful explanation',()=>assert.throws(()=>auditMetadata(music,{filename:'Track.mp3',provider:'Music',title:''}),{code:'INVALID_TITLE'}));
test('missing inspection tools and process timeouts remain retryable',async()=>{
  for(const props of [{code:'ENOENT'},{code:'ETIMEDOUT',killed:true}]) await assert.rejects(auditSnapshot('/not-read',{filename:'Finished.mp4',provider:'Cinema',runner:async()=>{throw Object.assign(new Error('tool failed'),props);}}),error=>!(error instanceof AuditHold)&&error.code==='AUDIT_UNAVAILABLE');
});
test('audit passes cancellation to native tools and preserves abort',async()=>{
  const c=new AbortController();c.abort();
  await assert.rejects(auditSnapshot('/not-read',{filename:'Finished.mp4',provider:'Cinema',signal:c.signal,runner:async(_,__,options)=>options.signal.throwIfAborted()}),{name:'AbortError'});
});
