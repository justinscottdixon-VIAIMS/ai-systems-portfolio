import path from 'node:path';

const naturalFilenameOrder = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

export function resolvePlaylistOrder({ provider, filenames, orderEntries = null, supportedExtensions }) {
  const available = new Set(filenames);
  const supported = (filename) => supportedExtensions.has(path.extname(filename).toLowerCase());
  const eligible = filenames.filter(supported);

  if (orderEntries !== null && !Array.isArray(orderEntries)) {
    throw new TypeError(`${provider} playlist order must be an array`);
  }

  const listed = [];
  const seen = new Set();
  for (const [index, entry] of (orderEntries ?? []).entries()) {
    if (typeof entry !== 'string' || entry.length === 0) {
      throw new TypeError(`${provider} playlist order entry at index ${index} requires a non-empty filename; received ${JSON.stringify(entry)}`);
    }
    if (path.isAbsolute(entry) || path.basename(entry) !== entry || entry.includes('/') || entry.includes('\\')) {
      throw new TypeError(`${provider} playlist order path is not allowed: ${entry}`);
    }
    if (!supported(entry)) throw new TypeError(`${provider} playlist order has unsupported media: ${entry}`);
    if (seen.has(entry)) throw new TypeError(`${provider} playlist order has duplicate entry: ${entry}`);
    if (!available.has(entry)) throw new TypeError(`${provider} playlist order references missing file: ${entry}`);
    seen.add(entry);
    listed.push(entry);
  }

  const unlisted = eligible
    .filter((filename) => !seen.has(filename))
    .sort((left, right) => naturalFilenameOrder.compare(left, right) || (left < right ? -1 : left > right ? 1 : 0));
  return [...listed, ...unlisted];
}
