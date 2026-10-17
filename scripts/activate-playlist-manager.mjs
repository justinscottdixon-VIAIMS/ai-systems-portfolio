import fs from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { build } from 'esbuild';
import { loadPublisherToken } from './local-media-publisher.mjs';
import { createApprovedCatalogueStore } from '../src/lib/approved-catalogue-store.mjs';

const { values } = parseArgs({ options: { root: { type: 'string' }, 'env-file': { type: 'string' } } });
if (!values.root || !values['env-file']) throw new Error('Pass the existing publishing root and private environment-file path.');
const root = await fs.realpath(values.root), state = path.join(root, '.viaims-publisher');
const stamp = new Date().toISOString().replaceAll(':','-');
const backup = path.join(state, 'manager-install-backups', stamp), stage = path.join(state, `manager-install-${stamp}`);
await fs.mkdir(backup, { recursive: true, mode: 0o700 }); await fs.mkdir(stage, { mode: 0o700 });
const token = await loadPublisherToken(values['env-file']);
const store = createApprovedCatalogueStore({token}); const prior = await store.read();
await fs.writeFile(path.join(backup, 'catalogue.json'), JSON.stringify(prior, null, 2), { mode: 0o600 });
for (const name of ['music-folder-layout.json','cinema-folder-layout.json','playlist-manager.json']) {
 try { await fs.copyFile(path.join(state,name),path.join(backup,name)); } catch(error) { if(error.code!=='ENOENT') throw error; }
}
try { await fs.copyFile(path.join(root,'READ ME.txt'),path.join(backup,'READ ME.txt')); } catch(error) { if(error.code!=='ENOENT') throw error; }
await fs.cp(path.join(state,'runtime'),path.join(backup,'runtime'),{recursive:true});
await build({ entryPoints: ['scripts/local-media-publisher.mjs'], outfile: path.join(stage, 'publisher.mjs'), bundle: true, platform: 'node', target: 'node24', format: 'esm', banner: { js: 'import { createRequire as createBundledRequire } from "node:module"; const require = createBundledRequire(import.meta.url);' } });
await fs.cp('tools/playlist-manager',path.join(stage,'playlist-manager'),{recursive:true});
// All artifacts and recovery copies exist before changing the installed runtime.
await fs.rename(path.join(stage,'publisher.mjs'),path.join(state,'runtime','publisher.mjs'));
await fs.cp(path.join(stage,'playlist-manager'),path.join(state,'runtime','playlist-manager'),{recursive:true});
for(const name of ['music-folder-layout.json','cinema-folder-layout.json']) await fs.writeFile(path.join(state,name),JSON.stringify({version:1,enabled:false},null,2),{mode:0o600});
await fs.writeFile(path.join(state,'playlist-manager.json'),JSON.stringify({version:1,enabled:true,port:4350},null,2),{mode:0o600});
const launcher=path.join(root,'Open Playlist Studio.command');
await fs.writeFile(launcher,'#!/bin/zsh\nopen "http://127.0.0.1:4350/"\n',{mode:0o700}); await fs.chmod(launcher,0o700);
await fs.writeFile(path.join(root,'Open Playlist Studio.webloc'),'<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>URL</key><string>http://127.0.0.1:4350/</string></dict></plist>');
await fs.writeFile(path.join(root,'READ ME.txt'),`VIAIMS PLAYLIST STUDIO\n\nOpen “Open Playlist Studio.command” or http://127.0.0.1:4350/ on this Mac.\n\nMusic: manage genre playlists and recordings. Music videos: separate video playlists in the Music player. Cinema: manage series without mixing their episodes. Empty playlists stay visible here and appear on the website when they have media.\n\nClick a title or Rename to edit. Drag rows or use arrows to reorder. Use the playlist menu to move a recording. Preview plays the current recording. Drop finished media into the selected playlist or use Choose files. The manager copies it safely, checks its format, decodes the full recording and publishes passing additions automatically. Duplicates and questionable files stay visible for review. Maximum 2 GiB and four hours per file.\n\nReplace file audits first and requires Confirm replacement before the published recording changes. Remove unpublishes a title without deleting media; Removed recordings lets you restore it. Each edit keeps private recovery snapshots.\n\nChanges sync automatically; no Git commit or site rebuild is required. The Mac must be awake, logged in and online. The existing login publisher starts the manager automatically. Start Publishing.command and Stop Publishing.command control it.\n\nYour existing Music/Cinema folders and originals are retained. Folder numbers no longer control the website: use Playlist Studio for titles, groups and order. Old README instructions about renaming numbered folders have been superseded by this file. LIVE PLAYLISTS.txt remains a readable reference, not an editing interface.\n\nNo cloud credentials are exposed in the interface. This manager accepts connections only from this Mac. Recovery copies of the previous runtime/configuration are in .viaims-publisher/manager-install-backups/${stamp}.\n`);
console.log(JSON.stringify({installed:true,url:'http://127.0.0.1:4350/',backup,restartRequired:true}));
