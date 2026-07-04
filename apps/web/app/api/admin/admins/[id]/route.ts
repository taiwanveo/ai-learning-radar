import { z } from "zod";
import { ADMIN_ROLES, authErrorResponse, getAuthRepository, hashPassword, requireAdmin, writeAuditLog, type AdminAccount } from "@/server/auth";

const updateAdminSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  role: z.enum(ADMIN_ROLES).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(12).max(1_024).optional(),
}).refine((value) => Object.keys(value).length > 0, "至少需要一個欄位");

const publicAdmin = (admin: AdminAccount) => ({ id: admin.id, email: admin.email, name: admin.name, role: admin.role, isActive: admin.isActive });

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  try {
    const actor = await requireAdmin(["owner"], request);
    const { id } = await params;
    const parsed = updateAdminSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: "請提供有效的名稱、角色、狀態或至少 12 碼的新密碼" }, { status: 400 });
    if (id === actor.id && (parsed.data.role !== undefined && parsed.data.role !== "owner" || parsed.data.isActive === false)) {
      return Response.json({ error: "不能變更自己的角色或停用自己的帳號" }, { status: 400 });
    }
    const repository = getAuthRepository();
    const before = await repository.findAdminById(id);
    if (!before) return Response.json({ error: "管理者不存在" }, { status: 404 });
    const { password, ...fields } = parsed.data;
    const admin = await repository.updateAdmin(id, { ...fields, ...(password ? { passwordHash: await hashPassword(password) } : {}) });
    if (!admin) return Response.json({ error: "管理者不存在" }, { status: 404 });
    await writeAuditLog({ adminId: actor.id, action: password ? "admin.account.password_reset" : "admin.account.updated", entityType: "admin_user", entityId: id, before: publicAdmin(before), after: publicAdmin(admin) });
    return Response.json({ admin: publicAdmin(admin) });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: Context) {
  try {
    const actor = await requireAdmin(["owner"], request);
    const { id } = await params;
    if (id === actor.id) return Response.json({ error: "不能停用自己的帳號" }, { status: 400 });
    const repository = getAuthRepository();
    const before = await repository.findAdminById(id);
    if (!before) return Response.json({ error: "管理者不存在" }, { status: 404 });
    const admin = await repository.updateAdmin(id, { isActive: false });
    if (!admin) return Response.json({ error: "管理者不存在" }, { status: 404 });
    await writeAuditLog({ adminId: actor.id, action: "admin.account.deactivated", entityType: "admin_user", entityId: id, before: publicAdmin(before), after: publicAdmin(admin) });
    return Response.json({ admin: publicAdmin(admin) });
  } catch (error) {
    return authErrorResponse(error);
  }
}
