import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST as login } from "@/app/api/admin/auth/login/route";
import { GET as getSchedule, POST as postSchedule } from "@/app/api/admin/schedule/route";
import {
  MemoryAdminRepository,
  resetAdminRepository,
  setAdminRepository,
} from "@/server/admin/repository";
import {
  configureAuthRepository,
  hashPassword,
  MemoryAuthRepository,
} from "@/server/auth";
import { resetAuthRepositoryForTests } from "@/server/auth/repository";

const originalDatabaseUrl = process.env.DATABASE_URL;
const originalSessionSecret = process.env.ADMIN_SESSION_SECRET;

function request(url: string, cookie: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("cookie", cookie);
  if (init.body) headers.set("content-type", "application/json");
  return new Request(url, { ...init, headers });
}

async function loginAsOwner() {
  const admin = {
    id: "00000000-0000-4000-8000-000000000001",
    email: "owner@example.com",
    name: "Owner",
    passwordHash: await hashPassword("correct horse battery staple"),
    role: "owner" as const,
    isActive: true,
  };
  configureAuthRepository(new MemoryAuthRepository([admin]));
  const response = await login(new Request("http://localhost/api/admin/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: admin.email, password: "correct horse battery staple" }),
  }));
  const cookie = response.headers.get("set-cookie")?.split(";", 1)[0];
  return cookie!;
}

beforeEach(() => {
  delete process.env.DATABASE_URL;
  process.env.ADMIN_SESSION_SECRET = "e2e-session-secret-that-is-at-least-32-characters";
  resetAuthRepositoryForTests();
  resetAdminRepository();
});

afterEach(() => {
  resetAuthRepositoryForTests();
  resetAdminRepository();
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
  if (originalSessionSecret === undefined) delete process.env.ADMIN_SESSION_SECRET;
  else process.env.ADMIN_SESSION_SECRET = originalSessionSecret;
});

describe("schedule pause toggle", () => {
  it("defaults to not paused, and pause/resume round-trips", async () => {
    setAdminRepository(new MemoryAdminRepository());
    const cookie = await loginAsOwner();

    const initial = await getSchedule(request("http://localhost/api/admin/schedule", cookie));
    expect(initial.status).toBe(200);
    expect((await initial.json()).schedule).toMatchObject({ isPaused: false });

    const paused = await postSchedule(request(
      "http://localhost/api/admin/schedule",
      cookie,
      { method: "POST", body: JSON.stringify({ action: "pause" }) },
    ));
    expect(paused.status).toBe(200);
    const pausedSchedule = (await paused.json()).schedule;
    expect(pausedSchedule.isPaused).toBe(true);
    expect(pausedSchedule.pausedAt).toBeTruthy();

    const resumed = await postSchedule(request(
      "http://localhost/api/admin/schedule",
      cookie,
      { method: "POST", body: JSON.stringify({ action: "resume" }) },
    ));
    expect(resumed.status).toBe(200);
    expect((await resumed.json()).schedule).toMatchObject({ isPaused: false, pausedAt: null });
  });

  it("rejects an invalid action", async () => {
    setAdminRepository(new MemoryAdminRepository());
    const cookie = await loginAsOwner();

    const response = await postSchedule(request(
      "http://localhost/api/admin/schedule",
      cookie,
      { method: "POST", body: JSON.stringify({ action: "nope" }) },
    ));
    expect(response.status).toBe(400);
  });
});
