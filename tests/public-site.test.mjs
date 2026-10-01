import test from 'node:test';
import assert from 'node:assert/strict';
import { publicContact, sitemapXml, robotsTxt, structuredIdentity } from '../src/lib/public-site.mjs';
test('contact permits only an explicit public email link or credential-free HTTPS destination', () => {
 assert.equal(publicContact(), null);
 assert.equal(publicContact('mailto:studio@example.com'), 'mailto:studio@example.com');
 assert.equal(publicContact('https://example.com/book'), 'https://example.com/book');
 for (const value of ['javascript:alert(1)','http://example.com','https://user:password@example.com','mailto:bad','mailto:a@example.com?bcc=private@example.com']) assert.throws(() => publicContact(value));
});
test('player sitemap includes only the canonical homepage and no draft routes', () => {
 const xml = sitemapXml([], 'player');
 assert.equal((xml.match(/<loc>/g)||[]).length, 1);
 assert.ok(xml.includes('<loc>https://viaims.com/</loc>'));
 assert.ok(!xml.includes('/archive'));
});
test('full sitemap uses the actual published records', () => {
 const xml = sitemapXml([{slug:'time-travel'}], 'full');
 assert.ok(xml.includes('https://viaims.com/archive/time-travel/'));
 assert.equal((xml.match(/<loc>/g)||[]).length,3);
});
test('search and training policies remain independently configurable', () => {
 assert.ok(robotsTxt().includes('User-agent: *\nAllow: /'));
 assert.ok(!robotsTxt().includes('GPTBot'));
 assert.ok(robotsTxt({blockTraining:true}).includes('User-agent: GPTBot\nDisallow: /'));
 assert.ok(robotsTxt({blockTraining:true}).includes('User-agent: OAI-SearchBot\nAllow: /'));
});
test('structured identity is limited to visible name and owned channel, without invented affiliations', () => {
 const data=structuredIdentity();
 assert.equal(data['@type'],'Person');
 assert.equal(data.name,'Justin Scott Dixon');
 assert.equal(data.url,'https://viaims.com/');
 assert.ok(!('award' in data));
 assert.ok(!('worksFor' in data));
});
