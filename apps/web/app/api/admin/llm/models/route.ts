import { z } from "zod";
import { authErrorResponse, requireAdmin } from "@/server/auth";
import { listProviderModels, loadDecryptedLlmKey } from "@/server/crypto";

const schema = z.object({ keyId: z.string().uuid() });

export async function POST(request: Request) {
  try {
    await requireAdmin(["owner"], request);
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: "Invalid key id" }, { status: 400 });
    const key = await loadDecryptedLlmKey(parsed.data.keyId);
    if (!key) return Response.json({ error: "Credential not found" }, { status: 404 });
    const models = await listProviderModels(key.record.provider, key.value);
    return Response.json({ provider: key.record.provider, models });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Provider")) {
      return Response.json({ error: error.message }, { status: 422 });
    }
    return authErrorResponse(error);
  }
}
