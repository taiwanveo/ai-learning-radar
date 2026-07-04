import type { ReactNode } from "react";
export function AdminPage({ title, description, action, children }: { title: string; description: string; action?: ReactNode; children: ReactNode }) { return <section><header className="admin-page-heading"><div><p className="admin-kicker">AI Learning Radar</p><h1>{title}</h1><p>{description}</p></div>{action}</header>{children}</section>; }
export function EmptyState({ children }: { children: ReactNode }) { return <div className="admin-empty">{children}</div>; }
export function Tip({ label, text }: { label: ReactNode; text: string }) { return <span className="admin-tip" tabIndex={0}>{label}<span className="admin-tip__marker" aria-hidden="true">ⓘ</span><span className="admin-tip__text" role="tooltip">{text}</span></span>; }
