import { z } from "zod";
import { authErrorResponse, requireAdmin, writeAuditLog } from "@/server/auth";
import { getLlmRepository } from "@/server/crypto";

const idSchema = z.string().uuid();

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin(["owner"], request);
    const parsed = idSchema.safeParse((await params).id);
    if (!parsed.success) return Response.json({ error: "Invalid key id" }, { status: 400 });
    const repository = getLlmRepository();
    const key = await repository.findKey(parsed.data);
    if (!key || !key.isActive) return Response.json({ error: "Credential not found" }, { status: 404 });
    await repository.deactivateKey(parsed.data);
    await writeAuditLog({
      adminId: admin.id,
      action: "llm.key.deactivated",
      entityType: "llm_api_key",
      entityId: key.id,
      after: { provider: key.provider, displayName: key.displayName, maskedKey: key.maskedKey, isActive: false },
    });
    return Response.json({ ok: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}
