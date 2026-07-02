import { z } from "zod";
import { authErrorResponse, requireAdmin, writeAuditLog } from "@/server/auth";
import { getLlmRepository, listProviderModels, loadDecryptedLlmKey } from "@/server/crypto";

const schema = z.object({ keyId: z.string().uuid() });

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin(["owner"], request);
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: "Invalid key id" }, { status: 400 });
    const key = await loadDecryptedLlmKey(parsed.data.keyId);
    if (!key) return Response.json({ error: "Credential not found" }, { status: 404 });
    const now = new Date();
    try {
      const models = await listProviderModels(key.record.provider, key.value);
      await getLlmRepository().updateValidation(key.record.id, {
        lastValidatedAt: now,
        validationStatus: "valid",
        validationError: null,
      });
      await writeAuditLog({
        adminId: admin.id,
        action: "llm.key.validated",
        entityType: "llm_api_key",
        entityId: key.record.id,
        after: { status: "valid", provider: key.record.provider },
      });
      return Response.json({ valid: true, models, validatedAt: now.toISOString() });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Credential validation failed";
      await getLlmRepository().updateValidation(key.record.id, {
        lastValidatedAt: now,
        validationStatus: "invalid",
        validationError: message,
      });
      await writeAuditLog({
        adminId: admin.id,
        action: "llm.key.validation_failed",
        entityType: "llm_api_key",
        entityId: key.record.id,
        after: { status: "invalid", provider: key.record.provider },
      });
      return Response.json({ valid: false, error: message, validatedAt: now.toISOString() }, { status: 422 });
    }
  } catch (error) {
    return authErrorResponse(error);
  }
}
