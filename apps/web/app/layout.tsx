import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SiteHeader } from "@/components/public/site-header";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Learning Radar｜每日 AI 學習雷達",
  description: "每天精選值得投入時間的中文 AI 教學內容",
};

const themeInitScript = `(function(){var t;try{t=localStorage.getItem("radar-theme")}catch(e){}if(t!=="light"&&t!=="dark"){t=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.dataset.theme=t})();`;

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="zh-Hant" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <SiteHeader />
        {children}
        <footer className="site-footer">
          <p>AI Learning Radar · 為你的學習時間把關</p>
        </footer>
      </body>
    </html>
  );
}
