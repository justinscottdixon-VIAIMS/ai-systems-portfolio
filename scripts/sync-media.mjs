import {
  BlobNotFoundError,
  BlobPreconditionFailedError,
  head,
  put,
} from '@vercel/blob';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  assertUniqueManifestIds,
  assertUniqueObjectKeys,
  discoverMedia,
  toManifestItem,
} from './media-catalog.mjs';

const MULTIPART_THRESHOLD = 100 * 1024 * 1024;

export function uploadOptions(file, token) {
  return {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: false,
    multipart: file.size > MULTIPART_THRESHOLD,
    contentType: file.contentType,
    token,
  };
}

async function resolveExistingBlob(pathname, token) {
  try {
    return await head(pathname, { token });
  } catch (error) {
    if (error instanceof BlobNotFoundError) return null;
    throw error;
  }
}

async function publishedUrlsByObjectKey(manifestPath) {
  const urls = new Map();
  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT' || error instanceof SyntaxError) return urls;
    throw error;
  }

  for (const item of manifest.items ?? []) {
    if (typeof item?.src !== 'string') continue;
    try {
      urls.set(new URL(item.src).pathname.replace(/^\/+/, ''), item.src);
    } catch {
      // A malformed prior entry cannot represent a reusable public release.
    }
  }
  return urls;
}

export async function syncMedia({
  rootDirectory = process.cwd(),
  files: suppliedFiles,
  manifestPath: suppliedManifestPath,
  token = process.env.BLOB_READ_WRITE_TOKEN,
  uploader = put,
  resolver = resolveExistingBlob,
  generatedAt = new Date().toISOString(),
  manifestBuilder,
} = {}) {
  if (!token) throw new Error('BLOB_READ_WRITE_TOKEN is required');
  const files = suppliedFiles ?? await discoverMedia(rootDirectory);
  assertUniqueObjectKeys(files);
  assertUniqueManifestIds(files);
  const manifestPath = suppliedManifestPath ?? path.join(rootDirectory, 'src/data/media.json');
  const publishedUrls = await publishedUrlsByObjectKey(manifestPath);

  const published = [];
  for (const file of files) {
    const publishedUrl = publishedUrls.get(file.objectKey);
    if (publishedUrl) {
      published.push({ file, url: publishedUrl });
      continue;
    }
    const existingBlob = await resolver(file.objectKey, token);
    if (existingBlob) {
      published.push({ file, url: existingBlob.url });
      continue;
    }
    const stream = createReadStream(file.absolutePath);
    let blob;
    try {
      blob = await uploader(file.objectKey, stream, uploadOptions(file, token));
    } catch (error) {
      if (!(error instanceof BlobPreconditionFailedError)) throw error;
      blob = await resolver(file.objectKey, token);
      if (!blob) throw error;
    } finally {
      stream.destroy();
    }
    published.push({ file, url: blob.url });
  }

  const manifest = manifestBuilder
    ? await manifestBuilder(published, { generatedAt })
    : { version: 1, generatedAt, items: published.map(({ file, url }) => toManifestItem(file, url)) };
  if (!manifest || typeof manifest !== 'object' || !Array.isArray(manifest.items)) {
    throw new TypeError('manifest builder must return a manifest with an items array');
  }
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
