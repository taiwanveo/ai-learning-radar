import { z } from "zod";

export const sourceTypeSchema = z.enum([
  "youtube",
  "article",
  "bilibili",
  "rss",
  "manual",
]);

export const difficultySchema = z.enum(["beginner", "normal"]);
export const contentTypeSchema = z.enum([
  "tutorial",
  "news",
  "opinion",
  "product_demo",
  "marketing",
  "interview",
  "other",
]);

export const isoDateTimeSchema = z.string().datetime({ offset: true });
export const scoreSchema = z.number().finite().min(0);
export const confidenceSchema = z.number().finite().min(0).max(1);
