import { redirect } from "next/navigation";
import { AdminPage } from "@/components/admin/admin-page";
import { getSession } from "@/server/auth";

export default async function AdminsPage() { const session=await getSession(); if(!session)redirect("/admin/login"); if(session.role!=="owner")redirect("/admin"); return <AdminPage title="Admins" description="管理者帳號與角色由 owner 控制。"><div className="admin-panel"><h2>目前登入帳號</h2><table className="admin-table"><tbody><tr><th>名稱</th><td>{session.name}</td></tr><tr><th>Email</th><td>{session.email}</td></tr><tr><th>角色</th><td><span className="admin-badge">{session.role}</span></td></tr><tr><th>Session 到期</th><td>{session.expiresAt.toISOString()}</td></tr></tbody></table><p className="admin-muted">帳號建立、密碼重設與角色異動應透過受控的管理者佈署流程執行，避免在前端暴露憑證操作。</p></div></AdminPage>; }
