import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { discoverPreviewMedia } from './preview-media-catalog.mjs';
import { toManifestItem } from './media-catalog.mjs';
import { syncMedia } from './sync-media.mjs';

export function buildPreviewManifest(published, { generatedAt }) {
  const visuals = new Map(published
    .filter(({ file }) => file.role === 'music-visual')
    .map(({ file, url }) => [file.visualTag, {
      tag: file.visualTag,
      src: url,
      width: file.width,
      height: file.height,
      aspect: file.aspect,
    }]));
  const items = published
    .filter(({ file }) => file.role !== 'music-visual')
    .map(({ file, url }) => {
      const item = toManifestItem(file, url);
      if (file.role === 'music' && file.visualTag) item.visual = visuals.get(file.visualTag);
      return item;
    });
  return { version: 1, generatedAt, items };
}

export async function syncPreviewMedia({ rootDirectory = process.cwd(), videoMetadataReader, ...options } = {}) {
  const files = options.files ?? await discoverPreviewMedia({
    ingestionRoot: path.join(rootDirectory, 'media-ingest'),
    videoMetadataReader,
  });
  return syncMedia({
    ...options,
    rootDirectory,
    files,
    manifestBuilder: options.manifestBuilder ?? buildPreviewManifest,
    manifestPath: path.join(rootDirectory, 'src/data/media.preview.json'),
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const manifest = await syncPreviewMedia();
  console.log(`Published ${manifest.items.length} preview media files to src/data/media.preview.json`);
}
