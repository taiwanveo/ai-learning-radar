"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SiteHeader() {
  const pathname = usePathname();
  const navLink = (matches: boolean) => `site-nav__link${matches ? " site-nav__link--active" : ""}`;

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link className="brand" href="/" aria-label="AI Learning Radar 首頁">
          <span className="brand__mark" aria-hidden="true">
            <span />
          </span>
          <span className="brand__name">AI Learning Radar</span>
        </Link>

        <nav className="site-nav" aria-label="主要導覽">
          <Link
            className={navLink(pathname === "/" || pathname.startsWith("/content"))}
            href="/"
            aria-current={pathname === "/" ? "page" : undefined}
          >
            今日精選
          </Link>
          <Link
            className={navLink(pathname.startsWith("/search"))}
            href="/search"
            aria-current={pathname.startsWith("/search") ? "page" : undefined}
          >
            搜尋內容
          </Link>
          <Link className="site-nav__search" href="/search" aria-label="搜尋教學內容">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m21 21-4.35-4.35m2.35-5.15a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z" />
            </svg>
            <span>搜尋</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
