import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { classifyMediaAspect } from '../src/lib/media-presentation.mjs';

const execFileAsync = promisify(execFile);

export function parseVideoProbe(output, filename) {
  let parsed;
  try {
    parsed = JSON.parse(output);
  } catch {
    throw new TypeError(`${filename} ffprobe output must be valid JSON`);
  }
  const { width, height } = parsed.streams?.[0] ?? {};
  if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
    throw new TypeError(`${filename} must report positive integer video dimensions`);
  }
  return { width, height, aspect: classifyMediaAspect(width, height) };
}

export async function probeVideoMetadata(absolutePath, { runner = execFileAsync } = {}) {
  const { stdout } = await runner('ffprobe', [
    '-v', 'error',
    '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height',
    '-of', 'json',
    absolutePath,
  ]);
  return parseVideoProbe(stdout, absolutePath);
}
