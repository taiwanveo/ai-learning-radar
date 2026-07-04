import { redirect } from "next/navigation";
import { AdminPage, EmptyState } from "@/components/admin/admin-page";
import { getAdminRepository } from "@/server/admin/repository";
import { getSession } from "@/server/auth";

const ACTION_LABELS: Record<string, string> = { create: "建立", update: "更新", disable: "停用", trigger: "觸發", "admin.login.succeeded": "登入成功", "admin.login.failed": "登入失敗", "admin.logout": "登出" };
const ENTITY_LABELS: Record<string, string> = { topic: "主題", channel: "頻道", content: "內容", agent_run: "Pipeline 執行", topic_search_settings: "主題搜尋設定", admin_session: "管理者 Session", admin_user: "管理者帳號", llm_api_key: "LLM 金鑰", llm_model_setting: "LLM 模型設定" };
const timeFormat = new Intl.DateTimeFormat("zh-Hant", { dateStyle: "medium", timeStyle: "medium", timeZone: "Asia/Taipei" });

export default async function AuditPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  if (session.role !== "owner" && session.role !== "admin") redirect("/admin");
  const logs = await getAdminRepository().listAuditLogs();
  return (
    <AdminPage title="稽核紀錄" description="所有管理操作的變更軌跡，最近 500 筆。">
      <div className="admin-panel">
        {logs.length ? (
          <table className="admin-table">
            <thead><tr><th>時間</th><th>管理者</th><th>動作</th><th>對象類型</th><th>對象 ID</th></tr></thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>{timeFormat.format(new Date(log.createdAt))}</td>
                  <td><span className="admin-muted">{log.adminId}</span></td>
                  <td><span className="admin-badge">{ACTION_LABELS[log.action] ?? log.action}</span></td>
                  <td>{ENTITY_LABELS[log.entityType] ?? log.entityType}</td>
                  <td><span className="admin-muted">{log.entityId ?? "—"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState>尚無稽核紀錄。</EmptyState>
        )}
      </div>
    </AdminPage>
  );
}
