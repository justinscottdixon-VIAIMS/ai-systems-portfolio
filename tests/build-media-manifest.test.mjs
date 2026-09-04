import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { loadBuildMediaData, resolveBuildMediaPath } from '../src/lib/build-media-manifest.mjs';

test('build media loader defaults to production and accepts an explicit in-project preview manifest', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'viaims-build-media-'));
  await mkdir(path.join(root, 'src/data'), { recursive: true });
  await writeFile(path.join(root, 'src/data/media.json'), '{"release":"production"}');
  await writeFile(path.join(root, 'src/data/media.preview.json'), '{"release":"preview"}');

  assert.equal((await loadBuildMediaData({ rootDirectory: root })).release, 'production');
  assert.equal((await loadBuildMediaData({ rootDirectory: root, manifestPath: 'src/data/media.preview.json' })).release, 'preview');
});

test('build media loader refuses paths outside the project', () => {
  assert.throws(
    () => resolveBuildMediaPath({ rootDirectory: '/project', manifestPath: '../secret.json' }),
    /inside the project/i,
  );
});
