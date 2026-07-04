import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChannelCreateForm, ManualContentForm, SettingsEditor, TopicCreateForm, TopicKeywordsEditor, TriggerRunButton } from "@/components/admin/admin-controls";
import type { SearchSettings, Topic } from "@/server/admin/types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const topicFixture: Topic = { id: "30000000-0000-4000-8000-000000000001", slug: "rag", nameZhHant: "RAG", description: null, parentTopicId: null, isActive: true, sortOrder: 0, keywords: [{ id: "30000000-0000-4000-8000-000000000002", keyword: "檢索增強生成", keywordType: "tw_term", weight: 1, isActive: true }] };

const settingsFixture: SearchSettings = { topicId: "30000000-0000-4000-8000-000000000001", freshnessDays: 30, candidateLimit: 100, topN: 20, minDurationSeconds: 180, maxDurationSeconds: 3600, excludeShorts: true, minViewCount: 0, minEngagementScore: 0.01, growthGuardrailEnabled: false, minViewsPerDay: 0, autoPublish: true, youtubeRegionCode: "TW", relevanceLanguage: "zh-Hant", searchOrder: "relevance", scheduleCron: "0 6 * * *" };

describe("admin write controls", () => {
  beforeEach(() => vi.clearAllMocks());
  it("does not render mutation controls for viewer", () => { expect(renderToStaticMarkup(<TopicCreateForm canWrite={false}/>)).toBe(""); expect(renderToStaticMarkup(<TriggerRunButton canWrite={false}/>)).toBe(""); });
  it("renders the required operational forms for writable roles", () => { expect(renderToStaticMarkup(<TopicCreateForm canWrite/>)).toContain("新增主題"); expect(renderToStaticMarkup(<ChannelCreateForm canWrite/>)).toContain("新增頻道規則"); expect(renderToStaticMarkup(<ManualContentForm canWrite topics={[topicFixture]}/>)).toContain("手動新增 YouTube"); expect(renderToStaticMarkup(<TriggerRunButton canWrite/>)).toContain("手動觸發 Run"); });
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
  it("lets admins pick a topic for manual content from a dropdown instead of pasting a UUID", () => {
    const withTopics = renderToStaticMarkup(<ManualContentForm canWrite topics={[topicFixture]}/>);
    expect(withTopics).toContain('name="topicId"');
    expect(withTopics).toContain("未分類");
    expect(withTopics).toContain("RAG（rag）");
    expect(withTopics).not.toContain("UUID");
    const noTopics = renderToStaticMarkup(<ManualContentForm canWrite topics={[]}/>);
    expect(noTopics).toContain("未分類");
  });
  it("explains jargon fields with ⓘ tooltips", () => {
    const topicForm = renderToStaticMarkup(<TopicCreateForm canWrite/>);
    expect(topicForm).toContain("主題的英文識別代碼");
    const channelForm = renderToStaticMarkup(<ChannelCreateForm canWrite/>);
    expect(channelForm).toContain("YouTube 頻道的原始識別碼");
    expect(channelForm).toContain("影響此頻道在排名時的加減分");
    const contentForm = renderToStaticMarkup(<ManualContentForm canWrite topics={[topicFixture]}/>);
    expect(contentForm).toContain("RAG（rag）");
    const settingsForm = renderToStaticMarkup(<SettingsEditor settings={[settingsFixture]} canWrite/>);
    expect(settingsForm).toContain("越新鮮的內容在排名中會得到越高的加分");
    expect(settingsForm).toContain("不可超過候選上限");
    expect(settingsForm).toContain("需要管理者在「內容管理」頁手動按下「發布」");
  });
  it("shows the topic's human-readable name in the settings editor heading instead of a raw UUID", () => {
    const withoutLabels = renderToStaticMarkup(<SettingsEditor settings={[settingsFixture]} canWrite/>);
    expect(withoutLabels).toContain(`編輯 ${settingsFixture.topicId}`);
    const withLabels = renderToStaticMarkup(<SettingsEditor settings={[settingsFixture]} canWrite topicLabels={{ [settingsFixture.topicId]: "RAG（rag）" }}/>);
    expect(withLabels).toContain("編輯 RAG（rag）");
    expect(withLabels).not.toContain(settingsFixture.topicId);
  });
});
