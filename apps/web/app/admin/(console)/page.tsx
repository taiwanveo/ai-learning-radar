import { AdminPage } from "@/components/admin/admin-page";
import { getAdminRepository } from "@/server/admin/repository";

const STATUS_LABELS: Record<string, string> = {
  published: "已發布",
  hidden: "已隱藏",
  filtered_out: "已過濾",
  discovered: "已發現",
  metadata_fetched: "已取 metadata",
  transcript_ready: "逐字稿完成",
  analysis_ready: "分析完成",
  quiz_ready: "測驗完成",
  failed: "失敗",
};

export default async function DashboardPage() {
  const repo = getAdminRepository();
  const [topics, content, channels, runs] = await Promise.all([repo.listTopics(), repo.listContent(), repo.listChannels(), repo.listRuns()]);
  const statusBreakdown = Object.entries(content.reduce<Record<string, number>>((acc, item) => { acc[item.status] = (acc[item.status] ?? 0) + 1; return acc; }, {})).sort((a, b) => b[1] - a[1]);
  return (
    <AdminPage title="儀表板" description="內容策展與資料管線的即時概況。">
      <div className="admin-grid">
        <article className="admin-card">
          <strong>{content.length}</strong>
          <span>有效內容</span>
          <div className="admin-card__breakdown">
            {statusBreakdown.map(([status, count]) => (
              <span key={status}>{STATUS_LABELS[status] ?? status} {count}</span>
            ))}
          </div>
        </article>
        <article className="admin-card"><strong>{topics.filter(t => t.isActive).length}</strong><span>啟用主題</span></article>
        <article className="admin-card"><strong>{channels.length}</strong><span>頻道規則</span></article>
      </div>
      <div className="admin-panel"><h2>最近執行</h2><p className="admin-muted">{runs[0] ? `${runs[0].status} · ${runs[0].startedAt}` : "尚無執行紀錄"}</p></div>
    </AdminPage>
  );
}
