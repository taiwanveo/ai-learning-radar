import { describe, expect, it } from "vitest";
import { menuForRole } from "@/components/admin/admin-nav";

describe("admin role menu", () => {
  it("shows all sections to owner", () => { expect(menuForRole("owner").map(i => i.label)).toEqual(["儀表板", "內容管理", "主題管理", "頻道管理", "系統設定", "LLM 設定", "管理員", "執行紀錄"]); });
  it("does not expose privileged settings to viewer", () => { expect(menuForRole("viewer").map(i => i.label)).toEqual(["儀表板", "內容管理", "主題管理", "頻道管理", "執行紀錄"]); });
});
