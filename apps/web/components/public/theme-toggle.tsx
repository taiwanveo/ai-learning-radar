"use client";

export function ThemeToggle() {
  function toggle() {
    const root = document.documentElement;
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try {
      localStorage.setItem("radar-theme", next);
    } catch {
      /* private mode: theme still applies for this page view */
    }
  }

  return (
    <button className="theme-toggle" type="button" onClick={toggle} aria-label="切換亮色與暗色主題" title="切換主題">
      <svg className="theme-toggle__sun" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="4.4" />
        <path d="M12 2.5v2.6M12 18.9v2.6M2.5 12h2.6M18.9 12h2.6M5 5l1.8 1.8M17.2 17.2 19 19M19 5l-1.8 1.8M6.8 17.2 5 19" />
      </svg>
      <svg className="theme-toggle__moon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20.6 14.4A8.6 8.6 0 0 1 9.6 3.4a8.6 8.6 0 1 0 11 11Z" />
      </svg>
    </button>
  );
}
