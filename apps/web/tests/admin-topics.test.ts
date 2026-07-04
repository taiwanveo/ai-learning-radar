import { describe, expect, it } from "vitest";
import { MemoryAdminRepository } from "@/server/admin/repository";
import { topicCreateSchema } from "@/server/admin/schemas";

const actor = { id: "00000000-0000-4000-8000-000000000001", role: "admin" as const };
describe("topic admin", () => {
  it("validates multilingual and exclusion keywords and soft-disables topics", async () => { const repo = new MemoryAdminRepository(); const input = topicCreateSchema.parse({ slug: "rag", nameZhHant: "RAG 入門", keywords: [{ keyword: "檢索增強生成", keywordType: "tw_term" }, { keyword: "检索增强生成", keywordType: "cn_term" }, { keyword: "RAG tutorial", keywordType: "english" }, { keyword: "新聞", keywordType: "negative" }] }); const topic = await repo.createTopic({ ...input, keywords: input.keywords.map(k => ({ ...k, id: crypto.randomUUID() })) }, actor); expect(topic.keywords).toHaveLength(4); expect((await repo.disableTopic(topic.id, actor))?.isActive).toBe(false); expect(await repo.listAuditLogs()).toHaveLength(2); });
  it("rejects duplicate slugs", async () => { const repo = new MemoryAdminRepository(); const input = { slug: "ai", nameZhHant: "AI", description: null, parentTopicId: null, isActive: true, sortOrder: 0, keywords: [] }; await repo.createTopic(input, actor); await expect(repo.createTopic(input, actor)).rejects.toThrow("TOPIC_SLUG_EXISTS"); });
  it("gives every newly created topic a default search settings row, so it shows up in 系統設定 and is eligible for scheduled search", async () => {
    const repo = new MemoryAdminRepository();
    const input = { slug: "rag", nameZhHant: "RAG 入門", description: null, parentTopicId: null, isActive: true, sortOrder: 0, keywords: [] };
    const topic = await repo.createTopic(input, actor);
    const settings = await repo.getSettings(topic.id);
    expect(settings).toHaveLength(1);
    expect(settings[0]).toMatchObject({ topicId: topic.id, freshnessDays: 90, candidateLimit: 50, topN: 20, scheduleCron: "0 21 * * *" });
  });
});
