import { authErrorResponse, requireAdmin } from "@/server/auth/guards";
import { writeAuditLog } from "@/server/auth/audit";
import { ADMIN_SESSION_COOKIE, revokeSession, sessionCookieOptions } from "@/server/auth/session";

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin(undefined, request);
    await revokeSession(request);
    await writeAuditLog({ adminId: admin.id, action: "admin.logout", entityType: "admin_session" });
    const response = Response.json({ ok: true });
    response.headers.append("Set-Cookie", `${ADMIN_SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${sessionCookieOptions.secure ? "; Secure" : ""}`);
    return response;
  } catch (error) {
    return authErrorResponse(error);
  }
}
