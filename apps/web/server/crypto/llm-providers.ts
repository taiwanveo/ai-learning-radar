import type { LlmProvider } from "./llm-repository";

type Fetch = typeof fetch;

interface ProviderRequest {
  url: string;
  init: RequestInit;
  extract(payload: unknown): string[];
}

function providerRequest(provider: LlmProvider, apiKey: string): ProviderRequest {
  if (provider === "openai") return {
    url: "https://api.openai.com/v1/models",
    init: { headers: { authorization: `Bearer ${apiKey}` } },
    extract: (payload) => arrayModels(payload, "data"),
  };
  if (provider === "anthropic") return {
    url: "https://api.anthropic.com/v1/models",
    init: { headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" } },
    extract: (payload) => arrayModels(payload, "data"),
  };
  if (provider === "openrouter") return {
    url: "https://openrouter.ai/api/v1/models",
    init: { headers: { authorization: `Bearer ${apiKey}` } },
    extract: (payload) => arrayModels(payload, "data"),
  };
  return {
    url: "https://generativelanguage.googleapis.com/v1beta/models",
    init: { headers: { "x-goog-api-key": apiKey } },
    extract: (payload) => arrayModels(payload, "models").map((id) => id.replace(/^models\//, "")),
  };
}

function arrayModels(payload: unknown, field: string): string[] {
  if (!payload || typeof payload !== "object") return [];
  const rows = (payload as Record<string, unknown>)[field];
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const id = (row as { id?: unknown; name?: unknown }).id ?? (row as { name?: unknown }).name;
    return typeof id === "string" ? [id] : [];
  });
}

export async function listProviderModels(provider: LlmProvider, apiKey: string, fetcher: Fetch = fetch): Promise<string[]> {
  const request = providerRequest(provider, apiKey);
  const response = await fetcher(request.url, { ...request.init, signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`Provider rejected the credential (HTTP ${response.status})`);
  const models = request.extract(await response.json());
  if (models.length === 0) throw new Error("Provider returned no compatible models");
  return [...new Set(models)].sort();
}
