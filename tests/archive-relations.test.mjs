import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {toPortfolioRecords} from '../src/lib/portfolio-records.mjs';
const source=JSON.parse(await readFile(new URL('../src/data/portfolio-records.json',import.meta.url)));
test('release relationships survive validation and reject dangling targets',()=>{
 const s=structuredClone(source);s.records[0].children[0].relatedRecordIds=['time-travel'];
 assert.deepEqual(toPortfolioRecords(s).find(r=>r.id===s.records[0].id).children[0].relatedRecordIds,['time-travel']);
 s.records[0].children[0].relatedRecordIds=['absent-record'];assert.throws(()=>toPortfolioRecords(s),/related record/);
});
