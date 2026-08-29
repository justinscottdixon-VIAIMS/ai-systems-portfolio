// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://viaims.com',
  output: 'static',
  publicDir: './public-deploy',
  vite: {
    plugins: [tailwindcss()],
  },
});
