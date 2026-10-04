import test from 'node:test';
import assert from 'node:assert/strict';
import { createCinemaBrandCard } from '../src/lib/cinema-brand-card.mjs';
function fixture() {
 const element={hidden:true}; const tasks=[]; const cleared=[];
 const card=createCinemaBrandCard(element,{schedule:(fn,ms)=>{tasks.push({fn,ms});return tasks.length;},unschedule:id=>cleared.push(id)});
 return {element,tasks,cleared,card};
}
test('card is visible for two seconds and then resumes exactly once',()=>{
 const {element,tasks,card}=fixture();let resumed=0;card.show(()=>resumed++);
 assert.equal(element.hidden,false);assert.equal(tasks[0].ms,2000);assert.equal(resumed,0);
 tasks[0].fn();assert.equal(element.hidden,true);assert.equal(resumed,1);
});
test('manual playback cancels the interstitial and rejects a stale completion',()=>{
 const {element,tasks,cleared,card}=fixture();let resumed=0;card.show(()=>resumed++);card.cancel();
 tasks[0].fn();assert.equal(resumed,0);assert.equal(element.hidden,true);assert.deepEqual(cleared,[1]);
});
test('replacement card cannot be hidden or advanced by the previous timer',()=>{
 const {element,tasks,card}=fixture();const calls=[];card.show(()=>calls.push('old'));card.show(()=>calls.push('new'));
 tasks[0].fn();assert.equal(element.hidden,false);assert.deepEqual(calls,[]);
 tasks[1].fn();assert.deepEqual(calls,['new']);
});
