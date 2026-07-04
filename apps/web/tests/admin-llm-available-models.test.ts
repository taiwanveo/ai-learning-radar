import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as login } from "@/app/api/admin/auth/login/route";
import { GET as availableModels } from "@/app/api/admin/llm/available-models/route";
import { configureAuthRepository, hashPassword, MemoryAuthRepository } from "@/server/auth";
import { resetAuthRepositoryForTests } from "@/server/auth/repository";
import { configureLlmRepository, encryptSecret, MemoryLlmRepository } from "@/server/crypto";
import { resetLlmRepositoryForTests } from "@/server/crypto/llm-repository";

const originalSessionSecret = process.env.ADMIN_SESSION_SECRET;
const originalFetch = global.fetch;

async function loginAsOwner() {
  const admin = {
    id: "00000000-0000-4000-8000-000000000001",
    email: "owner@example.com",
    name: "Owner",
    passwordHash: await hashPassword("correct horse battery staple"),
    role: "owner" as const,
    isActive: true,
  };
  configureAuthRepository(new MemoryAuthRepository([admin]));
  const response = await login(new Request("http://localhost/api/admin/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: admin.email, password: "correct horse battery staple" }),
  }));
  const cookie = response.headers.get("set-cookie")?.split(";", 1)[0];
  return cookie!;
}

function requestWithCookie(cookie: string) {
  return new Request("http://localhost/api/admin/llm/available-models", { headers: { cookie } });
}

describe("GET /api/admin/llm/available-models", () => {
  beforeEach(() => {
    process.env.APP_SECRET_KEY = Buffer.alloc(32, 7).toString("base64");
    process.env.ADMIN_SESSION_SECRET = "e2e-session-secret-that-is-at-least-32-characters";
    resetAuthRepositoryForTests();
    resetLlmRepositoryForTests();
    configureLlmRepository(new MemoryLlmRepository());
  });

  afterEach(() => {
    resetAuthRepositoryForTests();
    resetLlmRepositoryForTests();
    if (originalSessionSecret === undefined) delete process.env.ADMIN_SESSION_SECRET;
    else process.env.ADMIN_SESSION_SECRET = originalSessionSecret;
    global.fetch = originalFetch;
  });

  it("groups live models by provider, sorted, deduped across keys", async () => {
    const openaiKey = encryptSecret("sk-openai-key");
    const anotherOpenaiKey = encryptSecret("sk-openai-key-2");
    const geminiKey = encryptSecret("sk-gemini-key");
    const { getLlmRepository } = await import("@/server/crypto");
    const repository = getLlmRepository();
    const base = { isActive: true, lastValidatedAt: null, validationStatus: null, validationError: null, createdByAdminId: "owner" };
    await repository.createKey({ ...base, provider: "openai", displayName: "Key A", encryptedKey: openaiKey.encryptedValue, encryptionIv: openaiKey.iv, encryptionTag: openaiKey.authTag, maskedKey: "••••1" });
    await repository.createKey({ ...base, provider: "openai", displayName: "Key B", encryptedKey: anotherOpenaiKey.encryptedValue, encryptionIv: anotherOpenaiKey.iv, encryptionTag: anotherOpenaiKey.authTag, maskedKey: "••••2" });
    await repository.createKey({ ...base, provider: "gemini", displayName: "Key C", encryptedKey: geminiKey.encryptedValue, encryptionIv: geminiKey.iv, encryptionTag: geminiKey.authTag, maskedKey: "••••3" });

    global.fetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("openai.com") && url.includes("sk-openai-key-2")) return Response.json({ data: [] });
      if (url.includes("openai.com")) return Response.json({ data: [{ id: "gpt-4.1-mini" }, { id: "gpt-4o" }] });
      if (url.includes("generativelanguage")) return Response.json({ models: [{ name: "models/gemini-2.5-flash" }] });
      return Response.json({ data: [] });
    }) as unknown as typeof fetch;

    const cookie = await loginAsOwner();
    const response = await availableModels(requestWithCookie(cookie));
    expect(response.status).toBe(200);
    const body = await response.json() as { groups: { provider: string; label: string; models: string[] }[] };
    expect(body.groups.map((g) => g.label)).toEqual(["Gemini", "OpenAI"]);
    const openaiGroup = body.groups.find((g) => g.provider === "openai");
    expect(openaiGroup?.models).toEqual(["gpt-4.1-mini", "gpt-4o"]);
    const geminiGroup = body.groups.find((g) => g.provider === "gemini");
    expect(geminiGroup?.models).toEqual(["gemini-2.5-flash"]);
  });

  it("excludes providers whose only key fails validation, without failing the whole request", async () => {
    const badKey = encryptSecret("sk-bad-key");
    const { getLlmRepository } = await import("@/server/crypto");
    const repository = getLlmRepository();
    await repository.createKey({ isActive: true, lastValidatedAt: null, validationStatus: null, validationError: null, createdByAdminId: "owner", provider: "anthropic", displayName: "Broken", encryptedKey: badKey.encryptedValue, encryptionIv: badKey.iv, encryptionTag: badKey.authTag, maskedKey: "••••9" });
    global.fetch = vi.fn(async () => new Response("unauthorized", { status: 401 })) as unknown as typeof fetch;

    const cookie = await loginAsOwner();
    const response = await availableModels(requestWithCookie(cookie));
    expect(response.status).toBe(200);
    const body = await response.json() as { groups: unknown[] };
    expect(body.groups).toEqual([]);
  });

  it("requires an owner session", async () => {
    const response = await availableModels(new Request("http://localhost/api/admin/llm/available-models"));
    expect(response.status).toBe(401);
  });
});
