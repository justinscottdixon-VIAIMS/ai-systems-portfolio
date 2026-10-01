// @ts-check
import { defineConfig } from 'astro/config';
import { rm } from 'node:fs/promises';

import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://viaims.com',
  output: 'static',
  publicDir: './public-deploy',
  integrations: [{
    name: 'selected-release-legacy-archive-exclusion',
    hooks: {
      'astro:build:done': async ({ dir }) => {
        // Old static dossiers are development evidence, not selected release routes.
        if (process.env.VIAIMS_RELEASE_SCOPE === 'selected') {
          await rm(new URL('reference/archive/', dir), { recursive: true, force: true });
        }
      },
    },
  }],
  vite: {
    plugins: [tailwindcss()],
  },
});
