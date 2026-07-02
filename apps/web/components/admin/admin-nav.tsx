"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AdminRole } from "@/server/admin/types";

export const adminMenu = [
  { href: "/admin", label: "Dashboard", roles: ["owner", "admin", "editor", "viewer"] },
  { href: "/admin/content", label: "Content", roles: ["owner", "admin", "editor", "viewer"] },
  { href: "/admin/topics", label: "Topics", roles: ["owner", "admin", "editor", "viewer"] },
  { href: "/admin/channels", label: "Channels", roles: ["owner", "admin", "editor", "viewer"] },
  { href: "/admin/settings", label: "Settings", roles: ["owner", "admin"] },
  { href: "/admin/llm", label: "LLM", roles: ["owner", "admin"] },
  { href: "/admin/admins", label: "Admins", roles: ["owner"] },
  { href: "/admin/runs", label: "Runs", roles: ["owner", "admin", "editor", "viewer"] },
] as const satisfies readonly { href: string; label: string; roles: readonly AdminRole[] }[];

export function menuForRole(role: AdminRole) { return adminMenu.filter(item => (item.roles as readonly AdminRole[]).includes(role)); }

export function AdminNav({ role }: { role: AdminRole }) {
  const pathname = usePathname();
  const isActive = (href: string) => href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
  return <nav className="admin-nav" aria-label="管理後台">{menuForRole(role).map(item => <Link href={item.href} key={item.href} className={isActive(item.href) ? "admin-nav__link--active" : undefined} aria-current={isActive(item.href) ? "page" : undefined}>{item.label}</Link>)}</nav>;
}
