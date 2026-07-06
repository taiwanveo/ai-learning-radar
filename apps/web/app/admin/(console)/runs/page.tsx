import { AdminPage, EmptyState, Tip } from "@/components/admin/admin-page";
import { getAdminRepository } from "@/server/admin/repository";
import { getSession } from "@/server/auth";
import { ScheduleToggle, TriggerRunButton } from "@/components/admin/admin-controls";
import { RunEventsButton } from "@/components/admin/run-events-button";

const TRIGGER_LABELS: Record<string, string> = { manual: "手動", scheduled: "排程", backfill: "回補", test: "單片測試" };
const STATUS_LABELS: Record<string, string> = { queued: "排隊中", running: "執行中", succeeded: "成功", failed: "失敗" };

export default async function RunsPage() {
  const [runs, session, schedule] = await Promise.all([getAdminRepository().listRuns(), getSession(), getAdminRepository().getScheduleStatus()]);
  const canWrite = session?.role !== "viewer";
  return (
    <AdminPage title="執行紀錄" description="查看 pipeline phase 統計與失敗事件。" action={<div className="admin-page-actions"><ScheduleToggle canWrite={canWrite} initial={schedule}/><TriggerRunButton canWrite={canWrite}/></div>}>
      <div className="admin-panel">
        {runs.length ? (
          <table className="admin-table">
            <thead><tr><th>開始時間</th><th>觸發</th><th>狀態</th><th><Tip label="Phase 統計" text="pipeline 各處理階段（如收集、分析、產生測驗等）處理的內容數量統計。"/></th><th>失敗事件</th></tr></thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id}>
                  <td>{run.startedAt}</td>
                  <td>{TRIGGER_LABELS[run.trigger] ?? run.trigger}</td>
                  <td><span className={`admin-badge${run.status === "failed" ? " admin-badge--danger" : ""}`}>{STATUS_LABELS[run.status] ?? run.status}</span></td>
                  <td>{Object.entries(run.statistics).map(([k, v]) => `${k}: ${v}`).join(" · ") || "—"}</td>
                  <td><RunEventsButton startedAt={run.startedAt} events={run.events.filter((e) => e.level === "error")}/></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState>尚無執行紀錄。</EmptyState>
        )}
      </div>
    </AdminPage>
  );
}
