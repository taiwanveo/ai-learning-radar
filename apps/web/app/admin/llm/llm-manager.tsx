"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import styles from "./llm.module.css";

type PublicKey = {
  id: string;
  provider: string;
  displayName: string;
  maskedKey: string;
  validationStatus: "valid" | "invalid" | null;
  lastValidatedAt: string | null;
};

export function LlmManager() {
  const [keys, setKeys] = useState<PublicKey[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  const reload = useCallback(async () => {
    const response = await fetch("/api/admin/llm");
    if (response.ok) setKeys((await response.json()).keys);
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  async function createKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    const form = event.currentTarget;
    const data = new FormData(form);
    const response = await fetch("/api/admin/llm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        provider: data.get("provider"),
        displayName: data.get("displayName"),
        apiKey: data.get("apiKey"),
      }),
    });
    const payload = await response.json();
    setPending(false);
    if (!response.ok) {
      setMessage(payload.error ?? "驗證失敗");
      return;
    }
    form.reset();
    setModels(payload.models);
    setMessage("金鑰已驗證並加密儲存");
    await reload();
  }

  async function validate(keyId: string) {
    setPending(true);
    const response = await fetch("/api/admin/llm/validate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ keyId }),
    });
    const payload = await response.json();
    setPending(false);
    setMessage(response.ok ? "金鑰有效" : (payload.error ?? "驗證失敗"));
    if (response.ok) setModels(payload.models);
    await reload();
  }

  async function saveFallback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const rows = String(data.get("models") ?? "").split("\n").map((line) => line.trim()).filter(Boolean);
    const chain = rows.map((line) => {
      const [provider, ...model] = line.split(":");
      return { provider, modelId: model.join(":") };
    });
    const response = await fetch("/api/admin/llm/fallback", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ taskType: data.get("taskType"), chain }),
    });
    const payload = await response.json();
    setMessage(response.ok ? "Fallback chain 已更新" : (payload.error ?? "更新失敗"));
  }

  return (
    <main className={styles.shell}>
      <header><p>LLM / BYOK</p><h1>模型與金鑰</h1><span>只有 owner 可以檢視或修改此頁。</span></header>
      <section className={styles.panel} aria-labelledby="credentials-title">
        <h2 id="credentials-title">Provider 金鑰</h2>
        <form className={styles.form} onSubmit={createKey}>
          <select name="provider" aria-label="Provider" required defaultValue="openai">
            <option value="openai">OpenAI</option><option value="gemini">Gemini</option>
            <option value="anthropic">Anthropic</option><option value="openrouter">OpenRouter</option>
          </select>
          <input name="displayName" placeholder="顯示名稱" maxLength={100} required />
          <input name="apiKey" type="password" autoComplete="off" placeholder="API key" required />
          <button disabled={pending}>驗證並儲存</button>
        </form>
        {keys.length === 0 ? <p>尚未設定金鑰。</p> : (
          <ul className={styles.keys}>{keys.map((key) => (
            <li key={key.id}>
              <div><strong>{key.displayName}</strong><span>{key.provider} · {key.maskedKey}</span></div>
              <span>{key.validationStatus === "valid" ? "有效" : "待驗證"}</span>
              <button type="button" disabled={pending} onClick={() => void validate(key.id)}>重新驗證</button>
            </li>
          ))}</ul>
        )}
      </section>
      <section className={styles.panel} aria-labelledby="fallback-title">
        <h2 id="fallback-title">Fallback chain</h2>
        <form className={styles.form} onSubmit={saveFallback}>
          <select name="taskType" aria-label="任務類型">
            <option value="classify">分類</option><option value="summarize">摘要</option>
            <option value="quiz">測驗</option><option value="learning_path">學習路徑</option>
            <option value="repair_json">JSON 修復</option>
          </select>
          <textarea name="models" rows={4} placeholder={"每行一個 provider:model-id，第一行為 primary\nopenai:gpt-4.1-mini"} required />
          <button>儲存 chain</button>
        </form>
        {models.length > 0 ? <p>可用模型：{models.slice(0, 8).join("、")}</p> : null}
      </section>
      <p role="status" className={styles.status}>{message}</p>
    </main>
  );
}
