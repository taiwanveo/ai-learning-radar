import { PrismaLlmRepository } from "./prisma-llm-repository";

export const LLM_PROVIDERS = ["openai", "gemini", "anthropic", "openrouter"] as const;
export const LLM_TASKS = ["classify", "summarize", "quiz", "learning_path", "repair_json"] as const;
export type LlmProvider = (typeof LLM_PROVIDERS)[number];
export type LlmTask = (typeof LLM_TASKS)[number];

export interface LlmKeyRecord {
  id: string;
  provider: LlmProvider;
  displayName: string;
  encryptedKey: string;
  encryptionIv: string;
  encryptionTag: string;
  maskedKey: string;
  isActive: boolean;
  lastValidatedAt: Date | null;
  validationStatus: "valid" | "invalid" | null;
  validationError: string | null;
  createdByAdminId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface LlmModelSetting {
  taskType: LlmTask;
  provider: LlmProvider;
  modelId: string;
  priority: number;
  isActive: boolean;
}

export type CreateLlmKey = Omit<LlmKeyRecord, "id" | "createdAt" | "updatedAt">;

export interface LlmRepository {
  listKeys(): Promise<LlmKeyRecord[]>;
  findKey(id: string): Promise<LlmKeyRecord | null>;
  createKey(input: CreateLlmKey): Promise<LlmKeyRecord>;
  updateValidation(id: string, result: Pick<LlmKeyRecord, "lastValidatedAt" | "validationStatus" | "validationError">): Promise<void>;
  deactivateKey(id: string): Promise<boolean>;
  replaceFallbackChain(taskType: LlmTask, chain: LlmModelSetting[]): Promise<void>;
  listFallbackChains(): Promise<LlmModelSetting[]>;
}

export class MemoryLlmRepository implements LlmRepository {
  private readonly keys = new Map<string, LlmKeyRecord>();
  private settings: LlmModelSetting[] = [];

  async listKeys() { return [...this.keys.values()]; }
  async findKey(id: string) { return this.keys.get(id) ?? null; }
  async createKey(input: CreateLlmKey) {
    const now = new Date();
    const record: LlmKeyRecord = { ...input, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
    this.keys.set(record.id, record);
    return record;
  }
  async updateValidation(id: string, result: Pick<LlmKeyRecord, "lastValidatedAt" | "validationStatus" | "validationError">) {
    const key = this.keys.get(id);
    if (key) this.keys.set(id, { ...key, ...result, updatedAt: new Date() });
  }
  async deactivateKey(id: string) {
    const key = this.keys.get(id);
    if (!key) return false;
    this.keys.set(id, { ...key, isActive: false, updatedAt: new Date() });
    return true;
  }
  async replaceFallbackChain(taskType: LlmTask, chain: LlmModelSetting[]) {
    this.settings = [...this.settings.filter((item) => item.taskType !== taskType), ...chain];
  }
  async listFallbackChains() { return [...this.settings].sort((a, b) => a.priority - b.priority); }
}

let installedRepository: LlmRepository | undefined;

/** Install a Prisma adapter backed by LlmApiKey/LlmModelSetting in production. */
export function configureLlmRepository(repository: LlmRepository): void { installedRepository = repository; }
export function getLlmRepository(): LlmRepository {
  if (installedRepository) return installedRepository;
  if (process.env.DATABASE_URL) {
    installedRepository = new PrismaLlmRepository();
    return installedRepository;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("LlmRepository is not configured. Install a persistent adapter before serving production traffic.");
  }
  installedRepository = new MemoryLlmRepository();
  return installedRepository;
}
export function resetLlmRepositoryForTests() { installedRepository = undefined; }

export function publicLlmKey(key: LlmKeyRecord) {
  return {
    id: key.id,
    provider: key.provider,
    displayName: key.displayName,
    maskedKey: key.maskedKey,
    isActive: key.isActive,
    lastValidatedAt: key.lastValidatedAt?.toISOString() ?? null,
    validationStatus: key.validationStatus,
    validationError: key.validationError,
    updatedAt: key.updatedAt.toISOString(),
  };
}
