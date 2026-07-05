import { z } from "zod";
import {
  contentTypeSchema,
  difficultySchema,
  isoDateTimeSchema,
  scoreSchema,
  sourceTypeSchema,
} from "./common";
import { quizSchema } from "./quiz";

const publicContentBaseSchema = z.object({
  id: z.string().uuid(),
  sourceType: sourceTypeSchema,
  sourceUrl: z.string().url(),
  thumbnailUrl: z.string().url().nullable(),
  title: z.string().trim().min(1),
  channelTitle: z.string().trim().min(1).nullable(),
  channelUrl: z.string().url().nullable().default(null),
  publishedAt: isoDateTimeSchema.nullable(),
  viewCount: z.number().int().nonnegative(),
  likeCount: z.number().int().nonnegative(),
  commentCount: z.number().int().nonnegative(),
  engagementScore: scoreSchema,
  freshEngagementScore: scoreSchema,
  radarScore: scoreSchema.nullable().optional(),
  difficulty: difficultySchema,
  contentType: contentTypeSchema.optional(),
  language: z.string().trim().min(1).nullable(),
  isRecommendedChannel: z.boolean().default(false),
  isPinned: z.boolean().default(false),
  tags: z.array(z.string().trim().min(1)).max(30),
  suitableFor: z.string().trim().min(1),
  shortSummary: z.string().trim().min(1),
  learningObjectives: z.array(z.string().trim().min(1)).min(1).max(10),
  quizCount: z.number().int().nonnegative(),
});

export const publicDigestItemSchema = publicContentBaseSchema;

export const contentDetailSchema = publicContentBaseSchema.extend({
  description: z.string().nullable().optional(),
  durationSeconds: z.number().int().nonnegative().nullable(),
  fullSummary: z.string().trim().min(1),
  transcriptSummary: z.string().trim().min(1).nullable(),
  limitationsOrCautions: z.string().trim().nullable().optional(),
  topicNames: z.array(z.string().trim().min(1)),
  quiz: quizSchema.nullable(),
});

export const publicDigestResponseSchema = z.object({
  date: z.string().date(),
  topic: z.object({
    id: z.string().uuid(),
    slug: z.string().min(1),
    name: z.string().min(1),
  }),
  items: z.array(publicDigestItemSchema),
});

export type PublicDigestItem = z.infer<typeof publicDigestItemSchema>;
export type ContentDetail = z.infer<typeof contentDetailSchema>;
export type PublicDigestResponse = z.infer<typeof publicDigestResponseSchema>;
