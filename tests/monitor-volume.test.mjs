import test from 'node:test';
import assert from 'node:assert/strict';
import { monitorGain, monitorLevelText, createMonitorVolumeController } from '../src/lib/monitor-volume.mjs';

test('monitor fader has silence, perceptual travel, and unity without boost', () => {
 assert.equal(monitorGain(0),0);assert.equal(monitorGain(50),0.25);assert.equal(monitorGain(100),1);
 assert.equal(monitorLevelText(50),'−12.0 dB');assert.equal(monitorLevelText(0),'−∞ dB');
 for(const value of [-1,101,NaN]) assert.throws(()=>monitorGain(value),RangeError);
});
test('listening volume changes all native decks without changing mute or restoring full level', () => {
 const decks=[{muted:true,volume:1},{muted:false,volume:1}];
 const volume=createMonitorVolumeController(decks);volume.setPosition(50);
 assert.deepEqual(decks,[{muted:true,volume:0.25},{muted:false,volume:0.25}]);
 volume.setPosition(0);assert.ok(decks.every(d=>d.volume===0));
 volume.restore();assert.equal(volume.position,50);assert.ok(decks.every(d=>d.volume===0.25));
 assert.equal(decks[0].muted,true);assert.equal(decks[1].muted,false);
});
