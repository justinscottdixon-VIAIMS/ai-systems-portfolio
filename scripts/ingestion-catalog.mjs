import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { resolvePlaylistOrder } from '../src/lib/playlist-order.mjs';

const PROVIDERS = [
  { folder: 'Cinema', key: 'cinema', extensions: new Set(['.mp4', '.mov', '.webm']) },
  { folder: 'Music', key: 'music', extensions: new Set(['.wav', '.mp3', '.m4a', '.flac', '.aac']) },
  { folder: 'Media', key: 'media', extensions: new Set(['.mp4', '.mov', '.webm']) },
];

const MUSIC_VISUAL_EXTENSIONS = new Set(['.mp4', '.mov', '.webm']);

async function readOrderFile(provider, sidecarPath) {
  let source;
  try {
    source = await readFile(sidecarPath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
  try {
    return JSON.parse(source);
  } catch {
    throw new TypeError(`${provider} order file must contain valid JSON: ${sidecarPath}`);
  }
}

export async function discoverIngestionCandidates({ rootDirectory = path.join(process.cwd(), 'media-ingest') } = {}) {
	const resolvedRoot = path.resolve(rootDirectory);
  const catalog = {};
  for (const provider of PROVIDERS) {
    const providerDirectory = path.join(resolvedRoot, provider.folder);
    const entries = await readdir(providerDirectory, { withFileTypes: true });
    const filenames = entries
      .filter((entry) => entry.isFile()
        && !entry.name.startsWith('.')
        && entry.name !== 'playlist-order.json'
        && entry.name !== 'track-metadata.json')
      .map((entry) => entry.name);
		const sidecarPath = path.join(providerDirectory, 'playlist-order.json');
    const orderEntries = await readOrderFile(provider.folder, sidecarPath);
		let ordered;
		try {
			ordered = resolvePlaylistOrder({
				provider: provider.folder,
				filenames,
				orderEntries,
				supportedExtensions: provider.extensions,
			});
		} catch (error) {
			throw new TypeError(`${provider.folder} order file validation failed (${sidecarPath}): ${error.message}`, { cause: error });
		}
    catalog[provider.key] = ordered.map((filename, playlistOrder) => ({
      provider: provider.key,
      filename,
      absolutePath: path.join(providerDirectory, filename),
      playlistOrder,
    }));
  }
  const musicVisualDirectory = path.join(resolvedRoot, 'Media', 'Music-Visuals');
  let visualEntries;
  try {
    visualEntries = await readdir(musicVisualDirectory, { withFileTypes: true });
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    visualEntries = [];
  }
  const seenVisualTags = new Set();
  catalog.musicVisuals = visualEntries
    .filter((entry) => entry.isFile() && !entry.name.startsWith('.'))
    .map((entry) => {
      const extension = path.extname(entry.name).toLowerCase();
      if (!MUSIC_VISUAL_EXTENSIONS.has(extension)) {
        throw new TypeError(`Music-Visuals contains unsupported file ${entry.name}: ${musicVisualDirectory}`);
      }
      const stem = path.basename(entry.name, path.extname(entry.name));
      if (!/^VIZ-[A-Z0-9]+(?:-[A-Z0-9]+)*$/i.test(stem)) {
        throw new TypeError(`Music-Visuals filename must use VIZ-<NAME>: ${entry.name}`);
      }
      const visualTag = stem.toUpperCase();
      if (seenVisualTags.has(visualTag)) throw new TypeError(`duplicate Music-Visuals tag ${visualTag}`);
      seenVisualTags.add(visualTag);
      return {
        visualTag,
        filename: entry.name,
        absolutePath: path.join(musicVisualDirectory, entry.name),
      };
    })
    .sort((left, right) => left.visualTag.localeCompare(right.visualTag));
  return catalog;
}
