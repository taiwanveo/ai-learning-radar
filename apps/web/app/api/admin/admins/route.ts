import { z } from "zod";
import { ADMIN_ROLES, authErrorResponse, getAuthRepository, hashPassword, requireAdmin, writeAuditLog, type AdminAccount } from "@/server/auth";

const createAdminSchema = z.object({
  email: z.string().trim().email().max(320).transform((value) => value.toLowerCase()),
  name: z.string().trim().min(1).max(100),
  role: z.enum(ADMIN_ROLES),
  password: z.string().min(12).max(1_024),
});

const publicAdmin = (admin: AdminAccount) => ({ id: admin.id, email: admin.email, name: admin.name, role: admin.role, isActive: admin.isActive });

export async function GET(request: Request) {
  try {
    await requireAdmin(["owner"], request);
    const admins = await getAuthRepository().listAdmins();
    return Response.json({ admins: admins.map(publicAdmin) });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireAdmin(["owner"], request);
    const parsed = createAdminSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: "請填寫有效的 Email、名稱、角色與至少 12 碼的密碼" }, { status: 400 });
    let admin: AdminAccount;
    try {
      admin = await getAuthRepository().createAdmin({
        email: parsed.data.email,
        name: parsed.data.name,
        role: parsed.data.role,
        passwordHash: await hashPassword(parsed.data.password),
        isActive: true,
      });
    } catch (error) {
      if (error instanceof Error && error.message === "ADMIN_EMAIL_EXISTS") return Response.json({ error: "此 Email 已註冊為管理者" }, { status: 409 });
      throw error;
    }
    await writeAuditLog({ adminId: actor.id, action: "admin.account.created", entityType: "admin_user", entityId: admin.id, after: publicAdmin(admin) });
    return Response.json({ admin: publicAdmin(admin) }, { status: 201 });
  } catch (error) {
    return authErrorResponse(error);
  }
}
