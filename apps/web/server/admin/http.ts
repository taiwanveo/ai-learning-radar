import { NextResponse } from "next/server";
import { AuthError, authErrorResponse, requireAdmin } from "@/server/auth";
import type { AdminActor, AdminRole } from "./types";

export const writableRoles: readonly AdminRole[] = ["owner", "admin", "editor"];
export const readableRoles: readonly AdminRole[] = ["owner", "admin", "editor", "viewer"];
export async function actor(request: Request, roles = readableRoles): Promise<AdminActor> {
  const principal = await requireAdmin(roles, request);
  return { id: principal.id, role: principal.role, email: principal.email };
}
const codeMessages: Record<string, string> = {
  TOPIC_SLUG_EXISTS: "此 Slug 已被使用，請換一個識別代碼",
  CONTENT_EXISTS: "此內容已存在，請勿重複新增",
  WORKFLOW_DISPATCH_NOT_CONFIGURED: "尚未設定 GITHUB_TOKEN 與 GITHUB_REPOSITORY，無法觸發 GitHub Actions 執行",
  WORKFLOW_DISPATCH_FAILED: "GitHub Actions 觸發失敗，請檢查 token 權限與 workflow 設定後再試",
};
export function invalid(error: unknown) {
  if (error instanceof AuthError) return authErrorResponse(error);
  const issues = typeof error === "object" && error && "issues" in error ? (error as { issues: unknown }).issues : undefined;
  const code = issues ? "VALIDATION_ERROR" : error instanceof Error ? error.message : "INVALID_REQUEST";
  const status = code.endsWith("_EXISTS") ? 409 : 400;
  const message = codeMessages[code] ?? (issues ? "輸入資料格式不正確，請檢查各欄位後再試" : code);
  return NextResponse.json({ error: { code, message, issues } }, { status });
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
