import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { readApprovedRegistry } from '../src/lib/approved-catalogue.mjs';
import { fileHash, MEDIA_EXTENSIONS } from './publisher-audit.mjs';
import { MUSIC_FOLDER_CONFIG } from './music-folder-layout.mjs';

const safe = text => text.replace(/^V_/i,'').replace(/_$/,'').replace(/[\x00-\x1f\x7f/\\:*?"<>|]/g,' ').replace(/\s+/g,' ').trim().slice(0,90);
const xml = text => text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const guide=`MUSIC PLAYLIST FOLDERS\n\nRename 01 Playlist One, 02 Playlist Two and 03 Playlist Three for your genres.\nKeep the leading numbers to control playlist order. Inside each playlist,\nuse one folder per track, such as 01 Gold On Walls. Change the number to\nchange track order, or move the whole track folder to another playlist.\nUse each ordering number only once within its parent folder.\n\nKeep one finished MP3 (or supported audio/video file) directly inside a new\ntrack folder. The publisher audits and publishes it automatically. Keep\nalternate exports outside that track folder; multiple playable files are\nheld for review. Artwork and notes can stay here but are not published yet.\n\nExisting tracks have a Listen online.webloc link, so full audio copies are\nnot required. Hidden identity files keep each release connected when you\nmove or rename its folder; leave those files in place. Do not copy the same\ntrack folder into two playlists. Folder titles appear without the numbers\non the website. Empty genre folders appear online once they have a track.\n\nStable changes synchronize after about 15 seconds plus network propagation.\nDeleting a folder does not unpublish a release. Replacing published audio\nrequires review; it never silently overwrites a release. Check the parent\nMusic Playlist Status.txt and Publishing Status.html if something is held.\n`;
export async function initializeMusicFolders({root,registry,moveLocalFiles=false,provider='Music'}) {
  if(!['Music','Cinema'].includes(provider))throw new Error('Unsupported playlist provider');
  const catalogue=readApprovedRegistry(registry);const items=catalogue.items.filter(i=>i.folder===provider.toLowerCase());
  const music=path.join(root,provider),state=path.join(root,'.viaims-publisher');await fs.mkdir(state,{recursive:true});await fs.mkdir(music,{recursive:true});
  const config=path.join(state,provider === 'Music' ? MUSIC_FOLDER_CONFIG : 'cinema-folder-layout.json');try{await fs.access(config);throw new Error('Music folder layout is already initialized');}catch(error){if(error.code!=='ENOENT')throw error;}
  const plans=[];
  const names = provider === 'Music' ? ['01 Playlist One','02 Playlist Two','03 Playlist Three','04 Music Videos'] : ['01 3I ATLAS','02 Other Videos','03 New Series'];
  const instructions = provider === 'Music' ? guide + '\n04 Music Videos is for video releases played through the Music player.\nKeep one supported finished video per track folder in that playlist.\n' : 'CINEMA SERIES FOLDERS\n\n01 3I ATLAS contains the existing ATLAS series. 02 Other Videos contains\nNeuron Pong. Rename 03 New Series for your next video series, or add more\nnumbered series folders. Each series contains one numbered folder per video.\n\nPlace one finished supported MP4/MOV/WebM directly into a video folder.\nMove the entire video folder to change its series. Change leading folder\nnumbers to change order; keep numbers unique within each parent folder.\nHidden identity files preserve published links through moves and renames.\nExisting releases can use Listen online.webloc without a full local copy.\n\nChanges settle for 15 seconds before synchronization. Deleting folders does\nnot unpublish videos. Replacing a published recording requires review.\nExtra exports in one video folder are held; notes and artwork are not\npublished yet. Check Cinema Playlist Status.txt in the publishing root.\n';
  for(const [index,name]of names.entries()){
    const directory=path.join(music,name);try{await fs.access(directory);throw new Error('A proposed playlist folder already exists');}catch(error){if(error.code!=='ENOENT')throw error;}
    plans.push({directory,id:randomUUID(),index});
  }
  for(const plan of plans){await fs.mkdir(plan.directory);await fs.writeFile(path.join(plan.directory,'.playlist.json'),JSON.stringify({version:1,id:plan.id,kind:provider === 'Music' && plan.index < 3 ? 'audio' : 'video'}),{flag:'wx',mode:0o600});await fs.writeFile(path.join(plan.directory,'README.txt'),instructions,{flag:'wx'});}
  const destinations=new Map();
  const counts = new Map();
  for(const item of items){
    const groupIndex = provider === 'Cinema' ? (/^3I\s*[| ]\s*ATLAS/i.test(item.title) ? 0 : 1) : item.kind === 'video' ? 3 : 0;
    const index = counts.get(groupIndex) ?? 0; counts.set(groupIndex,index+1);
    const folder=path.join(plans[groupIndex].directory,`${String(index+1).padStart(2,'0')} ${safe(item.title)}`);await fs.mkdir(folder);
    const title=path.basename(folder).replace(/^\d+[ ._-]+/,'');
    await fs.writeFile(path.join(folder,'.track.json'),JSON.stringify({version:1,itemId:item.id,folderTitle:title,displayTitle:item.title},null,2),{flag:'wx',mode:0o600});
    await fs.writeFile(path.join(folder,'Listen online.webloc'),`<?xml version="1.0" encoding="UTF-8"?><plist version="1.0"><dict><key>URL</key><string>${xml(item.src)}</string></dict></plist>`,{flag:'wx'});
    destinations.set(item.versionId,folder);
  }
  const moved=[];
  if(moveLocalFiles){
    for(const entry of await fs.readdir(music,{withFileTypes:true})){
      if(!entry.isFile()||!MEDIA_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))continue;
      const source=path.join(music,entry.name),before=await fs.stat(source),hash=await fileHash(source);const after=await fs.stat(source);
      if(before.size!==after.size||before.mtimeMs!==after.mtimeMs)throw new Error('An export is still changing; leave it in place');
      const folder=destinations.get(hash);if(!folder)continue;
      const destination=path.join(folder,entry.name);await fs.copyFile(source,destination,fs.constants.COPYFILE_EXCL);if(await fileHash(destination)!==hash)throw new Error('Local copy verification failed');
      // Keep the original bytes in a private local archive after verifying the
      // organized copy, so the parent folder contains only playlist structure.
      const archive=path.join(state,'original-flat-drops',provider);await fs.mkdir(archive,{recursive:true});
      const archived=path.join(archive,entry.name);try{await fs.access(archived);throw new Error('Original archive already exists');}catch(error){if(error.code!=='ENOENT')throw error;}
      await fs.rename(source,archived);moved.push({source,destination,archived});
    }
  }
  await fs.writeFile(path.join(music,'README.txt'),instructions);
  const priorReference=path.join(music,'Published Playlist');
  try { await fs.access(path.join(priorReference,'.viaims-library.json')); const backup=path.join(state,`previous-${provider.toLowerCase()}-reference`);await fs.rename(priorReference,backup); } catch(error) { if(error.code!=='ENOENT')throw error; }
  await fs.writeFile(config,JSON.stringify({version:1,enabled:true},null,2),{flag:'wx',mode:0o600});
  return {playlists:plans.map(p=>p.directory),tracks:items.length,organizedCopies:moved};
}
