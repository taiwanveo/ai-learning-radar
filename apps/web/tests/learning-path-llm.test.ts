import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { demoContent } from "@/server/public/demo-content";
import { generateLearningPath } from "@/server/public/learning-path";
import { configureLlmRepository, encryptSecret, MemoryLlmRepository } from "@/server/crypto";
import { getLlmRepository, resetLlmRepositoryForTests } from "@/server/crypto/llm-repository";

const originalFetch = global.fetch;
const candidates = demoContent.slice(0, 4);

function llmPayload(content: string) {
  return { ok: true, json: async () => ({ choices: [{ message: { content } }] }) } as Response;
}

async function installChainWithKey() {
  const repository = getLlmRepository();
  const sealed = encryptSecret("sk-live-openai");
  await repository.createKey({
    provider: "openai", displayName: "主要金鑰", encryptedKey: sealed.encryptedValue,
    encryptionIv: sealed.iv, encryptionTag: sealed.authTag, maskedKey: "sk-••••••••ai",
    isActive: true, lastValidatedAt: null, validationStatus: "valid", validationError: null, createdByAdminId: "owner",
  });
  await repository.replaceFallbackChain("learning_path", [
    { taskType: "learning_path", provider: "openai", modelId: "gpt-test", priority: 1, isActive: true },
  ]);
}

describe("generateLearningPath (BYOK)", () => {
  beforeEach(() => {
    process.env.APP_SECRET_KEY = Buffer.alloc(32, 7).toString("base64");
    resetLlmRepositoryForTests();
    configureLlmRepository(new MemoryLlmRepository());
  });
  afterEach(() => {
    resetLlmRepositoryForTests();
    global.fetch = originalFetch;
  });

  it("uses the learning_path fallback chain when configured", async () => {
    await installChainWithKey();
    const validPath = {
      guidance: "先建立基礎再進入實作。",
      recommended_order: candidates.slice(0, 3).map((item, index) => ({
        content_item_id: item.id, rank: index + 1, reason: "循序漸進", learning_role: "基礎",
      })),
      watch_later: [{ content_item_id: candidates[3].id, reason: "較進階" }],
      next_steps: ["完成一個小專案"],
    };
    global.fetch = (async () => llmPayload(JSON.stringify(validPath))) as typeof fetch;

    const result = await generateLearningPath("RAG", "all", candidates);
    expect(result.source).toBe("llm");
    expect(result.path.recommended_order).toHaveLength(3);
  });

  it("falls back to rules when the LLM returns ids outside the candidate list", async () => {
    await installChainWithKey();
    const invalidPath = {
      guidance: "亂編的",
      recommended_order: [1, 2, 3].map((rank) => ({
        content_item_id: "99999999-0000-4000-8000-000000000009", rank, reason: "x", learning_role: "y",
      })),
      watch_later: [],
      next_steps: ["z"],
    };
    global.fetch = (async () => llmPayload(JSON.stringify(invalidPath))) as typeof fetch;

    const result = await generateLearningPath("RAG", "all", candidates);
    expect(result.source).toBe("rules");
    expect(result.path.recommended_order.length).toBeGreaterThanOrEqual(3);
  });

  it("falls back to rules when no chain or key is configured", async () => {
    const result = await generateLearningPath("RAG", "all", candidates);
    expect(result.source).toBe("rules");
  });
});
