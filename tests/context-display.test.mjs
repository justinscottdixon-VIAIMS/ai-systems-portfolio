import test from 'node:test';
import assert from 'node:assert/strict';
import {contextDisplay} from '../src/lib/context-display.mjs';
const source={href:'https://example.test/one',supports:'Edition credit'};
const record={summary:'Summary',dateDisplay:'2000',format:'CD',roles:['Producer'],publicSources:[source]};
const release={summary:'Summary',date:'2000',format:'CD',roles:['Producer'],publicSources:[source]};
test('matching release facts are suppressed without modifying canonical context',()=>{
 const before=JSON.stringify(record);const result=contextDisplay(record,{release});assert.equal(result.showSummary,false);assert.equal(result.showDate,false);assert.equal(result.showFormat,false);assert.equal(result.showRoles,false);assert.deepEqual(result.sources,[source]);assert.equal(JSON.stringify(record),before);
});
test('distinct editions retain all their context facts',()=>{
 const result=contextDisplay(record,{release:{summary:'Other',date:'2001',format:'Vinyl',roles:['Engineer'],publicSources:[]}});for(const key of['showSummary','showDate','showFormat','showRoles'])assert.equal(result[key],true);
});
test('source deduplication applies only where the same support is already shown',()=>{
 assert.deepEqual(contextDisplay(record,{release,sourcesAlreadyShown:true}).sources,[]);
 const different={...release,publicSources:[{...source,supports:'Different claim'}]};assert.deepEqual(contextDisplay(record,{release:different,sourcesAlreadyShown:true}).sources,[source]);
});
test('standalone contexts preserve original content and explicit summary options',()=>{
 const result=contextDisplay(record);for(const key of['showSummary','showDate','showFormat','showRoles'])assert.equal(result[key],true);assert.equal(contextDisplay(record,{showSummary:false}).showSummary,false);assert.equal(contextDisplay(record,{release,showSummary:true}).showSummary,true);
});
