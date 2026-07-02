"use client";

import { useState, useTransition } from "react";
import type { LearningPath } from "@/server/public/types";

type ResultRef = { id: string; title: string };

export function LearningPathButton({ query, difficulty, results }: { query: string; difficulty: string; results: ResultRef[] }) {
  const [path, setPath] = useState<LearningPath | null>(null);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const titles = new Map(results.map((result) => [result.id, result.title]));

  function generate() {
    setError("");
    startTransition(async () => {
      const response = await fetch("/api/public/learning-path", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query, difficulty, contentItemIds: results.map(({ id }) => id) }) });
      if (!response.ok) { const body = await response.json() as { error?: string }; setError(body.error ?? "目前無法產生學習指引"); return; }
      setPath(await response.json() as LearningPath);
    });
  }

  if (path) return <section className="learning-path" aria-live="polite"><p className="section-heading__kicker">LEARNING PATH</p><h2>你的學習順序建議</h2><p>{path.guidance}</p><ol>{path.recommended_order.map((recommendation) => <li key={recommendation.content_item_id}><strong>{titles.get(recommendation.content_item_id) ?? "搜尋結果"}</strong><span>{recommendation.learning_role}</span><p>{recommendation.reason}</p></li>)}</ol><h3>下一步</h3><ul>{path.next_steps.map((step) => <li key={step}>{step}</li>)}</ul></section>;
  return <div className="learning-path-trigger"><button className="primary-button" type="button" disabled={isPending} onClick={generate}>{isPending ? "正在規劃…" : "產生學習順序建議"}</button><p>按下後才會產生建議，且只使用本頁搜尋結果。</p>{error ? <p className="form-error" role="alert">{error}</p> : null}</div>;
}
