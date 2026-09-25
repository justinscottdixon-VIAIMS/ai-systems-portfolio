import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { advanceMeter, initialMeter } from '../src/lib/stereo-meter.mjs';

test('meter dBFS, hold, fall, silence and reset are deterministic', () => {
 let m = advanceMeter(initialMeter(), [0.5, 1], 0);
 assert.ok(Math.abs(m.levels[0] + 6.0206) < 0.001);
 assert.equal(m.levels[1], 0);
 assert.deepEqual(m.clipped, [false, true]);
 m = advanceMeter(m, [0,0], 500);
 assert.ok(Math.abs(m.levels[0] + 13.5206) < 0.001);
 assert.equal(m.peaks[1], 0);
 m = advanceMeter(m, [0,0], 2500);
 assert.equal(m.clipped[1], false);
 assert.deepEqual(initialMeter().levels, [-60,-60]);
});

test('worklet accumulates short stereo peaks between reports without audible output', async () => {
 let Processor;
 vm.runInNewContext(await readFile('public-deploy/audio/stereo-peak-worklet.js','utf8'), {
  AudioWorkletProcessor: class { constructor(){this.port={postMessage:m=>this.messages.push(m)};this.messages=[];} },
  sampleRate:48000, registerProcessor:(name,klass)=>{Processor=klass;},
 });
 const p = new Processor();
 for(let n=0;n<13;n++) {
  const l=new Float32Array(128),r=new Float32Array(128);
  if(n===0){l[37]=0.25;r[80]=-1;}
  const output=[new Float32Array(128).fill(9),new Float32Array(128).fill(9)];
  assert.equal(p.process([[l,r]],[output]),true);
  assert.ok(output.every(c=>c.every(v=>v===0)));
 }
 assert.deepEqual(Array.from(p.messages[0].peaks),[0.25,1]);
 for(let n=0;n<13;n++)p.process([[new Float32Array(128).fill(0.5)]],[[new Float32Array(128)]]);
 assert.deepEqual(Array.from(p.messages[1].peaks),[0.5,0.5]);
 for(let n=0;n<13;n++)p.process([[]],[[new Float32Array(128)]]);
 assert.deepEqual(Array.from(p.messages[2].peaks),[0,0]);
});

test('controller routes each element once, clears pauses and replacements, and resumes context', async () => {
 const {connectStereoMeters} = await import('../src/lib/stereo-meter.mjs');
 const views=new Map();
 const root={querySelector:k=>{if(!views.has(k))views.set(k,{dataset:{},style:{setProperty(k,v){this[k]=v;}},setAttribute(){}});return views.get(k);},addEventListener(){},removeEventListener(){}};
 const probes=[], sources=[];let tick, now=0, resumes=0;
 class Context {
  createGain(){return {gain:{value:1},connect(){}};}
  state='running';destination={};audioWorklet={addModule:async()=>{}};
  resume(){resumes++;return Promise.resolve();}
  createMediaElementSource(element){const source={element,targets:[],connect(target){this.targets.push(target)}};sources.push(source);return source;}
 }
 class Worklet {port={postMessage(){}};connect(){}disconnect(){}constructor(){probes.push(this);}}
 const media={paused:false,muted:false,ended:false,volume:1,currentSrc:'one.mp3'};
 const meter=connectStereoMeters({root,elements:[media],getSource:()=>({element:media}),Context,Worklet,clock:()=>now,schedule:f=>{tick=f;return 1;},unschedule(){}});
 await meter.start();await meter.start();
 assert.equal(sources.length,1);assert.equal(sources[0].targets.length,2);assert.equal(resumes,2);
 tick();now=34;probes[0].port.onmessage({data:{epoch:2,peaks:[0.5,0.25],rms:[0.2,0.1],lufs:null,warming:true}});tick();
 assert.equal(views.get('#meter-l-value').textContent,'-6.0');
 assert.equal(views.get('#meter-r-value').textContent,'-12.0');
 now=50;probes[0].port.onmessage({data:{epoch:2,peaks:[1,1],rms:[0.3,0.3],lufs:-20,warming:false}});tick();assert.equal(views.get('#meter-l-value').textContent,'-6.0');assert.equal(views.get('#bar-l').style.width,'100%');
 media.paused=true;now=67;tick();assert.equal(views.get('#meter-status').textContent,'METERS IDLE');assert.equal(views.get('#meter-l').value,-60);
 media.paused=false;media.currentSrc='two.mp3';now=100;tick();assert.equal(views.get('#meter-l').value,-60);
 now=134;probes[0].port.onmessage({data:{epoch:5,peaks:[0.125,0.125],rms:[0.1,0.1],lufs:null,warming:true}});tick();assert.equal(views.get('#meter-l-value').textContent,'-18.1');
 meter.dispose();
});

test('worklet setup failure preserves native audio routing', async () => {
 const {connectStereoMeters} = await import('../src/lib/stereo-meter.mjs');
 let routes=0,tick;const views=new Map();
 const root={querySelector:k=>{if(!views.has(k))views.set(k,{dataset:{},style:{setProperty(k,v){this[k]=v;}},setAttribute(){}});return views.get(k);},addEventListener(){},removeEventListener(){}};
 class Context {state='running';audioWorklet={addModule:async()=>{throw Error('unavailable')}};resume(){return Promise.resolve()}createMediaElementSource(){routes++;}}
 const meter=connectStereoMeters({root,elements:[{}],getSource:()=>null,Context,schedule:f=>{tick=f;},unschedule(){}});
 await meter.start();tick();assert.equal(routes,0);assert.equal(views.get('#meter-status').textContent,'METERS UNAVAILABLE');meter.dispose();
});

test('green dissolves as either level advances through the final quarter', async () => {
 const { greenDissolve } = await import('../src/lib/stereo-meter.mjs');
 assert.equal(greenDissolve(-30,-35),1);
 assert.equal(greenDissolve(-7.5,-20),0.5);
 assert.equal(greenDissolve(-20,-7.5),0.5);
 assert.equal(greenDissolve(0,-6),0);
});

test('pre-mute routing keeps native samples available while output stays silent', async () => {
 const {routeMeterOutput}=await import('../src/lib/stereo-meter.mjs');
 const prototype={};
 Object.defineProperties(prototype,{
  muted:{get(){return this.nativeMuted;},set(v){this.nativeMuted=v;}},
  volume:{get(){return this.nativeVolume;},set(v){this.nativeVolume=v;}},
 });
 const media=Object.assign(Object.create(prototype),{nativeMuted:true,nativeVolume:0.4,dispatchEvent(){}});
 const gain={gain:{value:1}};
 routeMeterOutput(media,gain,prototype);
 assert.equal(media.nativeMuted,false);
 assert.equal(media.nativeVolume,1);
 assert.equal(media.muted,true);
 assert.equal(gain.gain.value,0);
 media.muted=false;
 assert.equal(gain.gain.value,0.4);
 media.volume=0;
 assert.equal(gain.gain.value,0);
 assert.equal(media.nativeVolume,1);
 media.volume=0.6;media.muted=true;
 assert.equal(gain.gain.value,0);
 assert.throws(()=>{media.volume=2;},RangeError);
});

 test('peak and RMS markers hold independently and decay slower than the live peak', () => {
 const amp = db => 10 ** (db / 20);
 let m = advanceMeter(initialMeter(), [amp(-6),amp(-12)], 0, [amp(-18),amp(-24)]);
 assert.deepEqual(m.rmsPeaks, [-18,-24]);
 m = advanceMeter(m, [0,0], 1000, [0,0]);
 assert.ok(Math.abs(m.peaks[0]+6)<1e-9);
 assert.equal(m.rmsPeaks[0],-18);
 m = advanceMeter(m, [0,0], 2000, [0,0]);
 assert.ok(Math.abs(m.peaks[0]+12)<1e-9);
 assert.equal(m.rmsPeaks[0],-20);
 assert.ok(m.peaks[0]>m.levels[0]);
 m = advanceMeter(m, [1,1], 2100, [amp(-10),amp(-10)]);
 assert.equal(m.peaks[0],0);
 assert.equal(m.rmsPeaks[0],-10);
 assert.deepEqual(initialMeter().rmsPeaks,[-60,-60]);
 });
