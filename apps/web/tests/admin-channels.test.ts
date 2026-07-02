import { describe, expect, it } from "vitest";
import { MemoryAdminRepository } from "@/server/admin/repository";
import { channelSchema } from "@/server/admin/schemas";
const actor = { id: "00000000-0000-4000-8000-000000000001", role: "editor" as const };
describe("channel admin", () => { it("requires a reason and keeps one list type per channel", async () => { expect(() => channelSchema.parse({ sourceChannelId: "UC1", title: "Channel", listType: "recommended" })).toThrow(); const repo = new MemoryAdminRepository(); await repo.upsertChannel({ sourceChannelId: "UC1", handle: "@channel", title: "Channel", listType: "recommended", trustWeight: 1, recommendationReason: "高品質教學" }, actor); await repo.upsertChannel({ sourceChannelId: "UC1", handle: "@channel", title: "Channel", listType: "blacklisted", trustWeight: -1, recommendationReason: null }, actor); const channels = await repo.listChannels(); expect(channels).toHaveLength(1); expect(channels[0].listType).toBe("blacklisted"); }); });
