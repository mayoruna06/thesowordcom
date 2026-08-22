import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import rehypeSanitize from 'rehype-sanitize';

const processor = await createMarkdownProcessor({ rehypePlugins: [rehypeSanitize] });
const rendered = await processor.render(`
# 安全測試

<script>globalThis.compromised = true</script>
<img src=x onerror="globalThis.compromised = true">
[危險連結](javascript:alert(1))
`);

assert.doesNotMatch(rendered.code, /<script|onerror|javascript:/i,
  '作者可控制的 Markdown 不得輸出可執行 HTML');

const librarySource = await readFile(new URL('../src/pages/library/index.astro', import.meta.url), 'utf8');
const accountSource = await readFile(new URL('../src/pages/account/index.astro', import.meta.url), 'utf8');
assert.doesNotMatch(librarySource, /\.innerHTML\s*=/,
  '書架不得把作品或章節標題寫入 innerHTML');
assert.doesNotMatch(librarySource, /<script[^>]*define:vars/i,
  '書架不得把內容標題直接插入 script');
assert.doesNotMatch(accountSource, /\.innerHTML\s*=/,
  '個人資料不得以 innerHTML 建立頭像選項');

console.log('Frontend security smoke tests passed.');
