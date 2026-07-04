import { AdminPage, EmptyState } from "@/components/admin/admin-page";
import { getAdminRepository } from "@/server/admin/repository";
import { getSession } from "@/server/auth";
import { ContentActions, ManualContentForm } from "@/components/admin/admin-controls";

const STATUS_LABELS: Record<string, string> = { discovered: "已發現", published: "已發布", hidden: "已隱藏" };
const DIFFICULTY_LABELS: Record<string, string> = { beginner: "入門", normal: "一般" };

export default async function ContentPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = (await searchParams).q ?? "";
  const [content, topics, session] = await Promise.all([getAdminRepository().listContent(q), getAdminRepository().listTopics(), getSession()]);
  const canWrite = session?.role !== "viewer";
  return (
    <AdminPage title="內容管理" description="搜尋、覆寫 metadata、隱藏或手動新增 YouTube 內容。">
      <ManualContentForm canWrite={canWrite} topics={topics.filter((t) => t.isActive)}/>
      <form className="admin-form admin-search">
        <label>搜尋內容<input name="q" defaultValue={q} placeholder="標題或頻道"/></label>
        <div><button className="admin-button" type="submit">搜尋</button></div>
      </form>
      <div className="admin-panel">
        {content.length ? (
          <table className="admin-table">
            <thead><tr><th>標題</th><th>難度</th><th>Tags</th><th>狀態</th><th>操作</th></tr></thead>
            <tbody>
              {content.map((c) => (
                <tr key={c.id}>
                  <td><a href={c.sourceUrl}>{c.title}</a><br/><span className="admin-muted">{c.channelTitle ?? "未知頻道"}</span></td>
                  <td>{DIFFICULTY_LABELS[c.difficulty] ?? c.difficulty}</td>
                  <td>{c.tags.join("、") || "—"}</td>
                  <td><span className="admin-badge">{STATUS_LABELS[c.status] ?? c.status}</span></td>
                  <td><ContentActions item={c} canWrite={canWrite}/></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState>找不到內容。</EmptyState>
        )}
      </div>
    </AdminPage>
  );
}
