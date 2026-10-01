export const siteUrl = 'https://viaims.com/';
export const publicProfile = Object.freeze({
 name: 'Justin Scott Dixon',
 title: 'Justin Scott Dixon | Music, Video & Spatial Audio | VIAIMS',
 description: 'Music, video and spatial audio by Justin Scott Dixon. Explore selected sound and visual projects from VIAIMS, the Voyager Institute of AI Music Systems.',
 introduction: 'I’m Justin Scott Dixon, a music and video producer, spatial audio engineer and creative technologist. Through VIAIMS—the Voyager Institute of AI Music Systems—I bring together sound, moving image and AI-assisted creative work. Explore the player for selected music and visual projects.',
 channel: 'https://www.youtube.com/@justinscottdixon_voyager',
});
export function publicContact(value) {
 if (!value) return null;
 const url = new URL(value);
 if (url.protocol === 'mailto:' && /^[^\s@?]+@[^\s@?]+\.[^\s@?]+$/.test(url.pathname) && !url.search && !url.hash) return url.href;
 if (url.protocol === 'https:' && !url.username && !url.password) return url.href;
 throw new Error('Public contact must be a plain mailto email or credential-free HTTPS booking URL.');
}
export function structuredIdentity() {
 return {'@context':'https://schema.org','@type':'Person',name:publicProfile.name,url:siteUrl,sameAs:[publicProfile.channel]};
}
export function sitemapXml(records, scope = 'full') {
 const urls = [siteUrl];
 if (scope !== 'player') {
  urls.push(`${siteUrl}archive/`);
  for (const record of records) urls.push(`${siteUrl}archive/${encodeURIComponent(record.slug)}/`);
 }
 return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(url=>`<url><loc>${url}</loc></url>`).join('')}</urlset>\n`;
}
export function robotsTxt({blockTraining = false} = {}) {
 return `User-agent: *\nAllow: /\n\nUser-agent: OAI-SearchBot\nAllow: /\n\n${blockTraining ? 'User-agent: GPTBot\nDisallow: /\n\n' : ''}Sitemap: ${siteUrl}sitemap.xml\n`;
}
