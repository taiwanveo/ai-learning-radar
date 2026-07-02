import { beforeEach, describe, expect, it } from "vitest";
import { POST as login } from "@/app/api/admin/auth/login/route";
import {
  AuthError,
  configureAuthRepository,
  createAdminSession,
  getSession,
  hashPassword,
  MemoryAuthRepository,
  requireAdmin,
  verifyPassword,
  verifySignedSessionCookie,
} from "@/server/auth";

const sessionSecret = "test-session-secret-that-is-longer-than-32-characters";

describe("admin auth", () => {
  beforeEach(() => {
    process.env.ADMIN_SESSION_SECRET = sessionSecret;
  });

  it("hashes passwords with a unique scrypt salt and verifies in constant-time comparison path", async () => {
    const first = await hashPassword("correct horse battery staple");
    const second = await hashPassword("correct horse battery staple");
    expect(first).toMatch(/^scrypt\$/);
    expect(first).not.toBe(second);
    await expect(verifyPassword("correct horse battery staple", first)).resolves.toBe(true);
    await expect(verifyPassword("incorrect password", first)).resolves.toBe(false);
  });

  it("issues a signed HttpOnly session and resolves only active admins", async () => {
    const repository = new MemoryAuthRepository([{
      id: "e650389c-6435-421d-8622-8af21f44d3b3",
      email: "owner@example.com",
      name: "Owner",
      passwordHash: await hashPassword("correct horse battery staple"),
      role: "owner",
      isActive: true,
    }]);
    configureAuthRepository(repository);
    const response = await login(new Request("http://localhost/api/admin/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "OWNER@example.com", password: "correct horse battery staple" }),
    }));
    expect(response.status).toBe(200);
    const cookie = response.headers.get("set-cookie")!;
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    const value = cookie.match(/ai_radar_admin_session=([^;]+)/)?.[1];
    expect(verifySignedSessionCookie(decodeURIComponent(value!))).not.toBeNull();
    const request = new Request("http://localhost/admin", { headers: { cookie: `ai_radar_admin_session=${value}` } });
    await expect(getSession(request)).resolves.toMatchObject({ email: "owner@example.com", role: "owner" });
    await expect(requireAdmin(["owner"], request)).resolves.toMatchObject({ role: "owner" });
  });

  it("rejects tampered cookies and disallowed roles", async () => {
    const repository = new MemoryAuthRepository([{
      id: "876ca5cb-31af-497a-982e-1d33415ed4ac", email: "viewer@example.com", name: "Viewer",
      passwordHash: "unused", role: "viewer", isActive: true,
    }]);
    configureAuthRepository(repository);
    const session = await createAdminSession("876ca5cb-31af-497a-982e-1d33415ed4ac");
    const valid = new Request("http://localhost/admin", { headers: { cookie: `ai_radar_admin_session=${encodeURIComponent(session.value)}` } });
    await expect(requireAdmin(["owner"], valid)).rejects.toMatchObject({ status: 403 } satisfies Partial<AuthError>);
    const tampered = new Request("http://localhost/admin", { headers: { cookie: `ai_radar_admin_session=${encodeURIComponent(session.value)}x` } });
    await expect(getSession(tampered)).resolves.toBeNull();
  });
});
