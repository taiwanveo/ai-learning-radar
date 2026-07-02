import { z } from "zod";
import { authErrorResponse, requireAdmin, writeAuditLog } from "@/server/auth";
import {
  encryptSecret,
  getLlmRepository,
  listProviderModels,
  LLM_PROVIDERS,
  maskSecret,
  publicLlmKey,
} from "@/server/crypto";

const createKeySchema = z.object({
  provider: z.enum(LLM_PROVIDERS),
  displayName: z.string().trim().min(1).max(100),
  apiKey: z.string().trim().min(8).max(2_000),
});

export async function GET(request: Request) {
  try {
    await requireAdmin(["owner"], request);
    const repository = getLlmRepository();
    const [keys, fallbackChains] = await Promise.all([repository.listKeys(), repository.listFallbackChains()]);
    return Response.json({ keys: keys.map(publicLlmKey), fallbackChains });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin(["owner"], request);
    const parsed = createKeySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: "Invalid provider credential input" }, { status: 400 });

    let models: string[];
    try {
      models = await listProviderModels(parsed.data.provider, parsed.data.apiKey);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Credential validation failed";
      return Response.json({ error: message }, { status: 422 });
    }

    const encrypted = encryptSecret(parsed.data.apiKey);
    const repository = getLlmRepository();
    const key = await repository.createKey({
      provider: parsed.data.provider,
      displayName: parsed.data.displayName,
      encryptedKey: encrypted.encryptedValue,
      encryptionIv: encrypted.iv,
      encryptionTag: encrypted.authTag,
      maskedKey: maskSecret(parsed.data.apiKey),
      isActive: true,
      lastValidatedAt: new Date(),
      validationStatus: "valid",
      validationError: null,
      createdByAdminId: admin.id,
    });
    await writeAuditLog({
      adminId: admin.id,
      action: "llm.key.created",
      entityType: "llm_api_key",
      entityId: key.id,
      after: { provider: key.provider, displayName: key.displayName, maskedKey: key.maskedKey },
    });
    return Response.json({ key: publicLlmKey(key), models }, { status: 201 });
  } catch (error) {
    return authErrorResponse(error);
  }
}
