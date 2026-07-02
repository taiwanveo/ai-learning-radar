import { beforeEach, describe, expect, it } from "vitest";
import { redactSensitive } from "@/server/auth";
import { decryptSecret, encryptSecret, listProviderModels, maskSecret } from "@/server/crypto";

describe("admin LLM key management", () => {
  beforeEach(() => {
    process.env.APP_SECRET_KEY = Buffer.alloc(32, 7).toString("base64");
  });

  it("encrypts credentials with authenticated random AES-GCM envelopes", () => {
    const first = encryptSecret("sk-super-secret-1234");
    const second = encryptSecret("sk-super-secret-1234");
    expect(first.encryptedValue).not.toBe("sk-super-secret-1234");
    expect(first.iv).not.toBe(second.iv);
    expect(decryptSecret(first)).toBe("sk-super-secret-1234");
    expect(() => decryptSecret({ ...first, authTag: Buffer.alloc(16).toString("base64") })).toThrow();
    expect(maskSecret("sk-super-secret-1234")).toMatch(/•{8}1234$/);
  });

  it("lists provider models without returning or logging the credential", async () => {
    const calls: Array<[string, RequestInit | undefined]> = [];
    const fakeFetch = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push([String(url), init]);
      return Response.json({ data: [{ id: "model-b" }, { id: "model-a" }] });
    }) as typeof fetch;
    await expect(listProviderModels("openai", "sk-private", fakeFetch)).resolves.toEqual(["model-a", "model-b"]);
    expect(calls[0]?.[1]?.headers).toEqual({ authorization: "Bearer sk-private" });
  });

  it("deep-redacts credentials before an audit hook receives metadata", () => {
    expect(redactSensitive({ apiKey: "secret", nested: { passwordHash: "hash", provider: "openai" } })).toEqual({
      apiKey: "[REDACTED]",
      nested: { passwordHash: "[REDACTED]", provider: "openai" },
    });
  });
});
