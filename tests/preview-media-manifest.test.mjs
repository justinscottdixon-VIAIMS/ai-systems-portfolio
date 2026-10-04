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

test('preview manifest preserves approved Music titles and Blissful position', async () => {
  const manifest = await previewManifest();
  const audio = manifest.items.filter((item) => item.kind === 'audio');

  assert.ok(audio.length > 0);
  assert.equal(audio[1].id, 'audio-v-blissful-2026-pre-mstr');
  assert.equal(audio[1].title, 'Voyager - Blissful (2026 Navi Rmx)');
  for (const track of audio.filter(item => item.id !== audio[1].id)) assert.match(track.title, /^V_.+_$/, `${track.title} is not framed`);
  const production = JSON.parse(await readFile(new URL('../src/data/media.json', import.meta.url), 'utf8'));
  assert.deepEqual(production.items.filter(item => item.kind === 'audio'), audio);
});
