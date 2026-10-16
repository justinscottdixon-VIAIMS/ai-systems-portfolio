import { musicFoldersEnabled, discoverMusicFolderLayout } from './music-folder-layout.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { approvedCatalogue, readApprovedRegistry } from '../src/lib/approved-catalogue.mjs';

export const LIBRARY_DIRECTORY = 'Published Playlist';
const PROVIDERS = ['Cinema', 'Music', 'Media'];
const escapeXml = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const digest = text => createHash('sha256').update(text).digest('hex');
const safeTitle = title => title.replace(/[\x00-\x1f\x7f/\\:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 140) || 'Untitled';
async function atomicText(filename, text) {
  try { if (await fs.readFile(filename, 'utf8') === text) return; } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const temporary = `${filename}.${process.pid}.tmp`;
  await fs.writeFile(temporary, text, { mode: 0o600 });
  await fs.rename(temporary, filename);
}
async function realDirectory(directory) {
  await fs.mkdir(directory, { recursive: true });
  const stat = await fs.lstat(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Library folders must be real directories');
}

export async function writeLocalPlaylistLibrary({ root, catalogue, checkedAt = new Date().toISOString() }) {
  const accepted = approvedCatalogue(catalogue.items);
  root = path.resolve(root);
  await realDirectory(root);
  const stateDirectory = path.join(root, '.viaims-publisher');
  await realDirectory(stateDirectory);
  const conflicts = [];
  const overview = ['VIAIMS — COMPLETE LIVE PLAYLISTS', `Last verified: ${checkedAt}`, '',
    'This is the complete published registry, including older releases whose',
    'original files are outside the drop folders. Positions restart for each',
    'player. Music and Cinema use playlist/series folders when enabled; otherwise',
    'use Published Playlist shortcuts. Internet access is required for links.', '',
    'This view refreshes about once a minute while the publisher is running.',
    'It is a reference view: renaming shortcuts does not reorder the website.',
    'With folder mode, export into a track/video subfolder inside its playlist.',
    'Legacy flat drops and Media still use their parent provider folders.', ''];
  for (const provider of PROVIDERS) {
    await realDirectory(path.join(root, provider));
    if (['Music','Cinema'].includes(provider) && await musicFoldersEnabled(root, provider)) {
      const items = accepted.items.filter(item => item.folder === provider.toLowerCase());
      overview.push(provider.toUpperCase() + ' — ' + items.length + ' live items', ...items.map((item,index) => `${String(index+1).padStart(2,'0')}. ${item.playlistTitle ? `[${item.playlistTitle}] ` : ''}${item.title}`), '');
      const layout = await discoverMusicFolderLayout(root, provider);
      for (const track of layout.tracks) {
        const item = accepted.items.find(item => item.id === track.identity?.itemId);
        if (!item) continue;
        const filename = path.join(track.directory, 'Listen online.webloc');
        try { await fs.writeFile(filename, `<?xml version="1.0" encoding="UTF-8"?><plist version="1.0"><dict><key>URL</key><string>${escapeXml(item.src)}</string></dict></plist>`, {flag:'wx',mode:0o600}); } catch(error) { if(error.code!=='EEXIST')throw error; }
      }
      continue;
    }
    const directory = path.join(root, provider, LIBRARY_DIRECTORY);
    await realDirectory(directory);
    const ownerFile = path.join(directory, '.viaims-library.json');
    let previous = { version: 1, generated: {} };
    try { previous = JSON.parse(await fs.readFile(ownerFile, 'utf8')); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      if ((await fs.readdir(directory)).filter(name => name !== '.DS_Store').length) throw new Error('Existing library folder needs review');
    }
    if (previous.version !== 1 || !previous.generated || typeof previous.generated !== 'object' || Array.isArray(previous.generated)) throw new Error('Invalid local library ownership record');
    const items = accepted.items.filter(item => item.folder === provider.toLowerCase());
    const lines = [`${provider.toUpperCase()} — LIVE PLAYLIST`, `Last verified: ${checkedAt}`, '', ...items.map((item, index) => `${String(index + 1).padStart(2, '0')}. ${item.title}`)];
    if (!items.length) lines.push('No published items yet.');
    lines.push('', 'Numbers are playlist positions, not version or episode numbers.', 'Generated reference only. Use the parent folder for new exports.');
    overview.push(`${provider.toUpperCase()} — ${items.length} live items`, ...lines.slice(3, 3 + (items.length || 1)), '');
    const generated = {};
    for (const [index, item] of items.entries()) {
      const name = `${String(index + 1).padStart(2, '0')} — ${safeTitle(item.title)}.webloc`;
      const text = `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict><key>URL</key><string>${escapeXml(item.src)}</string></dict></plist>\n`;
      const filename = path.join(directory, name);
      let canWrite = true;
      try {
        const stat = await fs.lstat(filename);
        const existing = stat.isFile() && !stat.isSymbolicLink() ? await fs.readFile(filename, 'utf8') : null;
        canWrite = existing !== null && (existing === text || (Object.hasOwn(previous.generated, name) && digest(existing) === previous.generated[name]));
      } catch (error) { if (error.code !== 'ENOENT') throw error; }
      if (canWrite) { await atomicText(filename, text); generated[name] = digest(text); }
      else conflicts.push(`${provider}/${LIBRARY_DIRECTORY}/${name}`);
    }
    for (const [name, checksum] of Object.entries(previous.generated)) {
      if (Object.hasOwn(generated, name) || path.basename(name) !== name || !/^\d+ — .+\.webloc$/.test(name) || !/^[a-f0-9]{64}$/.test(checksum)) continue;
      const filename = path.join(directory, name);
      try { if (!(await fs.lstat(filename)).isSymbolicLink() && digest(await fs.readFile(filename, 'utf8')) === checksum) await fs.unlink(filename); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    const folderConflicts = conflicts.filter(name => name.startsWith(`${provider}/`));
    if (folderConflicts.length) lines.push('', 'REFERENCE FILES NEED REVIEW — these edited/conflicting files were preserved:', ...folderConflicts);
    await atomicText(path.join(directory, 'PLAYLIST.txt'), lines.join('\n') + '\n');
    await atomicText(path.join(directory, 'README.txt'), 'COMPLETE PUBLISHED PLAYLIST\n\nSort by Name in Finder to see the numbered playlist. Double-click a .webloc\nshortcut to open that release online. These are links, not full media copies.\nPLAYLIST.txt lists the same titles in website order, with a verification time.\n\nThis folder is generated automatically. Renaming or deleting a shortcut does\nnot change the website. Missing generated shortcuts are restored. Edited or\nconflicting shortcuts are preserved and flagged; extra files are not deleted. Export new media into\nthe parent folder, not here. Nothing inside this folder enters the upload queue.\n\nIf the Mac is offline or the registry is unavailable, the last successful\nplaylist remains here. Check the timestamp in PLAYLIST.txt and the parent\nLIVE PLAYLISTS STATUS.txt for freshness.\n');
    await atomicText(ownerFile, JSON.stringify({ version: 1, generated }, null, 2));
  }
  await atomicText(path.join(root, 'LIVE PLAYLISTS.txt'), overview.join('\n') + '\n');
  await atomicText(path.join(root, 'LIVE REGISTRY.json'), JSON.stringify({ checkedAt, ...accepted }, null, 2));
  await atomicText(path.join(root, 'LIVE PLAYLISTS STATUS.txt'), `${conflicts.length ? 'REFERENCE FILES NEED REVIEW' : 'CURRENT'} — last verified ${checkedAt}\n${accepted.items.length} published items. Refreshes about once a minute while the service runs.\n${conflicts.length ? `Preserved edited/conflicting references:\n${conflicts.join('\n')}\n` : ''}`);
  return { count: accepted.items.length, fingerprint: accepted.fingerprint, conflicts };
}

export async function refreshLocalPlaylistLibrary({ root, store, signal, checkedAt }) {
  try {
    signal?.throwIfAborted();
    const snapshot = await store.read({ signal });
    if (!snapshot) throw new Error('Approved registry unavailable');
    const catalogue = readApprovedRegistry(snapshot.registry);
    signal?.throwIfAborted();
    return await writeLocalPlaylistLibrary({ root, catalogue, checkedAt });
  } catch (error) {
    if (signal?.aborted) return null;
    await atomicText(path.join(root, 'LIVE PLAYLISTS STATUS.txt'), `REFRESH UNAVAILABLE — checked ${checkedAt ?? new Date().toISOString()}\nThe last successful local playlist has been retained. Check its timestamp.\nThe service will retry automatically. This does not remove public releases.\n`);
    return null;
  }
}
