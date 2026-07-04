import { redirect } from "next/navigation";
import { AdminPage, EmptyState } from "@/components/admin/admin-page";
import { AdminAccountActions, AdminCreateForm, type AdminAccountSummary } from "@/components/admin/admin-accounts";
import { getAuthRepository, getSession } from "@/server/auth";

const ROLE_LABELS: Record<string, string> = { owner: "擁有者", admin: "管理員", editor: "編輯", viewer: "檢視者" };

export default async function AdminsPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  if (session.role !== "owner") redirect("/admin");
  const admins = await getAuthRepository().listAdmins();
  const accounts: AdminAccountSummary[] = admins.map((admin) => ({ id: admin.id, email: admin.email, name: admin.name, role: admin.role, isActive: admin.isActive }));
  return (
    <AdminPage title="管理員" description="新增管理者、調整角色權限、重設密碼或停用帳號，僅 owner 可操作。">
      <AdminCreateForm/>
      <div className="admin-panel">
        {accounts.length ? (
          <table className="admin-table">
            <thead><tr><th>名稱</th><th>Email</th><th>角色</th><th>狀態</th><th>操作</th></tr></thead>
            <tbody>
              {accounts.map((account) => (
                <tr key={account.id}>
                  <td>{account.name}{account.id === session.id ? <span className="admin-muted">（自己）</span> : null}</td>
                  <td>{account.email}</td>
                  <td><span className="admin-badge">{ROLE_LABELS[account.role] ?? account.role}</span></td>
                  <td><span className={`admin-badge${account.isActive ? "" : " admin-badge--danger"}`}>{account.isActive ? "啟用" : "停用"}</span></td>
                  <td><AdminAccountActions account={account} selfId={session.id}/></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState>尚無管理者帳號。</EmptyState>
        )}
      </div>
    </AdminPage>
  );
}
