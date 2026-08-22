import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { unified } from '@astrojs/markdown-remark';
import rehypeSanitize from 'rehype-sanitize';

export default defineConfig({
  base: '/soword/',
  outDir: '../dist/soword',
  output: 'static',
  site: 'https://thesoword.com',

  integrations: [sitemap()],

  build: {
    format: 'directory',
  },

  markdown: {
    // 作者可從後台編輯作品介紹；只允許安全的 Markdown/HTML 節點。
    processor: unified({ rehypePlugins: [rehypeSanitize] }),
    shikiConfig: {
      theme: 'github-light',
    },
  },
});
