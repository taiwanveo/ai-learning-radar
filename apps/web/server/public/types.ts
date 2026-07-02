import { z } from "zod";
import { contentDetailSchema, publicDigestItemSchema, publicDigestResponseSchema } from "@/lib/schemas";

export const digestSortSchema = z.enum([
  "default", "latest", "popular", "beginner",
  "recommended", "engagement", "newest", "views",
]);

export const digestQuerySchema = z.object({
  topic: z.string().trim().min(1).default("artificial-intelligence"),
  date: z.string().date().optional(),
  sort: digestSortSchema.default("default"),
  difficulty: z.enum(["all", "beginner", "normal"]).default("all"),
  language: z.string().trim().min(1).optional(),
  published: z.enum(["all", "7d", "30d", "90d"]).default("all"),
  contentType: z.enum(["all", "video", "article"]).default("all"),
  recommended: z.enum(["all", "true", "false"]).default("all"),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const searchQuerySchema = z.object({
  q: z.string().trim().max(120).default(""),
  difficulty: z.enum(["all", "beginner", "normal"]).default("all"),
  limit: z.coerce.number().int().min(1).max(50).default(25),
});

export const learningPathRequestSchema = z.object({
  query: z.string().trim().min(1).max(120),
  difficulty: z.enum(["all", "beginner", "normal"]).default("all"),
  contentItemIds: z.array(z.string().uuid()).min(3).max(25),
});

export const learningPathResponseSchema = z.object({
  guidance: z.string().min(1),
  recommended_order: z.array(z.object({
    content_item_id: z.string().uuid(),
    rank: z.number().int().positive(),
    reason: z.string().min(1),
    learning_role: z.string().min(1),
  })).min(3).max(7),
  watch_later: z.array(z.object({
    content_item_id: z.string().uuid(),
    reason: z.string().min(1),
  })),
  next_steps: z.array(z.string().min(1)).min(1),
});

export type DigestQuery = z.infer<typeof digestQuerySchema>;
export type SearchQuery = z.infer<typeof searchQuerySchema>;
export type DigestItem = z.infer<typeof publicDigestItemSchema>;
export type ContentDetail = z.infer<typeof contentDetailSchema>;
export type DigestResponse = z.infer<typeof publicDigestResponseSchema>;
export type LearningPath = z.infer<typeof learningPathResponseSchema>;

export type PublicData<T> = {
  data: T;
  source: "database" | "demo";
};
