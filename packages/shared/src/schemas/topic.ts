import { z } from "zod";

export const topicKeywordTypeSchema = z.enum([
  "positive",
  "negative",
  "synonym",
  "tw_term",
  "cn_term",
  "english",
]);

export const topicKeywordSchema = z.object({
  id: z.string().uuid().optional(),
  keyword: z.string().trim().min(1).max(200),
  keywordType: topicKeywordTypeSchema,
  weight: z.number().finite().min(-100).max(100).default(1),
  isActive: z.boolean().default(true),
});

export const topicSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().trim().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  nameZhHant: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).nullable().optional(),
  parentTopicId: z.string().uuid().nullable().optional(),
  isActive: z.boolean(),
  sortOrder: z.number().int(),
  keywords: z.array(topicKeywordSchema).optional(),
});

export const topicInputSchema = topicSchema.omit({ id: true }).partial({
  isActive: true,
  sortOrder: true,
});

export type Topic = z.infer<typeof topicSchema>;
export type TopicInput = z.infer<typeof topicInputSchema>;
