import { readFile } from 'node:fs/promises';
import path from 'node:path';

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export async function readMusicMetadata({ musicDirectory, filenames }) {
  const directory = path.resolve(musicDirectory);
  const sidecarPath = path.join(directory, 'track-metadata.json');
  let source;
  try {
    source = await readFile(sidecarPath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return new Map();
    throw error;
  }

  let parsed;
  try {
    parsed = JSON.parse(source);
  } catch {
    throw new TypeError(`Music metadata must contain valid JSON: ${sidecarPath}`);
  }
  if (!isPlainObject(parsed)) throw new TypeError(`Music metadata must be an object: ${sidecarPath}`);

  const available = new Set(filenames);
  for (const [filename, entry] of Object.entries(parsed)) {
    if (!available.has(filename)) throw new TypeError(`Music metadata references unknown file ${filename}: ${sidecarPath}`);
    if (!isPlainObject(entry)) throw new TypeError(`Music metadata for ${filename} must be an object: ${sidecarPath}`);
    for (const field of Object.keys(entry)) {
      if (field !== 'title') throw new TypeError(`Music metadata for ${filename} contains unsupported field ${field}: ${sidecarPath}`);
    }
    if (typeof entry.title !== 'string' || entry.title.trim() === '') {
      throw new TypeError(`Music metadata title for ${filename} must be a non-empty string: ${sidecarPath}`);
    }
  }
  return new Map(Object.entries(parsed));
}
