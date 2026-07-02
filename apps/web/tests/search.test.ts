import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/public/learning-path/route";
import { demoContent } from "@/server/public/demo-content";
import { learningPathResponseSchema } from "@/server/public/types";

describe("search learning path", () => {
  beforeEach(() => { delete process.env.DATABASE_URL; });

  it("only recommends IDs supplied from matching search results", async () => {
    const allowed = demoContent.slice(0, 3).map(({ id }) => id);
    const response = await POST(new Request("http://localhost/api/public/learning-path", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "AI", difficulty: "all", contentItemIds: allowed }),
    }));
    expect(response.status).toBe(200);
    const path = learningPathResponseSchema.parse(await response.json());
    expect(path.recommended_order).toHaveLength(3);
    expect(path.recommended_order.every((item) => allowed.includes(item.content_item_id))).toBe(true);
  });

  it("does not generate a path with fewer than three valid results", async () => {
    const response = await POST(new Request("http://localhost/api/public/learning-path", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "RAG", difficulty: "all", contentItemIds: demoContent.slice(0, 3).map(({ id }) => id) }),
    }));
    expect(response.status).toBe(422);
  });
});
