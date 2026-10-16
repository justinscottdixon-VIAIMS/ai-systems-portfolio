const FIELDS = ['playlistId', 'playlistTitle', 'playlistPosition'];
export function musicPlaylistFields(item) {
  if (!FIELDS.some(key => key in item)) return {};
  if (item.folder !== undefined && !['music','cinema'].includes(item.folder)) throw new TypeError('Only Music and Cinema items have playlists');
  if (!/^[a-z0-9-]{1,80}$/i.test(item.playlistId ?? '') || typeof item.playlistTitle !== 'string'
      || !item.playlistTitle.trim() || item.playlistTitle !== item.playlistTitle.trim()
      || item.playlistTitle.length > 100 || /[\x00-\x1f\x7f]/.test(item.playlistTitle)
      || !Number.isSafeInteger(item.playlistPosition) || item.playlistPosition < 0) throw new TypeError('Invalid Music playlist');
  return Object.fromEntries(FIELDS.map(key => [key, item[key]]));
}
export function groupMusicPlaylists(items, { unfiledTitle = 'Other Music' } = {}) {
  const groups = new Map();
  for (const item of items) {
    const fields = musicPlaylistFields(item);
    const id = fields.playlistId ?? 'unfiled';
    const title = fields.playlistTitle ?? unfiledTitle;
    const position = fields.playlistPosition ?? Number.MAX_SAFE_INTEGER;
    if (!groups.has(id)) groups.set(id, { id, title, position, items: [] });
    const group = groups.get(id);
    if (group.title !== title || group.position !== position) throw new TypeError('Inconsistent Music playlist');
    group.items.push(item);
  }
  return [...groups.values()].sort((a,b) => a.position - b.position || a.id.localeCompare(b.id));
}
