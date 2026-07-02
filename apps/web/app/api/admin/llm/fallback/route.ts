import { z } from "zod";
import { authErrorResponse, requireAdmin, writeAuditLog } from "@/server/auth";
import { getLlmRepository, LLM_PROVIDERS, LLM_TASKS } from "@/server/crypto";

const schema = z.object({
  taskType: z.enum(LLM_TASKS),
  chain: z.array(z.object({
    provider: z.enum(LLM_PROVIDERS),
    modelId: z.string().trim().min(1).max(200),
  })).min(1).max(3),
});

export async function PUT(request: Request) {
  try {
    const admin = await requireAdmin(["owner"], request);
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: "Invalid fallback chain" }, { status: 400 });
    const uniqueModels = new Set(parsed.data.chain.map((model) => `${model.provider}:${model.modelId}`));
    if (uniqueModels.size !== parsed.data.chain.length) {
      return Response.json({ error: "Fallback chain contains duplicate models" }, { status: 400 });
    }
    const chain = parsed.data.chain.map((model, priority) => ({
      ...model,
      taskType: parsed.data.taskType,
      priority,
      isActive: true,
    }));
    await getLlmRepository().replaceFallbackChain(parsed.data.taskType, chain);
    await writeAuditLog({
      adminId: admin.id,
      action: "llm.fallback.updated",
      entityType: "llm_model_setting",
      entityId: parsed.data.taskType,
      after: { chain },
    });
    return Response.json({ taskType: parsed.data.taskType, chain });
  } catch (error) {
    return authErrorResponse(error);
  }
}
