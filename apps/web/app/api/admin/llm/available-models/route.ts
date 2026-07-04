import { authErrorResponse, requireAdmin } from "@/server/auth";
import { decryptSecret, getLlmRepository, listProviderModels, type LlmProvider } from "@/server/crypto";

const PROVIDER_LABELS: Record<LlmProvider, string> = { openai: "OpenAI", gemini: "Gemini", anthropic: "Anthropic", openrouter: "OpenRouter" };

export async function GET(request: Request) {
  try {
    await requireAdmin(["owner"], request);
    const keys = (await getLlmRepository().listKeys()).filter((key) => key.isActive);
    const results = await Promise.allSettled(keys.map(async (key) => {
      const apiKey = decryptSecret({ encryptedValue: key.encryptedKey, iv: key.encryptionIv, authTag: key.encryptionTag });
      const models = await listProviderModels(key.provider, apiKey);
      return { provider: key.provider, models };
    }));

    const byProvider = new Map<LlmProvider, Set<string>>();
    for (const result of results) {
      if (result.status !== "fulfilled") continue;
      const set = byProvider.get(result.value.provider) ?? new Set<string>();
      for (const model of result.value.models) set.add(model);
      byProvider.set(result.value.provider, set);
    }

    const groups = [...byProvider.entries()]
      .map(([provider, models]) => ({ provider, label: PROVIDER_LABELS[provider] ?? provider, models: [...models].sort((a, b) => a.localeCompare(b)) }))
      .sort((a, b) => a.label.localeCompare(b.label));

    return Response.json({ groups });
  } catch (error) {
    return authErrorResponse(error);
  }
}
