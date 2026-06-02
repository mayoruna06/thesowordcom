import { defineCollection, z } from 'astro:content';

const worksCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title:          z.string(),
    author:         z.string().default('勒索沃德'),
    genre:          z.enum(['romance', 'fantasy', 'sci-fi', 'thriller', 'slice-of-life', 'other']),
    status:         z.enum(['ongoing', 'completed', 'hiatus', 'draft']),
    summary:        z.string().max(200),
    cover:          z.string().optional(),
    tags:           z.array(z.string()).default([]),
    featured:       z.boolean().default(false),
    contentWarning: z.array(z.string()).default([]),
    publishedAt:    z.coerce.date(),
    updatedAt:      z.coerce.date().optional(),
  }),
});

const chaptersCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title:       z.string(),
    work:        z.string(),
    chapter:     z.number().int().positive(),
    wordCount:   z.number().int().nonnegative().optional(),
    publishedAt: z.coerce.date(),
    updatedAt:   z.coerce.date().optional(),
  }),
});

const announcementsCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title:       z.string(),
    publishedAt: z.coerce.date(),
    pinned:      z.boolean().default(false),
  }),
});

export const collections = {
  works:         worksCollection,
  chapters:      chaptersCollection,
  announcements: announcementsCollection,
};
