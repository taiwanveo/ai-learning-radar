import { z } from "zod";

export const searchOrderSchema = z.enum(["relevance", "date", "viewCount"]);

export const adminSettingsSchema = z
  .object({
    topicId: z.string().uuid(),
    freshnessDays: z.number().int().min(1).max(3650),
    candidateLimit: z.number().int().min(1).max(500),
    topN: z.number().int().min(1).max(100),
    minDurationSeconds: z.number().int().min(0).max(86400),
    maxDurationSeconds: z.number().int().min(1).max(86400),
    excludeShorts: z.boolean(),
    minViewCount: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    minEngagementScore: z.number().finite().min(0).max(1),
    growthGuardrailEnabled: z.boolean(),
    minViewsPerDay: z.number().int().nonnegative().max(10_000_000),
    autoPublish: z.boolean(),
    youtubeRegionCode: z.string().trim().length(2).transform((value) => value.toUpperCase()),
    relevanceLanguage: z.string().trim().min(2).max(35),
    searchOrder: searchOrderSchema,
    scheduleCron: z.string().trim().min(9).max(100),
  })
  .superRefine((settings, context) => {
    if (settings.minDurationSeconds > settings.maxDurationSeconds) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["maxDurationSeconds"],
        message: "最長片長必須大於或等於最短片長",
      });
    }
    if (settings.topN > settings.candidateLimit) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["topN"],
        message: "Top N 不可超過候選數",
      });
    }
  });

export type AdminSettings = z.infer<typeof adminSettingsSchema>;
