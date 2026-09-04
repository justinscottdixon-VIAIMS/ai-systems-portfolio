import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { discoverIngestionCandidates } from '../scripts/ingestion-catalog.mjs';

async function tree() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'viaims-ingestion-'));
  await Promise.all(['Cinema', 'Music', 'Media'].map((provider) => mkdir(path.join(root, provider))));
  return root;
}

test('ingestion discovery resolves independent provider sidecars without writing files', async () => {
  const root = await tree();
  await writeFile(path.join(root, 'Cinema', 'Opening.mp4'), 'cinema');
  await writeFile(path.join(root, 'Cinema', 'Finale.mp4'), 'cinema');
  await writeFile(path.join(root, 'Cinema', 'playlist-order.json'), '["Finale.mp4","Opening.mp4"]\n');
  await writeFile(path.join(root, 'Music', 'Song 10.wav'), 'music');
  await writeFile(path.join(root, 'Music', 'Song 2.wav'), 'music');
  await writeFile(path.join(root, 'Media', 'Interview.webm'), 'media');

  const before = await readFile(path.join(root, 'Cinema', 'playlist-order.json'), 'utf8');
  const catalog = await discoverIngestionCandidates({ rootDirectory: root });

  assert.deepEqual(catalog.cinema.map(({ filename, playlistOrder }) => ({ filename, playlistOrder })), [
    { filename: 'Finale.mp4', playlistOrder: 0 },
    { filename: 'Opening.mp4', playlistOrder: 1 },
  ]);
  assert.deepEqual(catalog.music.map((item) => item.filename), ['Song 2.wav', 'Song 10.wav']);
  assert.deepEqual(catalog.media.map((item) => item.filename), ['Interview.webm']);
  assert.equal(catalog.cinema[0].provider, 'cinema');
  assert.equal(path.isAbsolute(catalog.cinema[0].absolutePath), true);
  assert.equal(await readFile(path.join(root, 'Cinema', 'playlist-order.json'), 'utf8'), before);
});

test('ingestion discovery ignores hidden files directories and unsupported files', async () => {
  const root = await tree();
  await writeFile(path.join(root, 'Cinema', '.hidden.mp4'), 'hidden');
  await writeFile(path.join(root, 'Cinema', 'notes.txt'), 'notes');
  await mkdir(path.join(root, 'Cinema', 'Nested'));
  await writeFile(path.join(root, 'Music', 'Song.wav'), 'music');
  await writeFile(path.join(root, 'Music', 'Cover.mp4'), 'video-not-a-song');

  const catalog = await discoverIngestionCandidates({ rootDirectory: root });
  assert.deepEqual(catalog.cinema, []);
  assert.deepEqual(catalog.music.map((item) => item.filename), ['Song.wav']);
});

test('ingestion discovery reports provider and sidecar path for invalid JSON', async () => {
  const root = await tree();
  const sidecar = path.join(root, 'Media', 'playlist-order.json');
  await writeFile(sidecar, '{broken');
  await assert.rejects(
    () => discoverIngestionCandidates({ rootDirectory: root }),
    (error) => error.message.includes('Media') && error.message.includes(sidecar) && error.message.includes('valid JSON'),
  );
});

test('ingestion discovery carries strict sidecar validation errors', async () => {
  const root = await tree();
  await writeFile(path.join(root, 'Cinema', 'Atlas.mp4'), 'cinema');
  await writeFile(path.join(root, 'Cinema', 'playlist-order.json'), '["Missing.mp4"]');
  await assert.rejects(
    () => discoverIngestionCandidates({ rootDirectory: root }),
    (error) => error.message.includes(path.join(root, 'Cinema', 'playlist-order.json')) && /Cinema.*missing.*Missing\.mp4/i.test(error.message),
  );
});

test('every semantic sidecar error includes its provider sidecar path', async () => {
  const cases = [
    ['["Atlas.mp4","Atlas.mp4"]', /duplicate/i],
    ['["../Atlas.mp4"]', /path/i],
    ['["Notes.txt"]', /unsupported/i],
    ['{"first":"Atlas.mp4"}', /array/i],
  ];
  for (const [sidecarSource, message] of cases) {
    const root = await tree();
    const sidecar = path.join(root, 'Cinema', 'playlist-order.json');
    await writeFile(path.join(root, 'Cinema', 'Atlas.mp4'), 'cinema');
    await writeFile(sidecar, sidecarSource);
    await assert.rejects(
      () => discoverIngestionCandidates({ rootDirectory: root }),
      (error) => error.message.includes(sidecar) && message.test(error.message),
    );
  }
});

test('relative ingestion roots still return absolute candidate paths', async () => {
  const root = await tree();
  await writeFile(path.join(root, 'Cinema', 'Atlas.mp4'), 'cinema');
  const relativeRoot = path.relative(process.cwd(), root);
  const catalog = await discoverIngestionCandidates({ rootDirectory: relativeRoot });
  assert.equal(path.isAbsolute(catalog.cinema[0].absolutePath), true);
  assert.equal(catalog.cinema[0].absolutePath, path.join(root, 'Cinema', 'Atlas.mp4'));
});

test('malformed sidecar entries preserve provider path index and offending value', async () => {
  const root = await tree();
  const sidecar = path.join(root, 'Cinema', 'playlist-order.json');
  await writeFile(path.join(root, 'Cinema', 'Atlas.mp4'), 'cinema');
  await writeFile(sidecar, '[42]');
  await assert.rejects(
    () => discoverIngestionCandidates({ rootDirectory: root }),
    (error) => error.message.includes('Cinema')
      && error.message.includes(sidecar)
      && error.message.includes('index 0')
      && error.message.includes('42'),
  );
});

test('ingestion discovers Music-Visuals separately from the Media playlist', async () => {
  const root = await tree();
  await mkdir(path.join(root, 'Media', 'Music-Visuals'));
  await writeFile(path.join(root, 'Media', 'Music-Visuals', 'VIZ-VOID.mp4'), 'visual');
  const catalog = await discoverIngestionCandidates({ rootDirectory: root });
  assert.deepEqual(catalog.media, []);
  assert.deepEqual(catalog.musicVisuals.map((item) => item.visualTag), ['VIZ-VOID']);
});

test('Music-Visuals rejects duplicate canonical tags and invalid names', async () => {
  const root = await tree();
  const visuals = path.join(root, 'Media', 'Music-Visuals');
  await mkdir(visuals);
  await writeFile(path.join(visuals, 'VIZ-VOID.mp4'), 'visual-a');
  await writeFile(path.join(visuals, 'viz-void.MOV'), 'visual-b');
  await assert.rejects(
    () => discoverIngestionCandidates({ rootDirectory: root }),
    /duplicate.*VIZ-VOID/i,
  );

  const secondRoot = await tree();
  const invalidVisuals = path.join(secondRoot, 'Media', 'Music-Visuals');
  await mkdir(invalidVisuals);
  await writeFile(path.join(invalidVisuals, 'default.mp4'), 'visual');
  await assert.rejects(
    () => discoverIngestionCandidates({ rootDirectory: secondRoot }),
    /Music-Visuals.*VIZ-/i,
  );
});
