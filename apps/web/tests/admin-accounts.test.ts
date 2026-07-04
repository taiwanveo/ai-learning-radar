import { describe, expect, it } from "vitest";
import { MemoryAuthRepository } from "@/server/auth";

const base = { email: "New.Admin@Example.com", name: "New Admin", passwordHash: "hash", role: "editor" as const, isActive: true };

describe("admin account management", () => {
  it("creates admins with normalized email and rejects duplicates", async () => {
    const repository = new MemoryAuthRepository();
    const created = await repository.createAdmin(base);
    expect(created.email).toBe("new.admin@example.com");
    expect((await repository.listAdmins()).map(({ id }) => id)).toContain(created.id);
    await expect(repository.createAdmin(base)).rejects.toThrow("ADMIN_EMAIL_EXISTS");
  });

  it("updates role, active state, and password hash; unknown id returns null", async () => {
    const repository = new MemoryAuthRepository();
    const created = await repository.createAdmin(base);
    const updated = await repository.updateAdmin(created.id, { role: "admin", isActive: false, passwordHash: "next-hash" });
    expect(updated).toMatchObject({ role: "admin", isActive: false, passwordHash: "next-hash", email: created.email });
    expect(await repository.updateAdmin(crypto.randomUUID(), { isActive: true })).toBeNull();
  });
});
