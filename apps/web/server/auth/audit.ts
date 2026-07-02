import { getAuthRepository } from "./repository";
import type { AuditEvent } from "./types";

const SENSITIVE_FIELD = /(?:api.?key|password|secret|token|credential|encrypted|encryption(?:iv|tag)?)/i;

export function redactSensitive(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSensitive);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
      key,
      SENSITIVE_FIELD.test(key) ? "[REDACTED]" : redactSensitive(nested),
    ]),
  );
}

export async function writeAuditLog(event: Omit<AuditEvent, "createdAt">): Promise<void> {
  await getAuthRepository().writeAudit({
    ...event,
    before: redactSensitive(event.before),
    after: redactSensitive(event.after),
    createdAt: new Date(),
  });
}
