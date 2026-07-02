import { PrismaClient } from "@prisma/client";
import type { CreateLlmKey, LlmKeyRecord, LlmModelSetting, LlmRepository, LlmTask } from "./llm-repository";

const globalPrisma = globalThis as unknown as { aiRadarPrisma?: PrismaClient };
function client() { globalPrisma.aiRadarPrisma ??= new PrismaClient(); return globalPrisma.aiRadarPrisma; }

function keyRecord(record: Awaited<ReturnType<PrismaClient["llmApiKey"]["findFirst"]>>): LlmKeyRecord | null {
  if (!record) return null;
  return {
    ...record,
    provider: record.provider as LlmKeyRecord["provider"],
    createdByAdminId: record.createdByAdminId ?? "",
    validationStatus: record.validationStatus as LlmKeyRecord["validationStatus"],
  };
}

export class PrismaLlmRepository implements LlmRepository {
  constructor(private readonly prisma: PrismaClient = client()) {}

  async listKeys() {
    const rows = await this.prisma.llmApiKey.findMany({ orderBy: { updatedAt: "desc" } });
    return rows.map(keyRecord).filter((row): row is LlmKeyRecord => row !== null);
  }
  async findKey(id: string) { return keyRecord(await this.prisma.llmApiKey.findUnique({ where: { id } })); }
  async createKey(input: CreateLlmKey) {
    const created = await this.prisma.llmApiKey.create({ data: input });
    return keyRecord(created)!;
  }
  async updateValidation(id: string, result: Pick<LlmKeyRecord, "lastValidatedAt" | "validationStatus" | "validationError">) {
    await this.prisma.llmApiKey.update({ where: { id }, data: result });
  }
  async replaceFallbackChain(taskType: LlmTask, chain: LlmModelSetting[]) {
    await this.prisma.$transaction([
      this.prisma.llmModelSetting.deleteMany({ where: { taskType } }),
      this.prisma.llmModelSetting.createMany({ data: chain }),
    ]);
  }
  async listFallbackChains() {
    const rows = await this.prisma.llmModelSetting.findMany({ orderBy: [{ taskType: "asc" }, { priority: "asc" }] });
    return rows.map((row) => ({
      ...row,
      taskType: row.taskType as LlmTask,
      provider: row.provider as LlmModelSetting["provider"],
    }));
  }
}
