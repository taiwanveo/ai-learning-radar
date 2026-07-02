import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getAuthRepository } from "./repository";
import type { AdminPrincipal } from "./types";

export const ADMIN_SESSION_COOKIE = "ai_radar_admin_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 12;

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_TTL_SECONDS,
};

function sessionSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("ADMIN_SESSION_SECRET must contain at least 32 characters");
  return secret;
}

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("base64url");
}

function signature(value: string): string {
  return createHmac("sha256", sessionSecret()).update(value).digest("base64url");
}

export function verifySignedSessionCookie(value: string): string | null {
  const separator = value.lastIndexOf(".");
  if (separator < 1) return null;
  const token = value.slice(0, separator);
  const supplied = Buffer.from(value.slice(separator + 1), "base64url");
  const expected = Buffer.from(signature(token), "base64url");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected) ? token : null;
}

export async function createAdminSession(adminId: string): Promise<{ value: string; expiresAt: Date }> {
  const repository = getAuthRepository();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1_000);
  await repository.createSession({
    id: randomUUID(),
    adminId,
    sessionTokenHash: tokenHash(token),
    expiresAt,
    createdAt: new Date(),
  });
  return { value: `${token}.${signature(token)}`, expiresAt };
}

function cookieFromRequest(request: Request): string | null {
  const cookie = request.headers.get("cookie") ?? "";
  for (const part of cookie.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === ADMIN_SESSION_COOKIE) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export async function getSession(request?: Request): Promise<AdminPrincipal | null> {
  const value = request
    ? cookieFromRequest(request)
    : (await cookies()).get(ADMIN_SESSION_COOKIE)?.value ?? null;
  if (!value) return null;
  const token = verifySignedSessionCookie(value);
  if (!token) return null;

  const repository = getAuthRepository();
  const record = await repository.findSessionByTokenHash(tokenHash(token));
  if (!record || record.expiresAt <= new Date()) {
    if (record) await repository.deleteSessionByTokenHash(record.sessionTokenHash);
    return null;
  }
  const admin = await repository.findAdminById(record.adminId);
  if (!admin?.isActive) return null;
  return {
    id: admin.id,
    email: admin.email,
    name: admin.name,
    role: admin.role,
    sessionId: record.id,
    expiresAt: record.expiresAt,
  };
}

export async function revokeSession(request: Request): Promise<void> {
  const value = cookieFromRequest(request);
  const token = value ? verifySignedSessionCookie(value) : null;
  if (token) await getAuthRepository().deleteSessionByTokenHash(tokenHash(token));
}
