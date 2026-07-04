import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/server/auth";
import { AdminNav } from "@/components/admin/admin-nav";
import { LogoutButton } from "@/components/admin/logout-button";
import "../admin.css";
import "../controls.css";

export default async function AdminLayout({ children }: { children: ReactNode }) { const session = await getSession(); if (!session) redirect("/admin/login"); return <div className="admin-frame"><aside className="admin-sidebar"><div className="admin-account"><strong>{session.name}</strong><span>{session.email} · {session.role}</span><LogoutButton/></div><AdminNav role={session.role}/></aside><main className="admin-main">{children}</main></div>; }
