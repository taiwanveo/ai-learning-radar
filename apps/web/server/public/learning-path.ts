import { decryptSecret } from "@/server/crypto/encryption";
import { extractJsonObject, generateJsonCompletion } from "@/server/crypto/llm-completion";
import { getLlmRepository, type LlmKeyRecord } from "@/server/crypto/llm-repository";
import type { ContentDetail, LearningPath } from "./types";
import { learningPathResponseSchema } from "./types";

function learningPathPrompt(query: string, difficulty: string, results: ContentDetail[]): string {
  const candidates = results.slice(0, 25).map((item) => ({
    content_item_id: item.id,
    title: item.title,
    difficulty: item.difficulty,
    tags: item.tags.slice(0, 5),
    short_summary: item.shortSummary.slice(0, 200),
    published_at: item.publishedAt,
  }));
  return [
    "你是一位協助台灣學習者規劃 AI 教學影片觀看順序的導師。請使用繁體中文。",
    `學習者查詢的主題：「${query}」，偏好難度：${difficulty}。`,
    "以下是候選影片（JSON）。你只能使用清單中的 content_item_id，不可以捏造：",
    JSON.stringify(candidates),
    "請只輸出一個 JSON 物件（不要多餘文字或 markdown），格式如下：",
    JSON.stringify({
      guidance: "整體學習建議（一段文字）",
      recommended_order: [{ content_item_id: "候選影片的 id", rank: 1, reason: "為什麼先看這支", learning_role: "在學習路徑中的角色" }],
      watch_later: [{ content_item_id: "候選影片的 id", reason: "為什麼可以晚點看" }],
      next_steps: ["看完後的下一步行動"],
    }),
    "規則：recommended_order 需 3 到 7 筆並依建議順序排列（rank 從 1 開始遞增）；未入選的候選影片放進 watch_later；next_steps 至少 1 筆。",
  ].join("\n\n");
}

function activeKeyByProvider(keys: LlmKeyRecord[]): Map<string, LlmKeyRecord> {
  const byProvider = new Map<string, LlmKeyRecord>();
  for (const key of keys) {
    if (!key.isActive) continue;
    const existing = byProvider.get(key.provider);
    if (!existing || key.updatedAt > existing.updatedAt) byProvider.set(key.provider, key);
  }
  return byProvider;
}

/**
 * Generate the learning path with the admin-configured `learning_path`
 * fallback chain (BYOK). Any missing configuration or provider failure falls
 * back to the deterministic rule-based ordering so the button always works.
 */
export async function generateLearningPath(
  query: string,
  difficulty: string,
  results: ContentDetail[],
): Promise<{ path: LearningPath; source: "llm" | "rules" }> {
  try {
    const repository = getLlmRepository();
    const chain = (await repository.listFallbackChains())
      .filter((setting) => setting.taskType === "learning_path" && setting.isActive)
      .sort((a, b) => a.priority - b.priority);
    if (chain.length) {
      const keyByProvider = activeKeyByProvider(await repository.listKeys());
      const prompt = learningPathPrompt(query, difficulty, results);
      const validIds = new Set(results.map((item) => item.id));
      for (const target of chain) {
        const record = keyByProvider.get(target.provider);
        if (!record) continue;
        try {
          const apiKey = decryptSecret({ encryptedValue: record.encryptedKey, iv: record.encryptionIv, authTag: record.encryptionTag });
          const text = await generateJsonCompletion(target.provider, apiKey, target.modelId, prompt);
          const parsed = learningPathResponseSchema.safeParse(extractJsonObject(text));
          if (!parsed.success) continue;
          const referenced = [...parsed.data.recommended_order, ...parsed.data.watch_later];
          if (referenced.every((item) => validIds.has(item.content_item_id))) {
            return { path: parsed.data, source: "llm" };
          }
        } catch {
          continue;
        }
      }
    }
  } catch {
    // fall through to the rule-based path
  }
  return { path: buildLearningPath(query, results), source: "rules" };
}

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
