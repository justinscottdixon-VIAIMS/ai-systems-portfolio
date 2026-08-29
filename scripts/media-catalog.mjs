import { createReadStream } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const GROUPS = [
  {
    kind: 'audio',
    relativeDirectory: 'public/media/audio',
    extensions: new Set(['.wav', '.mp3', '.m4a', '.flac', '.aac']),
    contentTypes: { '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.flac': 'audio/flac', '.aac': 'audio/aac' },
  },
  {
    kind: 'video',
    relativeDirectory: 'public/media/video',
    extensions: new Set(['.mp4', '.mov', '.webm']),
    contentTypes: { '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm' },
  },
];

export function safeObjectName(filename) {
  const extension = path.extname(filename).toLowerCase();
  const stem = path.basename(filename, path.extname(filename))
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!stem) throw new Error(`filename cannot produce a Blob key: ${filename}`);
  return `${stem}${extension}`;
}

function hashFile(absolutePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(absolutePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

export async function discoverMedia(rootDirectory) {
  const discovered = [];
  for (const group of GROUPS) {
    const absoluteDirectory = path.join(rootDirectory, group.relativeDirectory);
    const entries = await readdir(absoluteDirectory, { withFileTypes: true });
    for (const entry of entries) {
      const extension = path.extname(entry.name).toLowerCase();
      if (!entry.isFile() || entry.name.startsWith('.') || !group.extensions.has(extension)) continue;
      const absolutePath = path.join(absoluteDirectory, entry.name);
      const fileStat = await stat(absolutePath);
      const contentHash = await hashFile(absolutePath);
      discovered.push({
        kind: group.kind,
        filename: entry.name,
        absolutePath,
        size: fileStat.size,
        contentType: group.contentTypes[extension],
        objectKey: `portfolio/${group.kind}/${contentHash}-${safeObjectName(entry.name)}`,
      });
    }
  }
  return discovered.sort((left, right) => left.objectKey.localeCompare(right.objectKey));
}

export function assertUniqueObjectKeys(files) {
  const seen = new Set();
  for (const file of files) {
    if (seen.has(file.objectKey)) throw new Error(`duplicate Blob key: ${file.objectKey}`);
    seen.add(file.objectKey);
  }
}

export function manifestItemId(file) {
  const safeName = safeObjectName(file.filename);
  const idStem = path.basename(safeName, path.extname(safeName));
  return `${file.kind}-${idStem}`;
}

export function assertUniqueManifestIds(files) {
  const seen = new Set();
  for (const file of files) {
    const id = manifestItemId(file);
    if (seen.has(id)) throw new Error(`duplicate media id: ${id}`);
    seen.add(id);
  }
}

export function toManifestItem(file, url) {
  const extension = path.extname(file.filename);
  const displayStem = path.basename(file.filename, extension).replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  const item = {
    id: manifestItemId(file),
    kind: file.kind,
    title: displayStem,
    src: url,
    specs: file.kind === 'video'
      ? `${extension.slice(1).toUpperCase()} Master`
      : `${extension.slice(1).toUpperCase()} • 24-bit / 48kHz Staging`,
  };
  if (file.kind === 'video') item.engine = file.filename.includes('3I') ? 'Sora Pro' : 'AI Render';
  return item;
}
