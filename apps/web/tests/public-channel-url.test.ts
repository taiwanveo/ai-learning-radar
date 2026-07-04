import { describe, expect, it } from "vitest";
import { channelUrl } from "@/server/public/repository";

describe("channelUrl", () => {
  it("prefers the channel handle, normalizing a missing leading @", () => {
    expect(channelUrl({ handle: "@ai-notes", sourceChannelId: "UCxxxx" })).toBe("https://www.youtube.com/@ai-notes");
    expect(channelUrl({ handle: "ai-notes", sourceChannelId: "UCxxxx" })).toBe("https://www.youtube.com/@ai-notes");
  });
  it("falls back to the channel id when there is no handle", () => {
    expect(channelUrl({ handle: null, sourceChannelId: "UCxxxx" })).toBe("https://www.youtube.com/channel/UCxxxx");
  });
  it("returns null when there is no linked channel at all", () => {
    expect(channelUrl(null)).toBeNull();
    expect(channelUrl(undefined)).toBeNull();
  });
});
