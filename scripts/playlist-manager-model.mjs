import { randomUUID } from 'node:crypto';
import { readApprovedRegistry, registryDocument } from '../src/lib/approved-catalogue.mjs';
const inputError = message => Object.assign(new Error(message), { code: 'MANAGER_INPUT' });

export const managerTitle = (value, max = 100) => {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max || /[\x00-\x1f\x7f]/.test(value)) throw inputError('Enter a readable title.');
  return value.trim();
};
export const sectionFor = group => group.provider === 'cinema' ? 'cinema' : group.kind === 'video' ? 'music-videos' : 'music';
export function initialManagerState(registry, groups = []) {
  const playlists = new Map(groups.map(group => [group.id, { ...group }]));
  for (const item of readApprovedRegistry(registry).items) {
    if (!['music', 'cinema'].includes(item.folder)) continue;
    const id = item.playlistId || `unassigned-${item.folder}-${item.kind}`;
    if (!playlists.has(id)) playlists.set(id, { id, title: item.playlistTitle || (item.folder === 'cinema' ? 'Cinema' : item.kind === 'video' ? 'Music Videos' : 'Music'), provider: item.folder, kind: item.kind, position: item.playlistPosition ?? playlists.size });
  }
  return { version: 1, playlists: [...playlists.values()], removed: [], jobs: [] };
}
export function itemPlaylist(item) { return item.playlistId || `unassigned-${item.folder}-${item.kind}`; }
export function orderedManagerItems(registry, state) {
  const groups = new Map(state.playlists.map(g => [g.id, g]));
  return readApprovedRegistry(registry).items.map(item => {
    const group = groups.get(itemPlaylist(item));
    return group ? { ...item, playlistId: group.id, playlistTitle: group.title, playlistPosition: group.position } : item;
  }).sort((a, b) => a.folder.localeCompare(b.folder) || (a.playlistPosition ?? 10000) - (b.playlistPosition ?? 10000) || a.playlistOrder - b.playlistOrder);
}
function finish(items, state) {
  const ids = new Set(), titles = new Set(), orders = new Map();
  // Restore snapshots may carry a playlist's former name/position. Normalize
  // that metadata as a group before the registry enforces consistency.
  const normalized = items.map(item => { const group = state.playlists.find(g => g.id === itemPlaylist(item)); return group ? { ...item, playlistId: group.id, playlistTitle: group.title, playlistPosition: group.position } : item; });
  const grouped = orderedManagerItems(registryDocument(normalized), state);
  for (const item of grouped) {
    const key = `${item.folder}:${item.title.normalize('NFKC').toLowerCase()}`;
    if (ids.has(item.id) || titles.has(key)) throw inputError('That recording or title is already in this player.');
    ids.add(item.id); titles.add(key);
    item.playlistOrder = orders.get(item.folder) ?? 0;
    orders.set(item.folder, item.playlistOrder + 1);
  }
  return { registry: registryDocument(grouped), state };
}
export function editManagerCatalogue(registry, original, operation) {
  const state = structuredClone(original), items = orderedManagerItems(registry, state);
  const group = id => { const value = state.playlists.find(g => g.id === id); if (!value) throw inputError('Playlist no longer exists.'); return value; };
  const track = id => { const value = items.find(i => i.id === id); if (!value) throw inputError('Recording no longer exists. Refresh and try again.'); return value; };
  switch (operation.type) {
    case 'create-playlist': {
      if (!['music', 'music-videos', 'cinema'].includes(operation.section)) throw inputError('Choose Music, Music Videos or Cinema.');
      state.playlists.push({ id: randomUUID(), title: managerTitle(operation.title), provider: operation.section === 'cinema' ? 'cinema' : 'music', kind: operation.section === 'music' ? 'audio' : 'video', position: state.playlists.length });
      break;
    }
    case 'rename-playlist': group(operation.playlistId).title = managerTitle(operation.title); break;
    case 'order-playlists': {
      const matching = state.playlists.filter(g => sectionFor(g) === operation.section);
      if (!Array.isArray(operation.ids) || operation.ids.length !== matching.length || new Set(operation.ids).size !== matching.length || operation.ids.some(id => !matching.some(g => g.id === id))) throw inputError('Refresh the playlist list before reordering.');
      const slots = matching.map(g => g.position).sort((a, b) => a - b);
      operation.ids.forEach((id, index) => { group(id).position = slots[index]; });
      break;
    }
    case 'rename-track': track(operation.itemId).title = managerTitle(operation.title, 250); break;
    case 'move-track': {
      const item = track(operation.itemId), destination = group(operation.playlistId);
      if (item.folder !== destination.provider || item.kind !== destination.kind) throw inputError('Choose a playlist for this type of recording.');
      item.playlistId = destination.id; item.playlistTitle = destination.title; item.playlistPosition = destination.position;
      item.playlistOrder = Number.MAX_SAFE_INTEGER;
      break;
    }
    case 'order-tracks': {
      group(operation.playlistId);
      const matching = items.filter(i => itemPlaylist(i) === operation.playlistId);
      if (!Array.isArray(operation.ids) || matching.length !== operation.ids.length || new Set(operation.ids).size !== matching.length || operation.ids.some(id => !matching.some(i => i.id === id))) throw inputError('This playlist changed. Refresh before reordering.');
      operation.ids.forEach((id, position) => { track(id).playlistOrder = position; });
      break;
    }
    case 'remove-track': {
      const item = track(operation.itemId);
      state.removed.push({ item: { ...item }, removedAt: new Date().toISOString() });
      items.splice(items.indexOf(item), 1); break;
    }
    case 'restore-track': {
      const index = state.removed.findIndex(row => row.item.id === operation.itemId);
      if (index < 0) throw inputError('No saved recording to restore.');
      items.push(state.removed.splice(index, 1)[0].item); break;
    }
    default: throw inputError('Unknown playlist edit.');
  }
  return finish(items, state);
}
export function placeManagerItem(registry, state, itemId, playlistId, beforeId) {
  let result = editManagerCatalogue(registry, state, { type: 'move-track', itemId, playlistId });
  const list = result.registry.items.filter(i => itemPlaylist(i) === playlistId).map(i => i.id).filter(id => id !== itemId);
  const index = beforeId ? list.indexOf(beforeId) : -1;
  list.splice(index < 0 ? list.length : index, 0, itemId);
  return editManagerCatalogue(result.registry, state, { type: 'order-tracks', playlistId, ids: list });
}
