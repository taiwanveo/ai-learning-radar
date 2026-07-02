import { describe, expect, it } from "vitest";
import { menuForRole } from "@/components/admin/admin-nav";

describe("admin role menu", () => {
  it("shows all sections to owner", () => { expect(menuForRole("owner").map(i => i.label)).toEqual(["Dashboard", "Content", "Topics", "Channels", "Settings", "LLM", "Admins", "Runs"]); });
  it("does not expose privileged settings to viewer", () => { expect(menuForRole("viewer").map(i => i.label)).toEqual(["Dashboard", "Content", "Topics", "Channels", "Runs"]); });
});
