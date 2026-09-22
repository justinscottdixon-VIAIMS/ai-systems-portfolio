import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {toPortfolioRecords} from '../src/lib/portfolio-records.mjs';
import {archiveEntries,matchesArchiveQuery} from '../src/lib/archive-index.mjs';
const source=JSON.parse(await readFile(new URL('../src/data/portfolio-records.json',import.meta.url)));
const credit={title:'Cerulean Blue',scope:'Track 12',roles:['Mastering'],collaborators:'Gruvhaus vs ColorFreQ — recording artist',note:'Kenneth Graham has the whole-album mastering credit.',evidence:'Database credit transcribed in the master; packaging comparison pending.'};
function fixture(){const s=structuredClone(source);s.records[0].children[0].credits=[structuredClone(credit)];s.records[0].children[0].publicSources=[{label:'Edition',href:'https://www.discogs.com/release/646831',supports:'Track 12 mastering'}];return s;}
test('track credits and edition sources survive validation and are searchable',()=>{
 const records=toPortfolioRecords(fixture());const child=records.find(r=>r.id==='cosmic-records-history').children[0];
 assert.deepEqual(child.credits,[credit]);assert.equal(child.publicSources[0].href,'https://www.discogs.com/release/646831');
 assert.equal(archiveEntries(records).some(e=>matchesArchiveQuery(e,'Cerulean mastering')),true);
});
test('malformed credits and duplicate release anchors fail validation',()=>{
 let s=fixture();s.records[0].children[0].credits[0].roles=[];assert.throws(()=>toPortfolioRecords(s),/roles/);
 s=fixture();s.records[0].children[0].publicSources[0].href='javascript:alert(1)';assert.throws(()=>toPortfolioRecords(s),/HTTPS/);
 s=fixture();s.records[0].children.push(s.records[0].children[0]);assert.throws(()=>toPortfolioRecords(s),/duplicate.*child/);
});

test('catalogue releases without personal contributions remain valid and searchable',()=>{
 const records=toPortfolioRecords(source);
 const child=records.find(r=>r.id==='cosmic-records-history').children.find(c=>c.id==='cosmic-013');
 assert.deepEqual(child.roles,[]);
 assert.equal(archiveEntries(records).some(e=>matchesArchiveQuery(e,'Work 4 Love')),true);
 const invalid=structuredClone(source);delete invalid.records[0].children[0].roles;
 assert.throws(()=>toPortfolioRecords(invalid),/roles/);
});
