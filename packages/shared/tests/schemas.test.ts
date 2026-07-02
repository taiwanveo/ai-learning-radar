import { describe, expect, it } from "vitest";
import {
  adminSettingsSchema,
  publicDigestItemSchema,
  quizSchema,
  topicSchema,
} from "../src/schemas/index.js";

const uuid = "7a36f62f-80d0-4f70-8b9b-c932f5e77d81";

describe("shared API schemas", () => {
  it("accepts a documented public digest item", () => {
    const item = publicDigestItemSchema.parse({
      id: uuid,
      sourceType: "youtube",
      sourceUrl: "https://www.youtube.com/watch?v=example",
      thumbnailUrl: "https://i.ytimg.com/vi/example/hqdefault.jpg",
      title: "RAG 入門",
      channelTitle: "教學頻道",
      publishedAt: "2026-07-02T08:00:00Z",
      viewCount: 2500,
      likeCount: 180,
      commentCount: 35,
      engagementScore: 0.072,
      freshEngagementScore: 0.036,
      difficulty: "beginner",
      language: "zh-Hant",
      tags: ["RAG"],
      suitableFor: "適合初學者。",
      shortSummary: "介紹 RAG 的基本概念。",
      learningObjectives: ["理解 RAG"],
      quizCount: 3,
    });

    expect(item.isRecommendedChannel).toBe(false);
  });

  it("rejects an invalid topic slug", () => {
    expect(() =>
      topicSchema.parse({
        id: uuid,
        slug: "人工智慧",
        nameZhHant: "人工智慧",
        isActive: true,
        sortOrder: 0,
      }),
    ).toThrow();
  });

  it("rejects inconsistent admin settings", () => {
    const result = adminSettingsSchema.safeParse({
      topicId: uuid,
      freshnessDays: 90,
      candidateLimit: 10,
      topN: 20,
      minDurationSeconds: 7200,
      maxDurationSeconds: 300,
      excludeShorts: true,
      minViewCount: 0,
      minEngagementScore: 0.05,
      growthGuardrailEnabled: false,
      minViewsPerDay: 250,
      autoPublish: true,
      youtubeRegionCode: "tw",
      relevanceLanguage: "zh-Hant",
      searchOrder: "relevance",
      scheduleCron: "0 22 * * *",
    });

    expect(result.success).toBe(false);
  });

  it("requires all three quiz question types", () => {
    const question = {
      questionType: "comprehension" as const,
      questionText: "RAG 的用途是什麼？",
      options: { A: "A", B: "B", C: "C", D: "D" },
      correctOptionKey: "A" as const,
      explanation: "解析",
      evidenceText: "影片證據",
    };

    expect(quizSchema.safeParse({ questions: [question, question, question] }).success).toBe(false);
  });
});
