// @ts-check
import { defineConfig } from 'astro/config';
import { rm } from 'node:fs/promises';
import { excludedArtworkPaths } from './src/lib/artwork-presentation-policy.mjs';

import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://viaims.com',
  output: 'static',
  publicDir: './public-deploy',
  integrations: [{
    name: 'credentials-artwork-publication-policy',
    hooks: {
      'astro:build:done': async ({ dir }) => {
        // Old static dossiers are development evidence, not current release routes.
        // Exclude them in every scope so they cannot bypass the presentation policy.
        await rm(new URL('reference/archive/', dir), { recursive: true, force: true });
        // Astro copies public-deploy wholesale. Remove only the generated output
        // copies of original release captures; preserve all source evidence files.
        await Promise.all(excludedArtworkPaths.map(src => rm(new URL(src.slice(1), dir), { force: true })));
        if (process.env.VIAIMS_RELEASE_SCOPE === 'player') {
          await rm(new URL('archive/', dir), { recursive: true, force: true });
          await rm(new URL('production-notes/', dir), { recursive: true, force: true });
          await rm(new URL('reference/', dir), { recursive: true, force: true });
        }
      },
    },
  }],
  vite: {
    plugins: [tailwindcss()],
  },
});
