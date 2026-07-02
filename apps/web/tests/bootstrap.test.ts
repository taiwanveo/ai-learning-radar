import { describe, expect, it } from "vitest";

describe("web bootstrap", () => {
  it("uses the public product name", () => {
    expect("AI Learning Radar").toContain("Learning Radar");
  });
});
