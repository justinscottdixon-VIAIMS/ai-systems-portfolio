import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { BlobPreconditionFailedError } from '@vercel/blob';
import { MEDIA_EXTENSIONS } from './publisher-audit.mjs';
import { registryDocument, readApprovedRegistry } from '../src/lib/approved-catalogue.mjs';
import { formatMusicDisplayTitle } from '../src/lib/music-title.mjs';

export const MUSIC_FOLDER_CONFIG = 'music-folder-layout.json';
const compare = new Intl.Collator('en', {numeric:true,sensitivity:'base'}).compare;
export const folderTitle = name => name.replace(/^\d+[ ._-]+/,'').trim();
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
async function jsonFile(filename) {
  const stat = await fs.lstat(filename);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 8192) throw new Error('Folder metadata needs review');
  return JSON.parse(await fs.readFile(filename,'utf8'));
}
async function newJson(filename,value) {
  try { await fs.writeFile(filename,JSON.stringify(value,null,2),{flag:'wx',mode:0o600}); }
  catch(error) { if(error.code!=='EEXIST')throw error; }
}
async function directories(directory) {
  const stat=await fs.lstat(directory);if(!stat.isDirectory()||stat.isSymbolicLink())throw new Error('Playlist folders must be real directories');
  const entries=await fs.readdir(directory,{withFileTypes:true});
  if(entries.some(e=>!e.name.startsWith('.')&&e.isSymbolicLink()))throw new Error('Playlist folders cannot contain symlinks');
  return entries.filter(e=>e.isDirectory()&&!e.name.startsWith('.')&&e.name!=='Published Playlist').sort((a,b)=>compare(a.name,b.name));
}
function validNames(entries) {
  const seen=new Set();
  for(const entry of entries) {
    const title=folderTitle(entry.name);const number=entry.name.match(/^(\d+)[ ._-]+/);
    if(!title||title.length>100||/[\x00-\x1f\x7f]/.test(title))throw new Error('Use a readable folder title of at most 100 characters');
    if(number&&seen.has(Number(number[1])))throw new Error('Two folders use the same ordering number');
    if(number)seen.add(Number(number[1]));
  }
}
export async function musicFoldersEnabled(root, provider = 'Music') {
  try { const config=await jsonFile(path.join(root,'.viaims-publisher',provider === 'Music' ? MUSIC_FOLDER_CONFIG : 'cinema-folder-layout.json'));return config.version===1&&config.enabled===true; }
  catch(error) { if(error.code==='ENOENT')return false;throw error; }
}

export async function discoverMusicFolderLayout(root, provider = 'Music') {
  if(!['Music','Cinema'].includes(provider))throw new Error('Unsupported playlist provider');
  if(!await musicFoldersEnabled(root,provider))return null;
  const musicRoot=path.join(root,provider);const playlists=await directories(musicRoot);validNames(playlists);
  const tracks=[],groups=[],playlistIds=new Set(),itemIds=new Set();
  for(const [playlistPosition,playlist]of playlists.entries()) {
    const playlistDirectory=path.join(musicRoot,playlist.name), marker=path.join(playlistDirectory,'.playlist.json');
    await newJson(marker,{version:1,id:randomUUID()});const metadata=await jsonFile(marker);
    if((metadata.kind !== undefined && !['audio','video'].includes(metadata.kind)) || metadata.version!==1||!/^[a-z0-9-]{1,80}$/i.test(metadata.id??'')||playlistIds.has(metadata.id))throw new Error('Playlist identity is invalid or duplicated');
    playlistIds.add(metadata.id);
    groups.push({playlistId:metadata.id,playlistTitle:folderTitle(playlist.name),playlistPosition});
    const folders=await directories(playlistDirectory);validNames(folders);
    for(const track of folders) {
      const directory=path.join(playlistDirectory,track.name),trackMarker=path.join(directory,'.track.json');
      let identity=null;try{identity=await jsonFile(trackMarker);}catch(error){if(error.code!=='ENOENT')throw error;}
      if(identity&&(identity.version!==1||typeof identity.itemId!=='string'||!identity.itemId.startsWith(`${provider}/`)||itemIds.has(identity.itemId)))throw new Error('Track identity is invalid or used in two folders');
      if(identity)itemIds.add(identity.itemId);
      const files=await fs.readdir(directory,{withFileTypes:true});
      if(files.some(e=>e.isSymbolicLink()))throw new Error('Track files cannot be symlinks');
      const media=files.filter(e=>e.isFile()&&MEDIA_EXTENSIONS.has(path.extname(e.name).toLowerCase()));
      const relativeDirectory=path.join(playlist.name,track.name);
      tracks.push({provider,expectedKind:metadata.kind,directory,relativeDirectory,marker:trackMarker,identity,folderTitle:folderTitle(track.name),playlistId:metadata.id,
        playlistTitle:folderTitle(playlist.name),playlistPosition,media:media.map(e=>path.join(relativeDirectory,e.name)),
        contextFiles:[marker,trackMarker]});
    }
  }
  return {provider,tracks,playlists:groups,fingerprint:hash({groups,tracks:tracks.map(t=>({path:t.relativeDirectory,identity:t.identity,title:t.folderTitle,playlistId:t.playlistId,playlistTitle:t.playlistTitle,playlistPosition:t.playlistPosition,media:t.media}))})};
}

export async function rememberPublishedTrack(track,item) {
  await newJson(track.marker,{version:1,itemId:item.id,folderTitle:track.folderTitle,displayTitle:item.title});
}
export function applyMusicFolderLayout(registry,layout) {
  const provider=layout.provider??'Music', folder=provider.toLowerCase();
  const prior=readApprovedRegistry(registry).items;const byId=new Map(prior.map(item=>[item.id,item]));
  const ordered=[];
  for(const track of layout.tracks) {
    if(!track.identity)continue;
    const item=byId.get(track.identity.itemId);
    if(!item||item.folder!==folder)throw new Error('A track folder refers to an unknown release');
    if(track.expectedKind && item.kind!==track.expectedKind)throw new Error('This playlist accepts a different kind of media');
    const title=track.identity.folderTitle===track.folderTitle ? track.identity.displayTitle??item.title : provider === 'Music' ? formatMusicDisplayTitle('',{overrideTitle:track.folderTitle}) : track.folderTitle;
    ordered.push({...item,title,playlistId:track.playlistId,playlistTitle:track.playlistTitle,playlistPosition:track.playlistPosition});byId.delete(item.id);
  }
  const groups=new Map((layout.playlists??[]).map(group=>[group.playlistId,group]));
  const retained=prior.filter(i=>i.folder===folder&&byId.has(i.id)).map(item=>({...item,...(groups.get(item.playlistId)??{})}));
  const music=[...ordered,...retained].map((item,index)=>({...item,playlistOrder:index}));
  const titles=new Set();for(const item of music){const key=item.title.normalize('NFKC').toLowerCase();if(titles.has(key))throw new Error('Two Music track folders have the same display title');titles.add(key);}
  return registryDocument([...prior.filter(i=>i.folder!==folder),...music]);
}

export async function createMusicFolderController({root,store,signal,now=Date.now,settleMs=15000,provider='Music'}) {
  const filename=path.join(root,'.viaims-publisher',`${provider.toLowerCase()}-layout-state.json`);let state={};
  try{state=await jsonFile(filename);}catch(error){if(error.code!=='ENOENT')throw error;}
  return {async reconcile(layout) {
    if(!layout)return;
    if(state.observed!==layout.fingerprint){state.observed=layout.fingerprint;state.observedAt=now();}
    if(state.applied===layout.fingerprint||now()-state.observedAt<settleMs){await fs.writeFile(filename,JSON.stringify(state),{mode:0o600});return;}
    for(let attempt=0;attempt<4;attempt++){
      signal?.throwIfAborted();const snapshot=await store.read({signal});if(!snapshot)throw new Error('Registry unavailable');
      const verified=await discoverMusicFolderLayout(root,provider);if(verified?.fingerprint!==layout.fingerprint)throw new Error('Folder layout changed during synchronization');
      const next=applyMusicFolderLayout(snapshot.registry,layout);
      if(hash(next)===hash(snapshot.registry)){state.applied=layout.fingerprint;break;}
      try {signal?.throwIfAborted();await store.write(next,snapshot.etag,{signal});state.applied=layout.fingerprint;break;}
      catch(error){if(!(error instanceof BlobPreconditionFailedError)||attempt===3)throw error;}
    }
    await fs.writeFile(filename,JSON.stringify(state),{mode:0o600});
  }};
}

export async function musicTrackStillEligible(root,track,relativeFile) {
  const current=(await discoverMusicFolderLayout(root,track.provider))?.tracks.find(item=>item.relativeDirectory===track.relativeDirectory);
  return Boolean(current && current.media.length===1 && current.media[0]===relativeFile && current.playlistId===track.playlistId && current.folderTitle===track.folderTitle);
}
