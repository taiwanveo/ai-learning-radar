import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { VideoCard } from "@/components/public/video-card";
import type { DigestItem } from "@/server/public/types";

const base: DigestItem = {
  id: "20000000-0000-4000-8000-000000000001",
  sourceType: "youtube",
  sourceUrl: "https://www.youtube.com/watch?v=demo",
  thumbnailUrl: null,
  title: "測試影片標題",
  channelTitle: "測試頻道",
  channelUrl: null,
  publishedAt: "2026-07-01T00:00:00.000Z",
  viewCount: 1000,
  likeCount: 10,
  commentCount: 1,
  engagementScore: 0.05,
  freshEngagementScore: 0.5,
  radarScore: 0.5,
  difficulty: "normal",
  language: "zh-Hant",
  isRecommendedChannel: false,
  isPinned: false,
  tags: [],
  suitableFor: "所有人",
  shortSummary: "摘要",
  learningObjectives: ["目標一"],
  quizCount: 0,
};

describe("VideoCard channel link", () => {
  it("renders the channel name as plain text when there is no channel URL", () => {
    const markup = renderToStaticMarkup(<VideoCard video={base} />);
    expect(markup).toContain("<span>測試頻道</span>");
  });

  it("links the channel name to the channel URL when available", () => {
    const markup = renderToStaticMarkup(<VideoCard video={{ ...base, channelUrl: "https://www.youtube.com/@test-channel" }} />);
    expect(markup).toContain('href="https://www.youtube.com/@test-channel"');
    expect(markup).toContain("測試頻道");
    expect(markup).toContain('target="_blank"');
  });
});
