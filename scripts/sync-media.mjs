import { put } from '@vercel/blob';
import { createReadStream } from 'node:fs';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  assertUniqueObjectKeys,
  discoverMedia,
  toManifestItem,
} from './media-catalog.mjs';

const MULTIPART_THRESHOLD = 100 * 1024 * 1024;

export async function syncMedia({
  rootDirectory = process.cwd(),
  token = process.env.BLOB_READ_WRITE_TOKEN,
  uploader = put,
  generatedAt = new Date().toISOString(),
} = {}) {
  if (!token) throw new Error('BLOB_READ_WRITE_TOKEN is required');
  const files = await discoverMedia(rootDirectory);
  assertUniqueObjectKeys(files);

  const items = [];
  for (const file of files) {
    const blob = await uploader(file.objectKey, createReadStream(file.absolutePath), {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      multipart: file.size > MULTIPART_THRESHOLD,
      contentType: file.contentType,
      token,
    });
    items.push(toManifestItem(file, blob.url));
  }

  const manifest = { version: 1, generatedAt, items };
  const manifestPath = path.join(rootDirectory, 'src/data/media.json');
  const temporaryPath = `${manifestPath}.tmp`;
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(temporaryPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  await rename(temporaryPath, manifestPath);
  return manifest;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const manifest = await syncMedia();
  console.log(`Uploaded ${manifest.items.length} media files and updated src/data/media.json`);
}
