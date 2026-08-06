import { beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/public/digest/route";
import { publicDigestResponseSchema } from "@/lib/schemas";

describe("public digest API", () => {
  beforeEach(() => { delete process.env.DATABASE_URL; });

  it("returns schema-valid filtered and sorted JSON", async () => {
    const response = await GET(new Request("http://localhost/api/public/digest?difficulty=beginner&sort=views&language=zh-Hant"));
    expect(response.status).toBe(200);
    expect(response.headers.get("X-Data-Source")).toBe("demo");
    const body = publicDigestResponseSchema.parse(await response.json());
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.items.every((item) => item.difficulty === "beginner")).toBe(true);
    expect(body.items[0].viewCount).toBeGreaterThanOrEqual(body.items.at(-1)?.viewCount ?? 0);
    expect(JSON.stringify(body)).not.toContain("difficultyReason");
  });

  it("returns an empty collection for an unknown topic", async () => {
    const response = await GET(new Request("http://localhost/api/public/digest?topic=does-not-exist"));
    const body = publicDigestResponseSchema.parse(await response.json());
    expect(body.items).toEqual([]);
  });

  it("supports the documented published, content type, level, and beginner sort aliases", async () => {
    const response = await GET(new Request("http://localhost/api/public/digest?published=7d&content_type=video&level=beginner&sort=beginner&date=2026-07-05"));
    expect(response.status).toBe(200);
    const body = publicDigestResponseSchema.parse(await response.json());
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.items.every((item) => item.sourceType === "youtube" && item.difficulty === "beginner")).toBe(true);
  });

  it("rejects invalid filters", async () => {
    const response = await GET(new Request("http://localhost/api/public/digest?sort=invalid"));
    expect(response.status).toBe(400);
  });
});
