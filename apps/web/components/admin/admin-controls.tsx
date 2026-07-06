"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import type { ContentItem, ScheduleStatus, SearchSettings, Topic } from "@/server/admin/types";
import { Tip } from "@/components/admin/admin-page";

type Feedback = { kind: "success" | "error"; message: string } | null;

async function mutate(url: string, method: string, body?: unknown) {
  const response = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const payload = await response.json().catch(() => null) as { error?: { message?: string } | string } | null;
  if (!response.ok) throw new Error(typeof payload?.error === "string" ? payload.error : payload?.error?.message ?? `操作失敗 (${response.status})`);
  return payload;
}

function Status({ feedback }: { feedback: Feedback }) { return feedback ? <p className={`admin-feedback admin-feedback--${feedback.kind}`} role={feedback.kind === "error" ? "alert" : "status"}>{feedback.message}</p> : null; }

export const KEYWORD_TYPE_LABELS = { tw_term: "台灣用語", cn_term: "中國用語", english: "英文", positive: "正向", negative: "排除", synonym: "同義詞" } as const;
const keywordTypeOptions = Object.entries(KEYWORD_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>);

export function TopicCreateForm({ canWrite }: { canWrite: boolean }) {
  const router = useRouter(); const [pending, setPending] = useState(false); const [feedback, setFeedback] = useState<Feedback>(null);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement); setPending(true); setFeedback(null); try { await mutate("/api/admin/topics", "POST", { slug: form.get("slug"), nameZhHant: form.get("nameZhHant"), keywords: form.get("keyword") ? [{ keyword: form.get("keyword"), keywordType: form.get("keywordType"), weight: 1, isActive: true }] : [] }); formElement.reset(); setFeedback({ kind: "success", message: "主題已新增" }); router.refresh(); } catch (error) { setFeedback({ kind: "error", message: error instanceof Error ? error.message : "新增失敗" }); } finally { setPending(false); } }
  if (!canWrite) return null;
  return <form className="admin-panel admin-form" onSubmit={submit}><h2 className="admin-form-title">新增主題</h2><label>名稱<input name="nameZhHant" required maxLength={200}/></label><label><Tip label="Slug" text="主題的英文識別代碼，會用在前台網址與資料關聯，只能使用小寫英文、數字與連字號（-），例如 ai-agent。建立後不建議變更。"/><input name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="例如 ai-agent" aria-label="Slug，主題的英文識別代碼"/></label><label>第一個關鍵字<input name="keyword" maxLength={200}/></label><label>關鍵字類型<select name="keywordType" defaultValue="tw_term">{keywordTypeOptions}</select></label><div><button className="admin-button" disabled={pending}>{pending ? "新增中…" : "新增主題"}</button><Status feedback={feedback}/></div></form>;
}

export function TopicKeywordsEditor({ topic, canWrite }: { topic: Topic; canWrite: boolean }) {
  const router = useRouter(); const [pending, setPending] = useState(false); const [feedback, setFeedback] = useState<Feedback>(null);
  async function save(keywords: Topic["keywords"], success: string) { setPending(true); setFeedback(null); try { await mutate(`/api/admin/topics/${topic.id}`, "PATCH", { keywords: keywords.map(({ id, keyword, keywordType, weight, isActive }) => ({ id, keyword, keywordType, weight, isActive })) }); setFeedback({ kind: "success", message: success }); router.refresh(); return true; } catch (e) { setFeedback({ kind: "error", message: e instanceof Error ? e.message : "更新失敗" }); return false; } finally { setPending(false); } }
  async function add(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement); const keyword = String(form.get("keyword") ?? "").trim(); if (!keyword) return; const keywordType = String(form.get("keywordType")) as Topic["keywords"][number]["keywordType"]; if (await save([...topic.keywords, { id: crypto.randomUUID(), keyword, keywordType, weight: 1, isActive: true }], "關鍵字已新增")) formElement.reset(); }
  async function remove(keywordId: string, keyword: string) { if (!confirm(`確定移除關鍵字「${keyword}」？`)) return; await save(topic.keywords.filter(k => k.id !== keywordId), "關鍵字已移除"); }
  return <div className="admin-keywords">
    <div className="admin-keywords__list">{topic.keywords.length ? topic.keywords.map(k => <span className="admin-badge" key={k.id}>{k.keyword}（{KEYWORD_TYPE_LABELS[k.keywordType] ?? k.keywordType}）{canWrite ? <button type="button" className="admin-keywords__remove" aria-label={`移除關鍵字 ${k.keyword}`} disabled={pending} onClick={() => remove(k.id, k.keyword)}>✕</button> : null}</span>) : <span className="admin-muted">—</span>}</div>
    {canWrite ? <form className="admin-keywords__form" onSubmit={add}><input name="keyword" required maxLength={200} placeholder="新關鍵字" aria-label="新關鍵字" disabled={pending}/><select name="keywordType" defaultValue="tw_term" aria-label="關鍵字類型" disabled={pending}>{keywordTypeOptions}</select><button className="admin-button admin-button--secondary" type="submit" disabled={pending}>{pending ? "新增中…" : "新增"}</button></form> : null}
    <Status feedback={feedback}/>
  </div>;
}

export function DisableTopicButton({ id, canWrite }: { id: string; canWrite: boolean }) { const router=useRouter(); const [pending,setPending]=useState(false); const [feedback,setFeedback]=useState<Feedback>(null); if(!canWrite)return null; async function disable(){if(!confirm("確定停用此主題？既有資料會保留。"))return;setPending(true);try{await mutate(`/api/admin/topics/${id}`,"DELETE");setFeedback({kind:"success",message:"已停用"});router.refresh();}catch(e){setFeedback({kind:"error",message:e instanceof Error?e.message:"停用失敗"});}finally{setPending(false);}} return <div><button className="admin-button admin-button--secondary" type="button" disabled={pending} onClick={disable}>{pending?"停用中…":"停用"}</button><Status feedback={feedback}/></div>; }

export function EnableTopicButton({ id, canWrite }: { id: string; canWrite: boolean }) { const router=useRouter(); const [pending,setPending]=useState(false); const [feedback,setFeedback]=useState<Feedback>(null); if(!canWrite)return null; async function enable(){setPending(true);setFeedback(null);try{await mutate(`/api/admin/topics/${id}`,"PATCH",{isActive:true});setFeedback({kind:"success",message:"已重新啟用"});router.refresh();}catch(e){setFeedback({kind:"error",message:e instanceof Error?e.message:"啟用失敗"});}finally{setPending(false);}} return <div><button className="admin-button admin-button--secondary" type="button" disabled={pending} onClick={enable}>{pending?"啟用中…":"重新啟用"}</button><Status feedback={feedback}/></div>; }

export function RemoveChannelButton({ id, title, canWrite }: { id: string; title: string; canWrite: boolean }) { const router=useRouter(); const [pending,setPending]=useState(false); const [feedback,setFeedback]=useState<Feedback>(null); if(!canWrite)return null; async function remove(){if(!confirm(`確定移除「${title}」的頻道規則？頻道會回到中立狀態，不再加權或封鎖。`))return;setPending(true);setFeedback(null);try{await mutate(`/api/admin/channels/${id}`,"DELETE");setFeedback({kind:"success",message:"已移除"});router.refresh();}catch(e){setFeedback({kind:"error",message:e instanceof Error?e.message:"移除失敗"});}finally{setPending(false);}} return <div><button className="admin-button admin-button--secondary" type="button" disabled={pending} onClick={remove}>{pending?"移除中…":"移除規則"}</button><Status feedback={feedback}/></div>; }

export function SettingsEditor({ settings, canWrite, topicLabels }: { settings: SearchSettings[]; canWrite: boolean; topicLabels?: Record<string, string> }) { const router=useRouter(); const [pending,setPending]=useState<string|null>(null); const [feedback,setFeedback]=useState<Feedback>(null); if(!canWrite)return null; async function submit(event:FormEvent<HTMLFormElement>, current:SearchSettings){event.preventDefault();const form=new FormData(event.currentTarget);setPending(current.topicId);setFeedback(null);try{await mutate("/api/admin/settings","PATCH",{...current,freshnessDays:Number(form.get("freshnessDays")),candidateLimit:Number(form.get("candidateLimit")),topN:Number(form.get("topN")),minDurationSeconds:Number(form.get("minDurationSeconds")),maxDurationSeconds:Number(form.get("maxDurationSeconds")),minViewCount:Number(form.get("minViewCount")),minEngagementScore:Number(form.get("minEngagementScore")),excludeShorts:form.get("excludeShorts")==="on",growthGuardrailEnabled:form.get("growthGuardrailEnabled")==="on",minViewsPerDay:Number(form.get("minViewsPerDay")),autoPublish:form.get("autoPublish")==="on"});setFeedback({kind:"success",message:"設定已儲存"});router.refresh();}catch(e){setFeedback({kind:"error",message:e instanceof Error?e.message:"儲存失敗"});}finally{setPending(null);}} return <div>{settings.map(item=><form className="admin-panel admin-form" key={item.topicId} onSubmit={e=>submit(e,item)}><h2 className="admin-form-title">編輯 {topicLabels?.[item.topicId] ?? item.topicId}</h2><label><Tip label="Freshness 天數" text="內容發布超過這個天數就視為「不新鮮」，越新鮮的內容在排名中會得到越高的加分。"/><input name="freshnessDays" type="number" min="1" max="3650" defaultValue={item.freshnessDays} required/></label><label><Tip label="候選上限" text="系統從 YouTube 搜尋時，最多蒐集並評分的候選影片數量。"/><input name="candidateLimit" type="number" min="1" max="500" defaultValue={item.candidateLimit} required/></label><label><Tip label="Top N" text="候選影片評分完成後，最終進入前台「今日精選」的名次數量上限，不可超過候選上限。"/><input name="topN" type="number" min="1" max="100" defaultValue={item.topN} required/></label><label><Tip label="最短秒數" text="影片長度短於這個秒數會被排除，可用來過濾 YouTube Shorts 等過短內容。"/><input name="minDurationSeconds" type="number" min="0" max="86400" defaultValue={item.minDurationSeconds} required/></label><label><Tip label="最長秒數" text="影片長度長於這個秒數會被排除，可用來過濾過長的直播或講座錄影。"/><input name="maxDurationSeconds" type="number" min="1" max="86400" defaultValue={item.maxDurationSeconds} required/></label><label><Tip label="最低觀看數" text="觀看次數低於這個數字的影片會在收錄階段被排除；設 0 表示不過濾。"/><input name="minViewCount" type="number" min="0" max="100000000" defaultValue={item.minViewCount} required/></label><label><Tip label="最低互動率" text="按讚數除以觀看次數的最低比例門檻，低於此門檻的影片會在收錄階段被排除；數值介於 0 到 1 之間，設 0 表示不過濾。"/><input name="minEngagementScore" type="number" min="0" max="1" step="0.001" defaultValue={item.minEngagementScore} required/></label><label className="admin-check"><input name="excludeShorts" type="checkbox" defaultChecked={item.excludeShorts}/> <Tip label="排除 Shorts" text="開啟後，長度 180 秒以下的影片（YouTube Shorts）會在收錄階段被排除。"/></label><label className="admin-check"><input name="growthGuardrailEnabled" type="checkbox" defaultChecked={item.growthGuardrailEnabled}/> <Tip label="成長護欄" text="開啟後，日均觀看低於「最低日均觀看」或互動率低於門檻的影片在排名時會被扣分（不會被排除）。"/></label><label><Tip label="最低日均觀看" text="成長護欄的門檻：影片平均每天的觀看次數低於此值時，排名扣分；只有在成長護欄開啟時才生效。"/><input name="minViewsPerDay" type="number" min="0" max="10000000" defaultValue={item.minViewsPerDay} required/></label><label className="admin-check"><input name="autoPublish" type="checkbox" defaultChecked={item.autoPublish}/> <Tip label="自動發布" text="開啟後，通過篩選與評分的內容會自動上架到前台；關閉則會停在「已發現」狀態，需要管理者在「內容管理」頁手動按下「發布」。"/></label><div><button className="admin-button" disabled={pending===item.topicId}>{pending===item.topicId?"儲存中…":"儲存設定"}</button></div></form>)}<Status feedback={feedback}/></div>; }

export function ChannelCreateForm({ canWrite }: { canWrite:boolean }) { const router=useRouter();const[pending,setPending]=useState(false);const[feedback,setFeedback]=useState<Feedback>(null);async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();const formElement=e.currentTarget;const f=new FormData(formElement);const listType=String(f.get("listType"));setPending(true);setFeedback(null);try{await mutate(`/api/admin/channels/${listType==="recommended"?"recommended":"blacklist"}`,"POST",{sourceChannelId:f.get("sourceChannelId"),handle:f.get("handle")||null,title:f.get("title"),trustWeight:Number(f.get("trustWeight")),recommendationReason:listType==="recommended"?f.get("recommendationReason")||null:null});formElement.reset();setFeedback({kind:"success",message:"頻道規則已新增"});router.refresh();}catch(error){setFeedback({kind:"error",message:error instanceof Error?error.message:"新增失敗"});}finally{setPending(false);}} if(!canWrite)return null;return <form className="admin-panel admin-form" onSubmit={submit}><h2 className="admin-form-title">新增頻道規則</h2><label>類型<select name="listType"><option value="recommended">推薦</option><option value="blacklisted">黑名單</option></select></label><label><Tip label="Channel ID" text="YouTube 頻道的原始識別碼（不是頻道暱稱），通常以 UC 開頭，可從頻道網址或「關於」頁面的分享連結取得。"/><input name="sourceChannelId" required placeholder="例如 UCxxxxxxxxxxxxxxxxxxxxxx"/></label><label>名稱<input name="title" required/></label><label><Tip label="Handle" text="頻道的 @ 帳號名稱，僅用於顯示與辨識，選填。"/><input name="handle" placeholder="@channel"/></label><label><Tip label="信任權重" text="推薦頻道的信任強度（0–1），會按比例縮放此頻道在排名時獲得的推薦加分：1 為完整加分、0.5 為一半。黑名單頻道無論權重皆會被排除。"/><input name="trustWeight" type="number" min="0" max="1" step="0.05" defaultValue="1" required/></label><label>推薦理由<textarea name="recommendationReason" maxLength={1000}/></label><div><button className="admin-button" disabled={pending}>{pending?"新增中…":"新增規則"}</button><Status feedback={feedback}/></div></form>; }

export function ManualContentForm({ canWrite, topics }: { canWrite:boolean; topics: Pick<Topic, "id" | "slug" | "nameZhHant">[] }) { const router=useRouter();const[pending,setPending]=useState(false);const[feedback,setFeedback]=useState<Feedback>(null);async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();const formElement=e.currentTarget;const f=new FormData(formElement);setPending(true);setFeedback(null);try{const payload=await mutate("/api/admin/content/manual-youtube","POST",{url:f.get("url"),title:f.get("title"),topicId:f.get("topicId")||null,publishImmediately:f.get("publishImmediately")==="on"}) as {analysisDispatched?:boolean}|null;formElement.reset();setFeedback({kind:"success",message:payload?.analysisDispatched?"YouTube 內容已新增，已排入分析（數分鐘後自動補齊摘要與統計）":"YouTube 內容已新增；未能觸發自動分析，請檢查 GitHub 設定或稍後在 GitHub Actions 手動執行"});router.refresh();}catch(error){setFeedback({kind:"error",message:error instanceof Error?error.message:"新增失敗"});}finally{setPending(false);}}if(!canWrite)return null;return <form className="admin-panel admin-form" onSubmit={submit}><h2 className="admin-form-title">手動新增 YouTube</h2><label>影片網址<input name="url" type="url" required placeholder="https://www.youtube.com/watch?v=…"/></label><label>標題<input name="title" required/></label><label>主題（選填）<select name="topicId" defaultValue=""><option value="">未分類</option>{topics.map(t=><option key={t.id} value={t.id}>{t.nameZhHant}（{t.slug}）</option>)}</select></label><label className="admin-check"><input name="publishImmediately" type="checkbox"/> 立即發布（略過篩選標準）</label><div><button className="admin-button" disabled={pending}>{pending?"新增中…":"新增內容"}</button><Status feedback={feedback}/></div></form>; }

export function ContentActions({ item, canWrite }: { item:ContentItem; canWrite:boolean }) { const router=useRouter();const[pending,setPending]=useState(false);const[feedback,setFeedback]=useState<Feedback>(null);if(!canWrite)return null;async function action(method:string,body?:unknown){setPending(true);setFeedback(null);try{await mutate(`/api/admin/content/${item.id}`,method,body);setFeedback({kind:"success",message:"內容已更新"});router.refresh();}catch(e){setFeedback({kind:"error",message:e instanceof Error?e.message:"更新失敗"});}finally{setPending(false);}}return <div className="admin-actions"><ContentEditButton item={item} canWrite={canWrite}/><button type="button" disabled={pending} onClick={()=>action("PATCH",{status:item.status==="published"?"hidden":"published",hiddenReason:item.status==="published"?"管理者隱藏":null})}>{item.status==="published"?"隱藏":"發布"}</button><button type="button" disabled={pending} onClick={()=>confirm("確定刪除此內容？資料會以 soft delete 保留。")&&action("DELETE")}>刪除</button><Status feedback={feedback}/></div>; }

export function ContentEditButton({ item, canWrite }: { item: ContentItem; canWrite: boolean }) {
  const router = useRouter(); const dialogRef = useRef<HTMLDialogElement>(null); const [pending, setPending] = useState(false); const [feedback, setFeedback] = useState<Feedback>(null);
  if (!canWrite) return null;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); setPending(true); setFeedback(null);
    try {
      await mutate(`/api/admin/content/${item.id}`, "PATCH", { title: String(form.get("title") ?? "").trim(), difficulty: form.get("difficulty"), shortSummary: String(form.get("shortSummary") ?? "").trim(), isPinned: form.get("isPinned") === "on" });
      setFeedback({ kind: "success", message: "已儲存" }); router.refresh(); dialogRef.current?.close();
    } catch (e) { setFeedback({ kind: "error", message: e instanceof Error ? e.message : "儲存失敗" }); } finally { setPending(false); }
  }
  return <>
    <button type="button" onClick={() => dialogRef.current?.showModal()}>編輯</button>
    <dialog ref={dialogRef} className="admin-modal" aria-label={`編輯內容：${item.title}`} onClick={(event) => { if (event.target === dialogRef.current) dialogRef.current?.close(); }}>
      <header className="admin-modal__header"><h2>編輯內容</h2><button type="button" className="admin-modal__close" onClick={() => dialogRef.current?.close()} aria-label="關閉">✕</button></header>
      <form className="admin-modal__body admin-form" onSubmit={submit}>
        <label>標題<input name="title" defaultValue={item.title} required maxLength={500}/></label>
        <label>難度<select name="difficulty" defaultValue={item.difficulty}><option value="beginner">入門</option><option value="normal">一般</option></select></label>
        <label>短摘要<textarea name="shortSummary" defaultValue={item.shortSummary} maxLength={3000}/></label>
        <label className="admin-check"><input name="isPinned" type="checkbox" defaultChecked={item.isPinned}/> 置頂顯示</label>
        <div><button className="admin-button" disabled={pending}>{pending ? "儲存中…" : "儲存"}</button><Status feedback={feedback}/></div>
      </form>
    </dialog>
  </>;
}

export function TriggerRunButton({ canWrite }: { canWrite:boolean }) { const router=useRouter();const[pending,setPending]=useState(false);const[feedback,setFeedback]=useState<Feedback>(null);if(!canWrite)return null;async function trigger(){setPending(true);setFeedback(null);try{await mutate("/api/admin/runs/trigger","POST");setFeedback({kind:"success",message:"Run 已排入佇列"});router.refresh();}catch(e){setFeedback({kind:"error",message:e instanceof Error?e.message:"觸發失敗"});}finally{setPending(false);}}return <div><button className="admin-button" type="button" disabled={pending} onClick={trigger}>{pending?"觸發中…":"手動觸發 Run"}</button><Status feedback={feedback}/></div>; }

export function ScheduleToggle({ canWrite, initial }: { canWrite: boolean; initial: ScheduleStatus }) {
  const router = useRouter();
  const [schedule, setSchedule] = useState(initial);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  async function toggle() {
    const action = schedule.isPaused ? "resume" : "pause";
    setPending(true); setFeedback(null);
    try {
      const payload = await mutate("/api/admin/schedule", "POST", { action }) as { schedule: ScheduleStatus };
      setSchedule(payload.schedule);
      setFeedback({ kind: "success", message: action === "pause" ? "每日排程已暫停" : "每日排程已重啟" });
      router.refresh();
    } catch (e) {
      setFeedback({ kind: "error", message: e instanceof Error ? e.message : "操作失敗" });
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="admin-schedule-toggle">
      <span className={`admin-badge${schedule.isPaused ? " admin-badge--danger" : ""}`}>{schedule.isPaused ? "已暫停" : "排程中"}</span>
      {canWrite && <button className="admin-button" type="button" disabled={pending} onClick={toggle}>{pending ? "處理中…" : schedule.isPaused ? "重啟排程" : "暫停排程"}</button>}
      <Status feedback={feedback}/>
    </div>
  );
}
