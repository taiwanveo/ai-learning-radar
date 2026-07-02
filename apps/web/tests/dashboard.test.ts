import { describe, expect, it } from "vitest";
import { demoContent } from "@/server/public/demo-content";
import { getDigest } from "@/server/public/repository";

describe("dashboard data", () => {
  it("provides complete public card fields and safe fallbacks", async () => {
    delete process.env.DATABASE_URL;
    const result = await getDigest({ topic: "artificial-intelligence", sort: "recommended", difficulty: "all", recommended: "all", published: "all", contentType: "all", limit: 20 });
    expect(result.data.items).toHaveLength(demoContent.length);
    for (const item of result.data.items) {
      expect(item.shortSummary.length).toBeGreaterThan(0);
      expect(item.suitableFor.length).toBeGreaterThan(0);
      expect(item.learningObjectives.length).toBeGreaterThan(0);
      expect(item.sourceUrl).toMatch(/^https:/);
    }
  });
});
