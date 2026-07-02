export { decryptSecret, encryptSecret, maskSecret } from "./encryption";
export { listProviderModels } from "./llm-providers";
export {
  configureLlmRepository,
  getLlmRepository,
  LLM_PROVIDERS,
  LLM_TASKS,
  MemoryLlmRepository,
  publicLlmKey,
} from "./llm-repository";
export type { LlmKeyRecord, LlmModelSetting, LlmProvider, LlmRepository, LlmTask } from "./llm-repository";
export { PrismaLlmRepository } from "./prisma-llm-repository";

import { decryptSecret } from "./encryption";
import { getLlmRepository } from "./llm-repository";

export async function loadDecryptedLlmKey(id: string) {
  const key = await getLlmRepository().findKey(id);
  if (!key?.isActive) return null;
  return {
    record: key,
    value: decryptSecret({ encryptedValue: key.encryptedKey, iv: key.encryptionIv, authTag: key.encryptionTag }),
  };
}
