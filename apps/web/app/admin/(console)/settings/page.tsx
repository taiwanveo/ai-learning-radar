import { AdminPage, EmptyState, Tip } from "@/components/admin/admin-page";
import { getAdminRepository } from "@/server/admin/repository";
import { getSession } from "@/server/auth";
import { SettingsEditor } from "@/components/admin/admin-controls";
import { DEFAULT_SEARCH_SETTINGS } from "@/server/admin/types";

export default async function SettingsPage() {
  const [settings, topics, session] = await Promise.all([getAdminRepository().getSettings(), getAdminRepository().listTopics(), getSession()]);
  const canWrite = session?.role === "owner" || session?.role === "admin";
  const topicLabels = new Map(topics.map((t) => [t.id, `${t.nameZhHant}（${t.slug}）`]));
  const settingsByTopic = new Map(settings.map((s) => [s.topicId, s]));
  // Every topic gets a row: topics created before this default-settings fix (or via the
  // one-time seed script) may not have a persisted row yet — show them with the same
  // defaults new topics get, so saving via the normal PATCH flow creates the row.
  const rows = topics.map((t) => ({
    topicId: t.id,
    settings: settingsByTopic.get(t.id) ?? { topicId: t.id, ...DEFAULT_SEARCH_SETTINGS },
    isUnsaved: !settingsByTopic.has(t.id),
  }));
  return (
    <AdminPage title="系統設定" description="搜尋配額、影片長度、freshness 與排名門檻。每日搜尋由 GitHub Actions 於台北時間 06:00 統一觸發所有主題，無法分主題設定排程。">
      <div className="admin-panel">
        {rows.length ? (
          <table className="admin-table">
            <thead>
              <tr>
                <th>主題</th>
                <th><Tip label="Freshness" text="內容發布超過這個天數就視為「不新鮮」，越新鮮的內容在排名中會得到越高的加分。"/></th>
                <th><Tip label="候選 / Top N" text="候選上限：本次搜尋最多評分幾部影片。Top N：評分後最終進入前台「今日精選」的名次數量上限，不可超過候選上限。"/></th>
                <th><Tip label="影片長度" text="只有長度介於此秒數範圍內的影片才會被收錄，可用來排除過短的 YouTube Shorts 或過長的直播內容。"/></th>
                <th><Tip label="最低互動" text="按讚數除以觀看次數的最低比例門檻，低於門檻的影片會在收錄階段被排除。"/></th>
                <th><Tip label="排除 Shorts" text="開啟後，長度 180 秒以下的影片（YouTube Shorts）會在收錄階段被排除。"/></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ topicId, settings: s, isUnsaved }) => (
                <tr key={topicId}>
                  <td>{topicLabels.get(topicId) ?? topicId}{isUnsaved ? <><br/><span className="admin-badge">尚未儲存，目前為預設值</span></> : null}</td>
                  <td>{s.freshnessDays} 天</td>
                  <td>{s.candidateLimit} / {s.topN}</td>
                  <td>{s.minDurationSeconds}–{s.maxDurationSeconds} 秒</td>
                  <td>{s.minEngagementScore}</td>
                  <td>{s.excludeShorts ? "開啟" : "關閉"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState>尚無主題。</EmptyState>
        )}
      </div>
      <SettingsEditor settings={rows.map((r) => r.settings)} canWrite={canWrite} topicLabels={Object.fromEntries(topicLabels)} />
    </AdminPage>
  );
}
