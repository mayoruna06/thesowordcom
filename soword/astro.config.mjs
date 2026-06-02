import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  base: '/',
  outDir: '../dist/soword',
  output: 'static',
  site: 'https://thesoword.com',

  integrations: [sitemap()],

  build: {
    format: 'directory',
  },

  markdown: {
    shikiConfig: {
      theme: 'github-light',
    },
  },
});
