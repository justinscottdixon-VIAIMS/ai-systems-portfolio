import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {normalizePresentationLinks,mergePresentationLinks} from '../src/lib/release-presentations.mjs';
import {archiveEntries,matchesArchiveQuery} from '../src/lib/archive-index.mjs';
import {toPortfolioRecords} from '../src/lib/portfolio-records.mjs';
import {toCredentialCollections} from '../src/lib/credential-collections.mjs';
const source=JSON.parse(await fs.readFile(new URL('../src/data/portfolio-records.json',import.meta.url)));
const good={href:'/production-notes/sandra-collins/',label:'Read the studio story',description:'Firsthand studio history.'};
test('presentation links reject private paths, external navigation and malformed labels',()=>{
 for(const href of ['file:///Users/scott/private.html','/docs/research/private.json','https://example.test','//example.test','/production-notes/../private/','javascript:alert(1)'])assert.throws(()=>normalizePresentationLinks([{...good,href}]));
 assert.throws(()=>normalizePresentationLinks([{...good,label:''}]));assert.equal(mergePresentationLinks([good],[good]).length,1);
});
test('all three Sandra album cards retain their story links after timeline consolidation',()=>{
 const records=toPortfolioRecords(source);const grouped=toCredentialCollections(records).find(r=>r.id==='singles-remixes');
 for(const id of ['compilation-appearances-d003','compilation-appearances-d015','compilation-appearances-d016']){const item=grouped.children.find(c=>c.id===id);assert.ok(item,id);assert.ok(item.presentationLinks.some(l=>l.href===good.href),id);}
 assert.equal(grouped.children.find(c=>c.id==='compilation-appearances-d003').presentationLinks.length,2);
 assert.equal(grouped.children.find(c=>c.id==='compilation-appearances-d016').presentationLinks.length,2);
 assert.equal(grouped.children.find(c=>c.id==='compilation-appearances-d015').presentationLinks.length,1);
});
test('Spice Market is one chronological card with both aliases and full-release mastering',()=>{
 const children=toCredentialCollections(toPortfolioRecords(source)).find(r=>r.id==='singles-remixes').children;const matches=children.filter(c=>c.id==='spice-market');assert.equal(matches.length,1);const card=matches[0];assert.match(card.summary,/DXN aka Voyager/);assert.ok(card.credits.some(c=>c.scope==='Entire RYR021 release · all tracks'&&c.roles.includes('Mastering engineer')));const next=children[children.indexOf(card)+1];assert.ok(!next||!/^200[0-8]/.test(next.date));
});
test('Sandra album roles preserve firsthand attribution and printed intro scope',()=>{
 const parent=toPortfolioRecords(source).find(r=>r.id==='compilation-appearances');for(const id of ['d003','d015','d016'])assert.ok(parent.children.find(c=>c.id===id).credits.some(c=>c.scope==='Full album · Scott Dixon’s firsthand account'&&c.roles.includes('Album mixing')));
 const t=parent.children.find(c=>c.id==='d003');assert.ok(t.credits.some(c=>c.title==='S&S DAY FOUR'&&c.scope.startsWith('Opening intro')));assert.ok(t.credits.find(c=>c.title==='Motion').roles.includes('Producer'));
 const perfecto=parent.children.find(c=>c.id==='d016');assert.ok(!perfecto.credits.some(c=>c.roles.some(r=>/mastering/i.test(r))));
});

test('flowchart labels and descriptions are discoverable through release search',()=>{
 const entries=archiveEntries(toCredentialCollections(toPortfolioRecords(source)));const entry=entries.find(e=>e.href.endsWith('#compilation-appearances-d003'));assert.ok(matchesArchiveQuery(entry,'production flowchart'));assert.ok(matchesArchiveQuery(entry,'Pro Tools finishing'));
});
