import { defineCollection, z } from 'astro:content';

const uuid = z.string().uuid();

const worksCollection = defineCollection({
  type: 'content',
  schema: z.object({
    workId:         uuid.optional(),
    title:          z.string(),
    subtitle:       z.string().max(100).default(''),
    author:         z.string().default('勒索沃德'),
    authorSlug:     z.string().regex(/^[a-z0-9][a-z0-9-]*$/).optional(),
    authorProfileId: uuid.optional(),
    genre:          z.enum(['romance', 'fantasy', 'sci-fi', 'thriller', 'slice-of-life', 'other']),
    status:         z.enum(['ongoing', 'completed', 'hiatus', 'draft']),
    summary:        z.string().max(200),
    cover:          z.string().optional(),
    tags:           z.array(z.string()).default([]),
    tagSlugs:       z.array(z.string()).default([]),
    featured:       z.boolean().default(false),
    contentWarning: z.array(z.string()).default([]),
    publishedAt:    z.coerce.date(),
    updatedAt:      z.coerce.date().optional(),
  }),
});

const authorsCollection = defineCollection({
  type: 'content',
  schema: z.object({
    profileId:   uuid.optional(),
    displayName: z.string(),
    avatar:      z.string().default(''),
    bio:         z.string().max(200).default(''),
    message:     z.string().max(500).default(''),
  }),
});
const chaptersCollection = defineCollection({
  type: 'content',
  schema: z.object({
    chapterId:   uuid.optional(),
    workId:      uuid.optional(),
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
  authors:       authorsCollection,
  chapters:      chaptersCollection,
  announcements: announcementsCollection,
};
