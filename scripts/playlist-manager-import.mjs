import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { MEDIA_EXTENSIONS } from './publisher-audit.mjs';
import { formatMusicDisplayTitle } from '../src/lib/music-title.mjs';

const title = name => name.replace(/^\d+(?:\.\d+)*[ ._-]+/, '').trim();
const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
function compare(a, b) {
  const numbers = name => name.match(/^\d+(?:\.\d+)*/)?.[0].split('.').map(Number) ?? [100000];
  const x = numbers(a.name), y = numbers(b.name);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if (x[i] === undefined) return -1;
    if (y[i] === undefined) return 1;
    if (x[i] !== y[i]) return x[i] - y[i];
  }
  return collator.compare(a.name, b.name);
}
async function metadata(filename) {
  try {
    const stat = await fs.lstat(filename);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 8192) throw new Error('Folder metadata needs review.');
    return JSON.parse(await fs.readFile(filename, 'utf8'));
  } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
async function directories(directory) {
  return (await fs.readdir(directory, { withFileTypes: true })).filter(e => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'Published Playlist').sort(compare);
}
/** Read legacy folder intent without changing markers, numbering, files or the registry. */
export async function readManagerFolderImport(root, registry) {
  const groups = [], tracks = [], pending = [], warnings = [], records = [];
  for (const [provider, folder] of [['Music', 'music'], ['Cinema', 'cinema']]) {
    const providerRoot = path.join(root, provider);
    const rootStat = await fs.lstat(providerRoot);
    if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) throw new Error('Keep publishing folders on this Mac, without symbolic links.');
    for (const playlist of await directories(providerRoot)) {
      const directory = path.join(providerRoot, playlist.name), marker = await metadata(path.join(directory, '.playlist.json'));
      if (!marker) continue;
      if (!/^[a-z0-9-]{1,80}$/i.test(marker.id ?? '') || groups.some(g => g.id === marker.id)) throw new Error('A playlist has a copied identity. Keep its folder for review.');
      const group = { id: marker.id, title: title(playlist.name), provider: folder, kind: marker.kind ?? (folder === 'cinema' ? 'video' : 'audio'), position: groups.length };
      if (!['audio', 'video'].includes(group.kind) || (folder === 'cinema' && group.kind !== 'video')) throw new Error('Playlist type needs review.');
      groups.push(group);
      for (const entry of await directories(directory)) {
        const location = path.join(directory, entry.name), identity = await metadata(path.join(location, '.track.json'));
        const files = (await fs.readdir(location, { withFileTypes: true })).filter(e => e.isFile() && MEDIA_EXTENSIONS.has(path.extname(e.name).toLowerCase()));
        const item = registry.items.find(i => i.id === identity?.itemId && i.folder === folder && i.kind === group.kind);
        records.push({ group, provider, location, identity, files, item, name: title(entry.name) });
      }
    }
  }
  // Resolve copied identities before reading order: a new folder may sort before
  // the original. Use its saved baseline name; ambiguous copies leave live data alone.
  const canonical = new Map();
  for (const row of records.filter(r => r.item)) {
    if (canonical.has(row.item.id)) continue;
    const siblings = records.filter(r => r.item?.id === row.item.id);
    const matches = siblings.filter(r => r.name === r.identity?.folderTitle || r.name === r.item.title);
    canonical.set(row.item.id, siblings.length === 1 ? row : matches.length === 1 ? matches[0] : null);
    if (siblings.length > 1 && matches.length !== 1) warnings.push(`${row.item.title}: copied folder identities are ambiguous. The existing recording remains unchanged; new files will be inspected separately.`);
  }
  for (const row of records) {
    const { group, provider, location, files, item, name } = row;
    if (item && canonical.get(item.id) === row) {
      const changed = name !== row.identity?.folderTitle;
      const displayTitle = changed ? (group.provider === 'music' ? formatMusicDisplayTitle('', { overrideTitle: name }) : name) : item.title;
      const track = { itemId: item.id, playlistId: group.id, title: displayTitle };
      tracks.push(track); row.track = track;
    } else if (files.length === 1) {
      const job = { id: randomUUID(), playlistId: group.id, title: name, filename: files[0].name, source: path.join(location, files[0].name), provider, kind: group.kind };
      pending.push(job); row.pending = job;
      if (item) warnings.push(`${name} was copied from another track folder; inspected as a new recording, not a replacement.`);
    } else if (files.length > 1) warnings.push(`${name} contains more than one media file. Choose one in the manager.`);
  }
  for (const [index, row] of records.entries()) if (row.pending) row.pending.beforeId = records.slice(index + 1).find(next => next.group.id === row.group.id && next.track)?.track.itemId;
  return { groups, tracks, pending, warnings };
}
