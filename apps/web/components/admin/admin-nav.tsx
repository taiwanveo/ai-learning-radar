"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AdminRole } from "@/server/admin/types";

export const adminMenu = [
  { href: "/admin", label: "儀表板", description: "內容、主題與頻道數量總覽，以及最近一次 pipeline 執行概況。", roles: ["owner", "admin", "editor", "viewer"] },
  { href: "/admin/content", label: "內容管理", description: "搜尋已收錄的影片，覆寫標題與難度等 metadata、隱藏或手動新增 YouTube 內容。", roles: ["owner", "admin", "editor", "viewer"] },
  { href: "/admin/topics", label: "主題管理", description: "維護學習主題、同義詞與排除關鍵字，決定系統要搜尋哪些領域的教學。", roles: ["owner", "admin", "editor", "viewer"] },
  { href: "/admin/channels", label: "頻道管理", description: "管理推薦頻道與黑名單，設定頻道權重與推薦理由，影響內容排名。", roles: ["owner", "admin", "editor", "viewer"] },
  { href: "/admin/settings", label: "系統設定", description: "調整各主題的搜尋配額、影片長度範圍、新鮮度天數與排名門檻。", roles: ["owner", "admin"] },
  { href: "/admin/llm", label: "LLM 設定", description: "管理內容分析用的 LLM 模型與各 Provider 的 API 金鑰（BYOK）。", roles: ["owner"] },
  { href: "/admin/admins", label: "管理員", description: "檢視管理者帳號與角色權限，僅 owner 可存取。", roles: ["owner"] },
  { href: "/admin/runs", label: "執行紀錄", description: "查看 pipeline 每次執行的狀態、phase 統計與失敗事件細節。", roles: ["owner", "admin", "editor", "viewer"] },
] as const satisfies readonly { href: string; label: string; description: string; roles: readonly AdminRole[] }[];

export function menuForRole(role: AdminRole) { return adminMenu.filter(item => (item.roles as readonly AdminRole[]).includes(role)); }

export function AdminNav({ role }: { role: AdminRole }) {
  const pathname = usePathname();
  const isActive = (href: string) => href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
  return <nav className="admin-nav" aria-label="管理後台">{menuForRole(role).map(item => <Link href={item.href} key={item.href} className={isActive(item.href) ? "admin-nav__link--active" : undefined} aria-current={isActive(item.href) ? "page" : undefined} aria-describedby={`nav-tip-${item.href.replaceAll("/", "-")}`}>{item.label}<span className="admin-nav__tip" role="tooltip" id={`nav-tip-${item.href.replaceAll("/", "-")}`}>{item.description}</span></Link>)}</nav>;
}
