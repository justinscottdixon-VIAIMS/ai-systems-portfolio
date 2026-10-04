export const siteUrl = 'https://viaims.com/';
export const publicProfile = Object.freeze({
 name: 'Justin Scott Dixon',
 title: 'Justin Scott Dixon | Music, Video & Spatial Audio | VIAIMS',
 description: 'Music, video and spatial audio by Justin Scott Dixon. Explore selected sound and visual projects from VIAIMS, the Voyager Institute of AI Music Systems.',
 introduction: "Justin Scott Dixon’s creative work spans music, video, spatial audio and the technology that connects them. Through VIAIMS, the Voyager Institute of AI Music Systems, he explores how sound, moving image and AI-assisted workflows can support one another, with an emphasis on thoughtful experimentation and personal expression.\n\nThis site brings together a curated selection of that work, offering visitors a place to listen, watch and discover connections between the projects. Whether arriving with a particular interest or simply a little curiosity, visitors are welcome to spend time with the collection.\n\nThe site’s player reflects that same care, bringing a little of the tactile character and visual feedback of studio hardware into a web interface. It is an expression of Justin’s commitment to thoughtful presentation and technology that serves the experience.",
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
