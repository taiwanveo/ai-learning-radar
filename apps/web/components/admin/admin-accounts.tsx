"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import type { AdminRole } from "@/server/admin/types";

type Feedback = { kind: "success" | "error"; message: string } | null;
export type AdminAccountSummary = { id: string; email: string; name: string; role: AdminRole; isActive: boolean };

const ROLE_LABELS: Record<AdminRole, string> = { owner: "擁有者", admin: "管理員", editor: "編輯", viewer: "檢視者" };
const roleOptions = Object.entries(ROLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}（{value}）</option>);

async function mutate(url: string, method: string, body?: unknown) {
  const response = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const payload = await response.json().catch(() => null) as { error?: string } | null;
  if (!response.ok) throw new Error(payload?.error ?? `操作失敗 (${response.status})`);
  return payload;
}

function Status({ feedback }: { feedback: Feedback }) { return feedback ? <p className={`admin-feedback admin-feedback--${feedback.kind}`} role={feedback.kind === "error" ? "alert" : "status"}>{feedback.message}</p> : null; }

export function AdminCreateForm() {
  const router = useRouter(); const [pending, setPending] = useState(false); const [feedback, setFeedback] = useState<Feedback>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement); setPending(true); setFeedback(null);
    try {
      await mutate("/api/admin/admins", "POST", { email: form.get("email"), name: form.get("name"), role: form.get("role"), password: form.get("password") });
      formElement.reset(); setFeedback({ kind: "success", message: "管理者已建立" }); router.refresh();
    } catch (error) { setFeedback({ kind: "error", message: error instanceof Error ? error.message : "建立失敗" }); } finally { setPending(false); }
  }
  return <form className="admin-panel admin-form" onSubmit={submit}>
    <h2 className="admin-form-title">新增管理者</h2>
    <label>Email<input name="email" type="email" required maxLength={320} autoComplete="off"/></label>
    <label>名稱<input name="name" required maxLength={100}/></label>
    <label>角色<select name="role" defaultValue="editor">{roleOptions}</select></label>
    <label>初始密碼<input name="password" type="password" required minLength={12} maxLength={1024} autoComplete="new-password" placeholder="至少 12 碼"/></label>
    <div><button className="admin-button" disabled={pending}>{pending ? "建立中…" : "建立管理者"}</button><Status feedback={feedback}/></div>
  </form>;
}

export function AdminAccountActions({ account, selfId }: { account: AdminAccountSummary; selfId: string }) {
  const router = useRouter(); const dialogRef = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState(false); const [feedback, setFeedback] = useState<Feedback>(null);
  const isSelf = account.id === selfId;

  async function run(action: () => Promise<unknown>, success: string) {
    setPending(true); setFeedback(null);
    try { await action(); setFeedback({ kind: "success", message: success }); router.refresh(); return true; }
    catch (error) { setFeedback({ kind: "error", message: error instanceof Error ? error.message : "操作失敗" }); return false; }
    finally { setPending(false); }
  }

  async function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const role = form.get("role");
    const ok = await run(() => mutate(`/api/admin/admins/${account.id}`, "PATCH", { name: form.get("name"), ...(role ? { role } : {}), ...(password ? { password } : {}) }), "已儲存");
    if (ok) dialogRef.current?.close();
  }

  async function toggleActive() {
    if (account.isActive) {
      if (!confirm(`確定停用「${account.name}」？停用後將無法登入。`)) return;
      await run(() => mutate(`/api/admin/admins/${account.id}`, "DELETE"), "已停用");
    } else {
      await run(() => mutate(`/api/admin/admins/${account.id}`, "PATCH", { isActive: true }), "已重新啟用");
    }
  }

  return <div className="admin-actions">
    <button type="button" disabled={pending} onClick={() => dialogRef.current?.showModal()}>編輯</button>
    <button type="button" disabled={pending || isSelf} title={isSelf ? "不能停用自己的帳號" : undefined} onClick={toggleActive}>{account.isActive ? "停用" : "啟用"}</button>
    <Status feedback={feedback}/>
    <dialog ref={dialogRef} className="admin-modal" aria-label={`編輯管理者：${account.name}`} onClick={(event) => { if (event.target === dialogRef.current) dialogRef.current?.close(); }}>
      <header className="admin-modal__header"><h2>編輯管理者</h2><button type="button" className="admin-modal__close" onClick={() => dialogRef.current?.close()} aria-label="關閉">✕</button></header>
      <form className="admin-modal__body admin-form" onSubmit={submitEdit}>
        <label>Email<input value={account.email} disabled/></label>
        <label>名稱<input name="name" defaultValue={account.name} required maxLength={100}/></label>
        <label>角色<select name="role" defaultValue={account.role} disabled={isSelf}>{roleOptions}</select></label>
        <label>重設密碼（選填）<input name="password" type="password" minLength={12} maxLength={1024} autoComplete="new-password" placeholder="留空表示不變更"/></label>
        <div><button className="admin-button" disabled={pending}>{pending ? "儲存中…" : "儲存"}</button></div>
      </form>
    </dialog>
  </div>;
}
