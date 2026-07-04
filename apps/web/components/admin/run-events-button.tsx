"use client";

import { useRef } from "react";
import type { RunEvent } from "@/server/admin/types";

export function RunEventsButton({ startedAt, events }: { startedAt: string; events: RunEvent[] }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  if (!events.length) return <>—</>;

  return (
    <>
      <button type="button" className="admin-button admin-button--secondary" onClick={() => dialogRef.current?.showModal()}>
        查看細節（{events.length}）
      </button>
      <dialog
        ref={dialogRef}
        className="admin-modal"
        aria-label="失敗事件細節"
        onClick={(event) => { if (event.target === dialogRef.current) dialogRef.current?.close(); }}
      >
        <header className="admin-modal__header">
          <h2>失敗事件 · {startedAt}</h2>
          <button type="button" className="admin-modal__close" onClick={() => dialogRef.current?.close()} aria-label="關閉">✕</button>
        </header>
        <div className="admin-modal__body">
          {events.map((event) => (
            <article className="admin-modal__event" key={event.id}>
              <div className="admin-modal__event-meta">
                <span className="admin-badge admin-badge--danger">{event.phase}</span>
                <span>{event.createdAt}</span>
              </div>
              <p>{event.message}</p>
            </article>
          ))}
        </div>
      </dialog>
    </>
  );
}
