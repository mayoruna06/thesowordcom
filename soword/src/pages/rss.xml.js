import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

export async function GET(context) {
  const chapters = await getCollection('chapters');

  return rss({
    title: '小書樓',
    description: '勒索沃德的創作基地',
    site: context.site,
    items: chapters
      .sort((a, b) => b.data.publishedAt - a.data.publishedAt)
      .slice(0, 20)
      .map(ch => ({
        title: ch.data.title,
        pubDate: ch.data.publishedAt,
        link: `/works/${ch.data.work}/${ch.slug}/`,
      })),
    customData: '<language>zh-TW</language>',
  });
}
