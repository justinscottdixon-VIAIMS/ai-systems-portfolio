import { robotsTxt } from '../lib/public-site.mjs';
export function GET() {
 return new Response(robotsTxt({blockTraining:process.env.VIAIMS_BLOCK_GPTBOT === 'true'}), {headers:{'Content-Type':'text/plain; charset=utf-8'}});
}
