import { beforeEach, describe, expect, it } from "vitest";
import { enforceManualRunRateLimit, resetManualRunRateLimit } from "@/server/admin/http";
describe("manual run rate limiting", () => { beforeEach(resetManualRunRateLimit); it("allows one run per minute per admin", () => { expect(enforceManualRunRateLimit("admin", 100_000)).toBe(true); expect(enforceManualRunRateLimit("admin", 120_000)).toBe(false); expect(enforceManualRunRateLimit("admin", 160_000)).toBe(true); expect(enforceManualRunRateLimit("other", 120_000)).toBe(true); }); });
