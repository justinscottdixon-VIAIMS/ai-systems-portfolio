import source from '../data/portfolio-records.json';
import { toPortfolioRecords } from '../lib/portfolio-records.mjs';
import { selectReleaseRecords } from '../lib/release-scope.mjs';
import { sitemapXml } from '../lib/public-site.mjs';
export function GET() {
 const scope = process.env.VIAIMS_RELEASE_SCOPE ?? 'full';
 return new Response(sitemapXml(selectReleaseRecords(toPortfolioRecords(source),scope),scope), {headers:{'Content-Type':'application/xml; charset=utf-8'}});
}
