import { describe, expect, it } from "vitest";
import { DEFAULT_LOCALE, PRODUCT_NAME } from "../src/constants.js";

describe("shared constants", () => {
  it("exposes the documented defaults", () => {
    expect(PRODUCT_NAME).toBe("AI Learning Radar");
    expect(DEFAULT_LOCALE).toBe("zh-Hant");
  });
});
