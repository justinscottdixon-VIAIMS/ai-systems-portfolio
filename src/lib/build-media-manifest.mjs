import { readFile } from 'node:fs/promises';
import path from 'node:path';

export function resolveBuildMediaPath({
  rootDirectory = process.cwd(),
  manifestPath = 'src/data/media.json',
} = {}) {
  const root = path.resolve(rootDirectory);
  const resolved = path.resolve(root, manifestPath);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error('Media manifest path must remain inside the project.');
  }
  return resolved;
}

export async function loadBuildMediaData(options = {}) {
  const manifestPath = resolveBuildMediaPath(options);
  return JSON.parse(await readFile(manifestPath, 'utf8'));
}
