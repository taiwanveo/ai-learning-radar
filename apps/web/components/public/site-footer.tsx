"use client";

import { usePathname } from "next/navigation";

export function SiteFooter() {
  const isAdmin = usePathname().startsWith("/admin");
  return (
    <footer className="site-footer">
      <p>
        AI Learning Radar · 為你的學習時間把關
        {isAdmin ? null : <> · <a className="site-footer__admin" href="/admin">管理後台</a></>}
      </p>
    </footer>
  );
}
