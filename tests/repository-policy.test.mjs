import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

const root = fileURLToPath(new URL('..', import.meta.url));

function isIgnored(relativePath) {
  return spawnSync('git', ['check-ignore', '-q', relativePath], { cwd: root }).status === 0;
}

test('local ingestion binaries are ignored while provider controls remain trackable', () => {
  for (const binary of [
    'media-ingest/Cinema/example.mp4',
    'media-ingest/Music/example.mp3',
    'media-ingest/Media/example.webm',
    'media-ingest/Media/Music-Visuals/example.mp4',
  ]) {
    assert.equal(isIgnored(binary), true, `${binary} must be ignored`);
  }

  for (const control of [
    'media-ingest/Cinema/.gitkeep',
    'media-ingest/Cinema/playlist-order.json',
    'media-ingest/Music/.gitkeep',
    'media-ingest/Music/playlist-order.json',
    'media-ingest/Media/.gitkeep',
    'media-ingest/Media/playlist-order.json',
    'media-ingest/Music/track-metadata.json',
    'media-ingest/Media/Music-Visuals/.gitkeep',
  ]) {
    assert.equal(isIgnored(control), false, `${control} must remain trackable`);
  }
});

test('Vercel source uploads exclude local payloads and secrets', async () => {
  const source = await readFile(new URL('../.vercelignore', import.meta.url), 'utf8');
  for (const rule of ['media-ingest/', 'public/media/', '.env', '.env.*']) {
    assert.match(source, new RegExp(`^${rule.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'));
  }
  assert.doesNotMatch(source, /media\.preview\.json/);
});
