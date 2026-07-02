import { z } from "zod";
import { writeAuditLog } from "@/server/auth/audit";
import { verifyPassword } from "@/server/auth/password";
import { getAuthRepository } from "@/server/auth/repository";
import {
  ADMIN_SESSION_COOKIE,
  createAdminSession,
  sessionCookieOptions,
} from "@/server/auth/session";

const loginSchema = z.object({
  email: z.string().trim().email().max(320).transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(1_024),
});

function requestMetadata(request: Request) {
  return {
    ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: request.headers.get("user-agent"),
  };
}

export async function POST(request: Request) {
  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid credentials" }, { status: 400 });

  const repository = getAuthRepository();
  const admin = await repository.findAdminByEmail(parsed.data.email);
  const authenticated = admin?.isActive && (await verifyPassword(parsed.data.password, admin.passwordHash));
  if (!admin || !authenticated) {
    await writeAuditLog({
      adminId: admin?.id ?? null,
      action: "admin.login.failed",
      entityType: "admin_session",
      ...requestMetadata(request),
    });
    return Response.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const session = await createAdminSession(admin.id);
  await Promise.all([
    repository.updateLastLogin(admin.id, new Date()),
    repository.deleteExpiredSessions(new Date()),
    writeAuditLog({
      adminId: admin.id,
      action: "admin.login.succeeded",
      entityType: "admin_session",
      ...requestMetadata(request),
    }),
  ]);

  const response = Response.json({
    admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role },
    expiresAt: session.expiresAt.toISOString(),
  });
  response.headers.append(
    "Set-Cookie",
    `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(session.value)}; Path=/; Max-Age=${sessionCookieOptions.maxAge}; HttpOnly; SameSite=Lax${sessionCookieOptions.secure ? "; Secure" : ""}`,
  );
  return response;
}
