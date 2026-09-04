import test from 'node:test';
import assert from 'node:assert/strict';
import { parseVideoProbe, probeVideoMetadata } from '../scripts/video-metadata.mjs';

test('ffprobe dimensions become validated portrait metadata', () => {
  assert.deepEqual(parseVideoProbe('{"streams":[{"width":720,"height":1280}]}', 'portrait.mp4'), {
    width: 720,
    height: 1280,
    aspect: 'portrait',
  });
});

test('missing or invalid video dimensions fail closed', () => {
  assert.throws(() => parseVideoProbe('{"streams":[]}', 'broken.mp4'), /broken\.mp4.*dimensions/i);
  assert.throws(() => parseVideoProbe('{bad', 'broken.mp4'), /broken\.mp4.*valid JSON/i);
});

test('probe invocation is injectable and requests the first video stream', async () => {
  const calls = [];
  const metadata = await probeVideoMetadata('/tmp/cue.mp4', {
    runner: async (command, args) => {
      calls.push([command, args]);
      return { stdout: '{"streams":[{"width":1920,"height":1080}]}' };
    },
  });
  assert.equal(calls[0][0], 'ffprobe');
  assert.equal(calls[0][1].includes('v:0'), true);
  assert.equal(metadata.aspect, 'landscape');
});
