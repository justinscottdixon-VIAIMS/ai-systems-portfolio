import path from 'node:path';
import { discoverIngestionCandidates } from './ingestion-catalog.mjs';
import { describeMediaFile } from './media-catalog.mjs';
import { readMusicMetadata } from './music-metadata.mjs';
import { probeVideoMetadata } from './video-metadata.mjs';
import { parseMusicIdentity } from '../src/lib/music-title.mjs';

export async function discoverPreviewMedia({
  ingestionRoot = path.join(process.cwd(), 'media-ingest'),
  objectKeyPrefix = 'portfolio-preview',
  videoMetadataReader = probeVideoMetadata,
} = {}) {
  const catalog = await discoverIngestionCandidates({ rootDirectory: ingestionRoot });
  if (catalog.media.length > 0) {
    throw new Error('The Media provider is not yet representable in the current media manifest; refusing to misclassify its payload.');
  }

  const musicDirectory = path.join(path.resolve(ingestionRoot), 'Music');
  const musicMetadata = await readMusicMetadata({
    musicDirectory,
    filenames: catalog.music.map(({ filename }) => filename),
  });
  const visualsByTag = new Map(catalog.musicVisuals.map((item) => [item.visualTag, item]));

  const cinema = await Promise.all(catalog.cinema.map(async (candidate) => describeMediaFile({
    kind: 'video',
    filename: candidate.filename,
    absolutePath: candidate.absolutePath,
    objectKeyPrefix,
    metadata: {
      role: 'cinema',
      playlistOrder: candidate.playlistOrder,
      ...await videoMetadataReader(candidate.absolutePath),
    },
  })));
  const music = await Promise.all(catalog.music.map(async (candidate) => {
    const identity = parseMusicIdentity(candidate.filename, {
      overrideTitle: musicMetadata.get(candidate.filename)?.title,
    });
    if (identity.visualTag && !visualsByTag.has(identity.visualTag)) {
      throw new TypeError(`${identity.visualTag} requires a matching visual in Media/Music-Visuals`);
    }
    return describeMediaFile({
      kind: 'audio',
      filename: candidate.filename,
      absolutePath: candidate.absolutePath,
      objectKeyPrefix,
      metadata: {
        role: 'music',
        playlistOrder: candidate.playlistOrder,
        title: identity.title,
        visualTag: identity.visualTag,
      },
    });
  }));
  const visuals = await Promise.all(catalog.musicVisuals.map(async (candidate) => describeMediaFile({
    kind: 'video',
    filename: candidate.filename,
    absolutePath: candidate.absolutePath,
    objectKeyPrefix,
    metadata: {
      role: 'music-visual',
      visualTag: candidate.visualTag,
      ...await videoMetadataReader(candidate.absolutePath),
    },
  })));
  return [...cinema, ...music, ...visuals];
}
