import { describe, expect, it } from "vitest";
import { MemoryAdminRepository } from "@/server/admin/repository";
import { manualYoutubeSchema } from "@/server/admin/schemas";
const actor = { id: "00000000-0000-4000-8000-000000000001", role: "admin" as const };
describe("content admin", () => { it("normalizes YouTube URLs and soft deletes", async () => { const parsed = manualYoutubeSchema.parse({ url: "https://youtu.be/abcDEF12345", publishImmediately: true, title: "RAG 教學" }); const repo = new MemoryAdminRepository(); const item = await repo.createContent({ sourceContentId: parsed.sourceContentId, sourceUrl: parsed.sourceUrl, title: parsed.title, channelTitle: null, shortSummary: "", difficulty: "normal", tags: [], status: "published", hiddenReason: null, isPinned: false, topicId: null }, actor); await repo.deleteContent(item.id, actor); expect(await repo.listContent()).toEqual([]); expect((await repo.listAuditLogs()).map(log => log.action)).toEqual(["update", "create"]); }); });
