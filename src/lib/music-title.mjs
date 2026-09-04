import path from 'node:path';

const VISUAL_TAG = /(?:^|__)VIZ-([a-z0-9]+(?:-[a-z0-9]+)*)(?=__|_|$)/gi;
const LEADING_ORDER = /^\s*\d+\s*[._-]+\s*/;
const TECHNICAL_TOKEN = /^(?:mstr|master|\d+k\d+b|\d+khz|v\d+(?:\.\d+)*|voo\d+(?:\.\d+)*|mk\d+(?:\.\d+)*|stem\d+(?:\.\d+)*|agtr)$/i;
const COPY_SUFFIX = /\s*\(\d+\)\s*$/;

function frameTitle(value) {
  const unframed = value.trim().replace(/^V_/i, '').replace(/_$/, '').trim();
  if (!unframed) throw new TypeError('Music display title cannot be empty');
  return `V_${unframed}_`;
}

export function extractMusicVisualTag(filename) {
  const stem = path.basename(filename, path.extname(filename));
  const matches = [...stem.matchAll(VISUAL_TAG)];
  if (matches.length > 1) throw new TypeError(`${filename} may declare only one visual tag`);
  return matches[0] ? `VIZ-${matches[0][1].toUpperCase()}` : null;
}

export function formatMusicDisplayTitle(filename, { overrideTitle } = {}) {
  if (overrideTitle !== undefined) return frameTitle(overrideTitle);
  const stem = path.basename(filename, path.extname(filename));
  const withoutTag = stem.replace(VISUAL_TAG, '').replace(LEADING_ORDER, '').replace(COPY_SUFFIX, '');
  const tokens = withoutTag
    .replace(/^V_/i, '')
    .split(/[_\s]+/)
    .filter(Boolean)
    .filter((token) => !TECHNICAL_TOKEN.test(token));
  const title = tokens.map((token) => (
    /^[\p{Ll}\p{Lo}]+$/u.test(token)
      ? `${token[0].toLocaleUpperCase()}${token.slice(1)}`
      : token
  )).join(' ');
  return frameTitle(title);
}

export function parseMusicIdentity(filename, options) {
  return {
    title: formatMusicDisplayTitle(filename, options),
    visualTag: extractMusicVisualTag(filename),
  };
}
