import type { ReactNode } from "react";
export function AdminPage({ title, description, action, children }: { title: string; description: string; action?: ReactNode; children: ReactNode }) { return <section><header className="admin-page-heading"><div><p className="admin-kicker">AI Learning Radar</p><h1>{title}</h1><p>{description}</p></div>{action}</header>{children}</section>; }
export function EmptyState({ children }: { children: ReactNode }) { return <div className="admin-empty">{children}</div>; }
