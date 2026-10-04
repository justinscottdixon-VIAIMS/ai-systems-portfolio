import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { activeTransportPolicy } from '../src/lib/active-transport.mjs';
import { createMusicQueue, setRepeatMode, toggleShuffle } from '../src/lib/music-queue.mjs';
import { createFullscreenSession } from '../src/lib/fullscreen-session.mjs';
const source = await readFile(new URL('../src/components/HybridMediaEngine.astro', import.meta.url), 'utf8');
function named(name) {
 const start = source.search(new RegExp(`\\t(?:async )?function ${name}\\(`));
 const end = source.slice(start + 1).search(/\n\t(?:async )?function /);
 return source.slice(start, start + 1 + end);
}
const button = () => ({ dataset: {}, setAttribute(k,v) { this[k] = v; }, addEventListener(t,fn) { this[t] = fn; } });
for (const provider of ['cinema', 'youtube']) test(`Music queue controls configure the browsed deck while ${provider} owns playback`, () => {
 const start = source.indexOf("\tshuffleButton.addEventListener('click'");
 const end = source.indexOf("\tcinemaAudioInvitation.addEventListener('click'", start);
 const playback = { provider, id:'film', mode:'video' };
 const ctx = { session:{activeTab:'music',playback}, musicQueue:createMusicQueue([{productId:'song',kind:'audio',src:'/song.mp3'}]),
  transportPlayback:()=>({provider:'music',id:'song',mode:'audio'}),activeTransportPolicy,setRepeatMode,toggleShuffle,
  shuffleButton:button(),repeatButton:button(),enqueueMediaControlTransition:fn=>fn() };
 runInNewContext(source.slice(start,end),ctx);
 ctx.repeatButton.click(); ctx.shuffleButton.click();
 assert.equal(ctx.musicQueue.repeat,'one'); assert.equal(ctx.musicQueue.shuffle,true);
 assert.equal(ctx.session.playback,playback,'queue configuration must not claim audio');
});
test('pending decorative playback does not hold a queued control behind the master', async () => {
 let release; const pending = new Promise(resolve=>release=resolve); let muted=false;
 const ctx={cinemaBrandCard:{cancel(){}},transitionQueue:Promise.resolve(),hasReportedTransitionError:false,nowPlayingStatus:{},console,
  mv:{play:async()=>{}},activeMirrorWings:()=>[{play:()=>pending}],playMirrorWings:()=>pending};
 runInNewContext(named('enqueueTransition')+named('playVideoStack'),ctx);
 ctx.enqueueTransition(()=>ctx.playVideoStack());const mute=ctx.enqueueTransition(()=>{muted=true});
 try { for(let i=0;i<20;i++) await Promise.resolve(); assert.equal(muted,true); }
 finally { release(); await mute; }
});
test('repeated fullscreen rendering preserves existing mute button content', () => {
 let writes=0,text='MUTE';const activeMute=button();
 Object.defineProperty(activeMute,'textContent',{get:()=>text,set:v=>{writes++;text=v;}});
 const ctx={activeMute,fullscreenPrev:button(),fullscreenPlay:button(),fullscreenNext:button(),fullscreenMute:button(),
  fullscreenSession:createFullscreenSession(),fullscreenShell:{dataset:{}},fullscreenTitle:{},nowPlayingTitle:{textContent:'Song'},
  activeAuthoritativeMedia:()=>({paused:false,muted:false}),activeTransportPolicy,
  session:{playback:{provider:'music',id:'song',mode:'audio'}},entryControlsLocked:false,scheduleFullscreenHide(){}};
 runInNewContext(named('renderFullscreenSession'),ctx);ctx.renderFullscreenSession();ctx.renderFullscreenSession();
 assert.equal(writes,0,'pointer-driven refresh must not replace unchanged button content');
});
for (const superseded of [false,true]) test(`decorative playback failure is isolated, superseded=${superseded}`, async () => {
 let reject;const pending=new Promise((_,no)=>reject=no);let failures=0;
 const ctx={mirrorActivationGeneration:3,activeMirrorWings:()=>[{play:()=>pending}],handleMirrorWingFailure:()=>failures++};
 runInNewContext(named('playMirrorWings'),ctx);const result=ctx.playMirrorWings();
 if(superseded)ctx.mirrorActivationGeneration++;
 reject(Error('wing unavailable'));await result;
 assert.equal(failures,superseded?0:1);
});
test('authoritative master rejection still reaches the transition error path',async()=>{
 const ctx={cinemaBrandCard:{cancel(){}},mv:{play:async()=>{throw Error('master failed')}},playMirrorWings:async()=>{}};
 runInNewContext(named('playVideoStack'),ctx);
 await assert.rejects(ctx.playVideoStack(),/master failed/);
});
test('manual Cinema selection defers loading until card completion without holding the queue', async()=>{
 let complete;let paused=0;let request;
 const ctx={session:{lease:null},videoPlaylist:[{id:'a'},{id:'b'}],pauseVideoStack(){paused++},cinemaBrandCard:{show(fn){complete=fn}},enqueueTransition:fn=>fn()};
 runInNewContext(named('activateCinema'),ctx);
 await ctx.activateCinema(1,{showBrandCard:true,preserveAudibleAuthority:true});
 assert.equal(paused,1);assert.equal(typeof complete,'function');
 ctx.activateCinema=(index,options)=>{request={index,options}};
 complete();assert.equal(request.index,1);assert.equal(request.options.preserveAudibleAuthority,true);
 assert.equal(request.options.showBrandCard,undefined,'do not show a second card');
});
test('a removed Cinema target cannot be started by a pending card',async()=>{
 let complete;let started=false;
 const ctx={session:{lease:null},videoPlaylist:[{id:'a'}],pauseVideoStack(){},cinemaBrandCard:{show(fn){complete=fn}},enqueueTransition:fn=>fn()};
 runInNewContext(named('activateCinema'),ctx);
 await ctx.activateCinema(0,{showBrandCard:true});ctx.videoPlaylist=[];ctx.activateCinema=()=>{started=true};complete();assert.equal(started,false);
});
