import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChannelCreateForm, ManualContentForm, TopicCreateForm, TriggerRunButton } from "@/components/admin/admin-controls";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

describe("admin write controls", () => {
  beforeEach(() => vi.clearAllMocks());
  it("does not render mutation controls for viewer", () => { expect(renderToStaticMarkup(<TopicCreateForm canWrite={false}/>)).toBe(""); expect(renderToStaticMarkup(<TriggerRunButton canWrite={false}/>)).toBe(""); });
  it("renders the required operational forms for writable roles", () => { expect(renderToStaticMarkup(<TopicCreateForm canWrite/>)).toContain("新增主題"); expect(renderToStaticMarkup(<ChannelCreateForm canWrite/>)).toContain("新增頻道規則"); expect(renderToStaticMarkup(<ManualContentForm canWrite/>)).toContain("手動新增 YouTube"); expect(renderToStaticMarkup(<TriggerRunButton canWrite/>)).toContain("手動觸發 Run"); });
});
