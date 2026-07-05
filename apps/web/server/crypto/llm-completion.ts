import type { LlmProvider } from "./llm-repository";

type Fetch = typeof fetch;

const TIMEOUT_MS = 25_000;

function pick(payload: unknown, path: (string | number)[]): unknown {
  return path.reduce<unknown>((node, key) => (node && typeof node === "object" ? (node as Record<string | number, unknown>)[key] : undefined), payload);
}

interface CompletionRequest {
  url: string;
  init: RequestInit;
  extract(payload: unknown): string;
}

function completionRequest(provider: LlmProvider, apiKey: string, model: string, prompt: string): CompletionRequest {
  const asText = (value: unknown): string => {
    if (typeof value !== "string" || !value.trim()) throw new Error("provider returned no text");
    return value;
  };
  if (provider === "anthropic") return {
    url: "https://api.anthropic.com/v1/messages",
    init: {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model, max_tokens: 2048, temperature: 0, messages: [{ role: "user", content: prompt }] }),
    },
    extract: (payload) => asText(pick(payload, ["content", 0, "text"])),
  };
  if (provider === "gemini") return {
    url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    init: {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "content-type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0, responseMimeType: "application/json" } }),
    },
    extract: (payload) => asText(pick(payload, ["candidates", 0, "content", "parts", 0, "text"])),
  };
  const base = provider === "openrouter" ? "https://openrouter.ai/api/v1" : "https://api.openai.com/v1";
  return {
    url: `${base}/chat/completions`,
    init: {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ model, temperature: 0, response_format: { type: "json_object" }, messages: [{ role: "user", content: prompt }] }),
    },
    extract: (payload) => asText(pick(payload, ["choices", 0, "message", "content"])),
  };
}

/** One JSON-mode completion against a BYOK provider; throws on any failure. */
export async function generateJsonCompletion(provider: LlmProvider, apiKey: string, model: string, prompt: string, fetcher: Fetch = fetch): Promise<string> {
  const request = completionRequest(provider, apiKey, model, prompt);
  const response = await fetcher(request.url, { ...request.init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!response.ok) throw new Error(`provider rejected the completion (HTTP ${response.status})`);
  return request.extract(await response.json());
}

/** Tolerates markdown fences and surrounding prose around a JSON object. */
export function extractJsonObject(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("no JSON object in completion");
  return JSON.parse(trimmed.slice(start, end + 1));
}
