import { AdminPage, EmptyState, Tip } from "@/components/admin/admin-page";
import { getAdminRepository } from "@/server/admin/repository";
import { getSession } from "@/server/auth";
import { ChannelCreateForm, RemoveChannelButton } from "@/components/admin/admin-controls";

const LIST_TYPE_LABELS: Record<string, string> = { recommended: "推薦", blacklisted: "黑名單", neutral: "中立" };

export default async function ChannelsPage() {
  const [channels, session] = await Promise.all([getAdminRepository().listChannels(), getSession()]);
  const canWrite = session?.role !== "viewer";
  return (
    <AdminPage title="頻道管理" description="管理推薦頻道、黑名單、權重與推薦理由。">
      <ChannelCreateForm canWrite={canWrite} />
      <div className="admin-panel">
        {channels.length ? (
          <table className="admin-table">
            <thead><tr><th>頻道</th><th>清單</th><th><Tip label="權重" text="影響此頻道在排名時的加減分：正值提升排序，負值降低排序；黑名單頻道無論權重皆會被排除。"/></th><th>理由</th><th>操作</th></tr></thead>
            <tbody>
              {channels.map((c) => (
                <tr key={c.id}>
                  <td>{c.title}<br/><span className="admin-muted">{c.handle ?? c.sourceChannelId}</span></td>
                  <td><span className={`admin-badge${c.listType === "blacklisted" ? " admin-badge--danger" : ""}`}>{LIST_TYPE_LABELS[c.listType] ?? c.listType}</span></td>
                  <td>{c.trustWeight}</td>
                  <td>{c.recommendationReason ?? "—"}</td>
                  <td><RemoveChannelButton id={c.id} title={c.title} canWrite={canWrite}/></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState>尚無頻道規則。</EmptyState>
        )}
      </div>
    </AdminPage>
  );
}
