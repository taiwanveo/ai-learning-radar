"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Tip } from "@/components/admin/admin-page";
import styles from "./llm.module.css";

type PublicKey = {
  id: string;
  provider: string;
  displayName: string;
  maskedKey: string;
  isActive: boolean;
  validationStatus: "valid" | "invalid" | null;
  validationError: string | null;
  lastValidatedAt: string | null;
};

function validatedAtLabel(iso: string | null): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("zh-Hant", { dateStyle: "short", timeStyle: "medium", timeZone: "Asia/Taipei" }).format(new Date(iso));
}

type FallbackChainSetting = { taskType: string; provider: string; modelId: string; priority: number };
type ModelGroup = { provider: string; label: string; models: string[] };

const TASKS = [
  { value: "classify", label: "分類" },
  { value: "summarize", label: "摘要" },
  { value: "quiz", label: "測驗" },
  { value: "learning_path", label: "學習路徑" },
  { value: "repair_json", label: "JSON 修復" },
];

const PROVIDER_LABELS: Record<string, string> = { openai: "OpenAI", gemini: "Gemini", anthropic: "Anthropic", openrouter: "OpenRouter" };
const CHAIN_LENGTH = 3;
const ROW_LABELS = ["主要模型", "備援模型 1", "備援模型 2"];

function chainStepsFor(taskType: string, chains: FallbackChainSetting[]): string[] {
  const saved = chains.filter((c) => c.taskType === taskType).sort((a, b) => a.priority - b.priority);
  const steps = Array.from({ length: CHAIN_LENGTH }, () => "");
  saved.slice(0, CHAIN_LENGTH).forEach((step, index) => { steps[index] = `${step.provider}:${step.modelId}`; });
  return steps;
}

export function LlmManager() {
  const [keys, setKeys] = useState<PublicKey[]>([]);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  const [fallbackChains, setFallbackChains] = useState<FallbackChainSetting[]>([]);
  const [chainsLoaded, setChainsLoaded] = useState(false);
  const [modelGroups, setModelGroups] = useState<ModelGroup[]>([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelsError, setModelsError] = useState("");
  const [taskType, setTaskType] = useState(TASKS[0].value);
  const [chainSteps, setChainSteps] = useState<string[]>(Array.from({ length: CHAIN_LENGTH }, () => ""));
  const [chainMessage, setChainMessage] = useState("");
  const [chainPending, setChainPending] = useState(false);
  const initialized = useRef(false);

  const reload = useCallback(async () => {
    const response = await fetch("/api/admin/llm");
    if (response.ok) {
      const payload = await response.json();
      setKeys((payload.keys as PublicKey[]).filter((key) => key.isActive));
      setFallbackChains(payload.fallbackChains ?? []);
      setChainsLoaded(true);
    }
  }, []);

  const reloadModels = useCallback(async () => {
    setModelsLoading(true);
    setModelsError("");
    try {
      const response = await fetch("/api/admin/llm/available-models");
      const payload = await response.json().catch(() => null);
      if (!response.ok) { setModelsError(payload?.error ?? "無法載入模型清單"); return; }
      setModelGroups(payload.groups ?? []);
    } catch {
      setModelsError("無法連線至伺服器，請確認網路後再試");
    } finally {
      setModelsLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => { void reloadModels(); }, [reloadModels]);

  useEffect(() => {
    if (!chainsLoaded || initialized.current) return;
    initialized.current = true;
    setChainSteps(chainStepsFor(taskType, fallbackChains));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chainsLoaded]);

  function selectTask(next: string) {
    setTaskType(next);
    setChainSteps(chainStepsFor(next, fallbackChains));
    setChainMessage("");
  }

  async function createKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const response = await fetch("/api/admin/llm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: data.get("provider"),
          displayName: data.get("displayName"),
          apiKey: data.get("apiKey"),
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setMessage(payload?.error ?? "驗證失敗，請稍後再試");
        return;
      }
      form.reset();
      setMessage("金鑰已驗證並加密儲存");
      await Promise.all([reload(), reloadModels()]);
    } catch {
      setMessage("無法連線至伺服器，請確認網路後再試");
    } finally {
      setPending(false);
    }
  }

  async function validate(keyId: string, displayName: string) {
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/llm/validate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ keyId }),
      });
      const payload = await response.json().catch(() => null) as { models?: string[]; error?: string } | null;
      if (response.ok) {
        const count = payload?.models?.length ?? 0;
        setMessage(`「${displayName}」驗證成功 ✓（${new Date().toLocaleTimeString("zh-Hant", { hour12: false })}），provider 回報 ${count} 個可用模型，下方模型清單已更新`);
        await Promise.all([reload(), reloadModels()]);
      } else {
        setMessage(`「${displayName}」驗證失敗：${payload?.error ?? "請稍後再試"}`);
        await reload();
      }
    } catch {
      setMessage("無法連線至伺服器，請確認網路後再試");
    } finally {
      setPending(false);
    }
  }

  async function deactivate(keyId: string, displayName: string) {
    if (!confirm(`確定停用金鑰「${displayName}」？停用後將不再用於內容分析。`)) return;
    setPending(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/llm/${keyId}`, { method: "DELETE" });
      const payload = await response.json().catch(() => null);
      setMessage(response.ok ? "金鑰已停用" : (payload?.error ?? "停用失敗，請稍後再試"));
      await Promise.all([reload(), reloadModels()]);
    } catch {
      setMessage("無法連線至伺服器，請確認網路後再試");
    } finally {
      setPending(false);
    }
  }

  async function saveFallback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setChainPending(true);
    setChainMessage("");
    const selected = chainSteps.filter(Boolean);
    if (new Set(selected).size !== selected.length) {
      setChainMessage("備援清單中有重複的模型，請個別選擇不同的模型");
      setChainPending(false);
      return;
    }
    const chain = selected.map((value) => {
      const separator = value.indexOf(":");
      return { provider: value.slice(0, separator), modelId: value.slice(separator + 1) };
    });
    try {
      const response = await fetch("/api/admin/llm/fallback", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ taskType, chain }),
      });
      const payload = await response.json().catch(() => null);
      if (response.ok) { setChainMessage("備援模型順序已更新"); await reload(); }
      else setChainMessage(payload?.error ?? "更新失敗，請稍後再試");
    } catch {
      setChainMessage("無法連線至伺服器，請確認網路後再試");
    } finally {
      setChainPending(false);
    }
  }

  const availableValues = new Set(modelGroups.flatMap((group) => group.models.map((model) => `${group.provider}:${model}`)));
  const hasModels = modelGroups.length > 0;

  return (
    <main className={styles.shell}>
      <header><p>LLM / <Tip label="BYOK" text="Bring Your Own Key：使用你自己申請的 AI 服務金鑰（而非平台代管），金鑰只會加密後儲存，用於呼叫該 Provider 的 API 進行內容分析。"/></p><h1>模型與金鑰</h1><span>只有 owner 可以檢視或修改此頁。</span></header>
      <section className={styles.panel} aria-labelledby="credentials-title">
        <h2 id="credentials-title">Provider 金鑰</h2>
        <div className={styles.providerSummary}>
          {Object.entries(PROVIDER_LABELS).map(([provider, label]) => {
            const providerKeys = keys.filter((key) => key.provider === provider);
            const hasValid = providerKeys.some((key) => key.validationStatus === "valid");
            return (
              <span key={provider} className={`${styles.providerBadge} ${providerKeys.length ? styles.providerBadgeActive : ""}`}>
                {label}：{providerKeys.length ? `已設定 ${providerKeys.length} 組${hasValid ? "" : "（待驗證）"}` : "尚未設定"}
              </span>
            );
          })}
        </div>
        <form className={styles.form} onSubmit={createKey}>
          <select name="provider" aria-label="Provider" required defaultValue="openai">
            <option value="openai">OpenAI</option><option value="gemini">Gemini</option>
            <option value="anthropic">Anthropic</option><option value="openrouter">OpenRouter</option>
          </select>
          <input name="displayName" placeholder="顯示名稱" maxLength={100} required />
          <input name="apiKey" type="password" autoComplete="off" placeholder="API key" required />
          <button disabled={pending}>{pending ? "驗證中…" : "驗證並儲存"}</button>
        </form>
        <p role="status" className={styles.status}>{message}</p>
        {keys.length === 0 ? <p>尚未設定金鑰。</p> : (
          <ul className={styles.keys}>{keys.map((key) => (
            <li key={key.id}>
              <div>
                <strong>{key.displayName}</strong>
                <span>{PROVIDER_LABELS[key.provider] ?? key.provider} · {key.maskedKey}{key.lastValidatedAt ? ` · 上次驗證 ${validatedAtLabel(key.lastValidatedAt)}` : ""}</span>
                {key.validationStatus === "invalid" && key.validationError ? <span role="alert">驗證失敗原因：{key.validationError}</span> : null}
              </div>
              <span>{key.validationStatus === "valid" ? "有效" : key.validationStatus === "invalid" ? "無效" : "待驗證"}</span>
              <button type="button" disabled={pending} onClick={() => void validate(key.id, key.displayName)}>{pending ? "處理中…" : "重新驗證"}</button>
              <button type="button" disabled={pending} onClick={() => void deactivate(key.id, key.displayName)}>{pending ? "處理中…" : "停用"}</button>
            </li>
          ))}</ul>
        )}
      </section>
      <section className={styles.panel} aria-labelledby="fallback-title">
        <h2 id="fallback-title"><Tip label="備援模型順序" text="當主要模型呼叫失敗或逾時，系統會依序改用清單中的下一個模型；由上到下即為改用順序。"/></h2>
        <form className={styles.form} onSubmit={saveFallback}>
          <select aria-label="任務類型" value={taskType} onChange={(event) => selectTask(event.target.value)}>
            {TASKS.map((task) => <option key={task.value} value={task.value}>{task.label}</option>)}
          </select>
          <div className={styles.chainGrid}>
            {ROW_LABELS.map((rowLabel, index) => {
              const value = chainSteps[index] ?? "";
              const stale = value && !availableValues.has(value) ? value : "";
              return (
                <label className={styles.chainRow} key={rowLabel}>
                  {rowLabel}
                  <select
                    aria-label={rowLabel}
                    value={value}
                    required={index === 0}
                    disabled={chainPending || !hasModels}
                    onChange={(event) => setChainSteps((prev) => { const next = [...prev]; next[index] = event.target.value; return next; })}
                  >
                    <option value="" disabled={index === 0}>{index === 0 ? "請選擇模型" : "（不使用）"}</option>
                    {stale ? <option value={stale}>⚠️ {PROVIDER_LABELS[stale.split(":")[0]] ?? stale.split(":")[0]} | {stale.slice(stale.indexOf(":") + 1)}（金鑰可能已停用或模型已下架）</option> : null}
                    {modelGroups.map((group) => (
                      <optgroup label={group.label} key={group.provider}>
                        {group.models.map((model) => <option key={model} value={`${group.provider}:${model}`}>{group.label} | {model}</option>)}
                      </optgroup>
                    ))}
                  </select>
                </label>
              );
            })}
          </div>
          {modelsLoading ? <p>正在載入可用模型…</p> : null}
          {!modelsLoading && modelsError ? <p role="alert">{modelsError} <button type="button" onClick={() => void reloadModels()}>重試</button></p> : null}
          {!modelsLoading && !modelsError && !hasModels ? <p>尚無可用的模型，請先在上方新增並驗證至少一組 API 金鑰。</p> : null}
          <button disabled={chainPending || !hasModels}>{chainPending ? "儲存中…" : "儲存備援順序"}</button>
        </form>
        <p role="status" className={styles.status}>{chainMessage}</p>
      </section>
    </main>
  );
}
