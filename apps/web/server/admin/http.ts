import { NextResponse } from "next/server";
import { AuthError, authErrorResponse, requireAdmin } from "@/server/auth";
import type { AdminActor, AdminRole } from "./types";

export const writableRoles: readonly AdminRole[] = ["owner", "admin", "editor"];
export const readableRoles: readonly AdminRole[] = ["owner", "admin", "editor", "viewer"];
export async function actor(request: Request, roles = readableRoles): Promise<AdminActor> {
  const principal = await requireAdmin(roles, request);
  return { id: principal.id, role: principal.role, email: principal.email };
}
export function invalid(error: unknown) {
  if (error instanceof AuthError) return authErrorResponse(error);
  const issues = typeof error === "object" && error && "issues" in error ? (error as { issues: unknown }).issues : undefined;
  const message = error instanceof Error ? error.message : "Invalid request";
  const status = message.endsWith("_EXISTS") ? 409 : 400;
  return NextResponse.json({ error: { code: message, message, issues } }, { status });
}
export const notFound = (entity: string) => NextResponse.json({ error: { code: "NOT_FOUND", message: `${entity} 不存在` } }, { status: 404 });

const triggerAttempts = new Map<string, number>();
export function enforceManualRunRateLimit(adminId: string, now = Date.now()) {
  const last = triggerAttempts.get(adminId) ?? 0;
  if (now - last < 60_000) return false;
  triggerAttempts.set(adminId, now);
  return true;
}
export const resetManualRunRateLimit = () => triggerAttempts.clear();
