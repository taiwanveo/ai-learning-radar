import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChannelCreateForm, ManualContentForm, TopicCreateForm, TopicKeywordsEditor, TriggerRunButton } from "@/components/admin/admin-controls";
import type { Topic } from "@/server/admin/types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const topicFixture: Topic = { id: "30000000-0000-4000-8000-000000000001", slug: "rag", nameZhHant: "RAG", description: null, parentTopicId: null, isActive: true, sortOrder: 0, keywords: [{ id: "30000000-0000-4000-8000-000000000002", keyword: "檢索增強生成", keywordType: "tw_term", weight: 1, isActive: true }] };

describe("admin write controls", () => {
  beforeEach(() => vi.clearAllMocks());
  it("does not render mutation controls for viewer", () => { expect(renderToStaticMarkup(<TopicCreateForm canWrite={false}/>)).toBe(""); expect(renderToStaticMarkup(<TriggerRunButton canWrite={false}/>)).toBe(""); });
  it("renders the required operational forms for writable roles", () => { expect(renderToStaticMarkup(<TopicCreateForm canWrite/>)).toContain("新增主題"); expect(renderToStaticMarkup(<ChannelCreateForm canWrite/>)).toContain("新增頻道規則"); expect(renderToStaticMarkup(<ManualContentForm canWrite/>)).toContain("手動新增 YouTube"); expect(renderToStaticMarkup(<TriggerRunButton canWrite/>)).toContain("手動觸發 Run"); });
  it("lets writable roles add and remove topic keywords, read-only for viewer", () => {
    const writable = renderToStaticMarkup(<TopicKeywordsEditor topic={topicFixture} canWrite/>);
    expect(writable).toContain("檢索增強生成");
    expect(writable).toContain("台灣用語");
    expect(writable).toContain("新關鍵字");
    expect(writable).toContain("移除關鍵字 檢索增強生成");
    const readonly = renderToStaticMarkup(<TopicKeywordsEditor topic={topicFixture} canWrite={false}/>);
    expect(readonly).toContain("檢索增強生成");
    expect(readonly).not.toContain("新關鍵字");
    expect(readonly).not.toContain("移除關鍵字");
  });
});
