"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AdminRole } from "@/server/admin/types";

export const adminMenu = [
  { href: "/admin", label: "儀表板", roles: ["owner", "admin", "editor", "viewer"] },
  { href: "/admin/content", label: "內容管理", roles: ["owner", "admin", "editor", "viewer"] },
  { href: "/admin/topics", label: "主題管理", roles: ["owner", "admin", "editor", "viewer"] },
  { href: "/admin/channels", label: "頻道管理", roles: ["owner", "admin", "editor", "viewer"] },
  { href: "/admin/settings", label: "系統設定", roles: ["owner", "admin"] },
  { href: "/admin/llm", label: "LLM 設定", roles: ["owner", "admin"] },
  { href: "/admin/admins", label: "管理員", roles: ["owner"] },
  { href: "/admin/runs", label: "執行紀錄", roles: ["owner", "admin", "editor", "viewer"] },
] as const satisfies readonly { href: string; label: string; roles: readonly AdminRole[] }[];

export function menuForRole(role: AdminRole) { return adminMenu.filter(item => (item.roles as readonly AdminRole[]).includes(role)); }

export function AdminNav({ role }: { role: AdminRole }) {
  const pathname = usePathname();
  const isActive = (href: string) => href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
  return <nav className="admin-nav" aria-label="管理後台">{menuForRole(role).map(item => <Link href={item.href} key={item.href} className={isActive(item.href) ? "admin-nav__link--active" : undefined} aria-current={isActive(item.href) ? "page" : undefined}>{item.label}</Link>)}</nav>;
}
