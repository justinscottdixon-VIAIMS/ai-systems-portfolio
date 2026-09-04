import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const manifestPath = new URL('../src/data/media.preview.json', import.meta.url);

async function previewManifest() {
  return JSON.parse(await readFile(manifestPath, 'utf8'));
}

test('preview manifest carries validated dimensions for every native video', async () => {
  const manifest = await previewManifest();
  const videos = manifest.items.filter((item) => item.kind === 'video');

  assert.ok(videos.length > 0);
  for (const video of videos) {
    assert.ok(Number.isInteger(video.width) && video.width > 0, `${video.title} is missing width`);
    assert.ok(Number.isInteger(video.height) && video.height > 0, `${video.title} is missing height`);
    assert.ok(['portrait', 'landscape', 'square'].includes(video.aspect), `${video.title} is missing aspect`);
  }
});

test('preview manifest carries the approved framed Music display titles', async () => {
  const manifest = await previewManifest();
  const audio = manifest.items.filter((item) => item.kind === 'audio');

  assert.ok(audio.length > 0);
  for (const track of audio) assert.match(track.title, /^V_.+_$/, `${track.title} is not framed`);
});
