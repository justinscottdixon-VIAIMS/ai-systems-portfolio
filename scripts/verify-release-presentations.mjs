import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import source from '../src/data/portfolio-records.json' with {type:'json'};
import {toPortfolioRecords} from '../src/lib/portfolio-records.mjs';
import {toCredentialCollections} from '../src/lib/credential-collections.mjs';
const build=path.resolve(process.argv[2]??'dist');
const [theater,dossier]=await Promise.all(['index.html','archive/singles-remixes/index.html'].map(p=>fs.readFile(path.join(build,p),'utf8')));
const cards=toCredentialCollections(toPortfolioRecords(source)).find(r=>r.id==='singles-remixes').children;
let links=0;const targets=new Set();
for(const card of cards)for(const link of card.presentationLinks??[]){
  for(const [html,id]of [[theater,`singles-remixes-${card.id}`],[dossier,card.id]]){
    const start=html.indexOf(`id="${id}"`);assert.ok(start>=0,`Missing card ${id}`);const end=html.indexOf('</article>',start);assert.ok(html.slice(start,end).includes(`href="${link.href}"`),`${id} does not expose ${link.href}`);
  }
  const target=path.join(build,link.href,link.href.endsWith('/')?'index.html':'');await fs.access(target);targets.add(target);links++;
}
let assets=0;
for(const target of targets){const html=await fs.readFile(target,'utf8');assert.ok(!/file:\/\/|\/Users\//.test(html),'Local path exposed');for(const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)){const href=match[1];if(/^(https?:|mailto:|data:)/.test(href))continue;const raw=href.split('#')[0].split('?')[0];if(!raw)continue;let local=href.startsWith('/')?path.join(build,raw):path.resolve(path.dirname(target),raw);if(raw.endsWith('/'))local=path.join(local,'index.html');await fs.access(local);assets++;}}
assert.equal(cards.filter(c=>c.id==='spice-market').length,1);assert.ok(dossier.includes('DXN aka Voyager'));console.log(JSON.stringify({linkedCards:cards.filter(c=>c.presentationLinks?.length).length,presentationLinks:links,publicTargets:targets.size,localAssetAndReturnLinks:assets,spiceMarketCards:1}));
