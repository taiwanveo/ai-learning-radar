import type { ContentDetail, LearningPath } from "./types";
import { learningPathResponseSchema } from "./types";

export function buildLearningPath(query: string, results: ContentDetail[]): LearningPath {
  const ordered = [...results].sort((a, b) => {
    if (a.difficulty !== b.difficulty) return a.difficulty === "beginner" ? -1 : 1;
    return Date.parse(a.publishedAt ?? "0") - Date.parse(b.publishedAt ?? "0");
  });
  const selected = ordered.slice(0, 7);
  const recommended = selected.map((item, index) => ({
    content_item_id: item.id,
    rank: index + 1,
    reason: index === 0
      ? `先用「${item.title}」建立 ${query} 的共同語彙與基本觀念。`
      : item.difficulty === "beginner"
        ? `延伸前一階段，以入門案例補齊 ${item.tags.slice(0, 2).join("、")}。`
        : `在具備基礎後，透過這支影片的實作與取捨深化理解。`,
    learning_role: index === 0 ? "建立基本觀念" : item.difficulty === "beginner" ? "鞏固核心概念" : "進階實作與整合",
  }));

  return learningPathResponseSchema.parse({
    guidance: `建議先建立「${query}」的基本概念，再依序進入實作與系統取捨。每看完一支影片，先用自己的話整理重點並完成測驗，再前往下一階段。`,
    recommended_order: recommended,
    watch_later: ordered.slice(7).map((item) => ({ content_item_id: item.id, reason: "內容較進階，可在完成前面基礎與實作內容後再看。" })),
    next_steps: ["完成推薦影片的匿名測驗，找出仍不熟悉的概念", `用一個小型案例實作 ${query}，並記錄可驗證的結果`],
  });
}
