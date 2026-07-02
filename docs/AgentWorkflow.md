# AgentWorkflow.md — 如何控制多 AI Agent 協作開發

## 1. 核心原則

多 Agent 開發的主要風險不是速度不夠，而是互相踩檔案、規格漂移、重複造輪子與測試失真。因此本專案採用「文件先行、目錄隔離、任務鎖定、PR 整合」模式。

## 2. 建議工具分工

| 工具 | 建議用途 |
|---|---|
| Codex | 實作明確、可測試的任務，例如 adapter、API、測試、資料轉換。 |
| Claude Code | 較適合大型重構、跨檔案理解、文件同步與架構檢查。 |
| Cursor | 適合 UI、互動式調整、局部重構與快速修 bug。 |
| GitHub Copilot | 適合在 IDE 中補齊局部程式碼、測試案例、型別與樣板。 |

不要同時讓多個 Agent 改同一組檔案。若必須跨目錄協作，先由 Integrator 拆成更小任務。

## 3. Branch 策略

每個任務一個 branch：

```text
agent/T02-01-youtube-source-adapter
agent/T02-04-scoring-engine
agent/T03-03-dashboard-cards
```

禁止多個 Agent 共用一個 branch。

## 4. 任務啟動 Prompt 模板

每次開新 Agent，使用以下模板：

```text
你正在開發 AI Learning Radar 專案。

請先閱讀以下文件：
- docs/PRD.md
- docs/Architecture.md
- docs/SPEC.md
- docs/Tasks.md

你的任務是：<貼上 Task ID 與內容>

你只能修改以下路徑：
<貼上 Allowed Paths>

不要修改其他路徑。不要重構無關檔案。不要加入真 API key。不要呼叫真外部 API，除非我明確要求做 manual integration test。

完成後請提供：
1. 修改摘要
2. 修改檔案清單
3. 測試命令與結果
4. 已知限制
5. 是否影響 DB schema / API contract / prompt version
```

## 5. Agent 執行規則

### 5.1 必須做

- 先讀任務與相關文件。
- 只改 Allowed Paths。
- 寫測試。
- 保留清楚錯誤處理。
- 使用 mock，不要在 CI 中打真 API。
- 新增 env var 時同步更新 `.env.example` 與 `Deployment.md`。
- 改 prompt 時同步更新 `PromptTemplates.md` 與 prompt version。
- 改 DB schema 時新增 migration，不改舊 migration。

### 5.2 禁止做

- 擅自改產品範圍。
- 擅自導入大型依賴。
- 擅自切換技術棧。
- 將 secrets 寫入程式碼、測試、log 或文件。
- 在 PR 中混入 unrelated formatting。
- 在沒有整合者同意下改 shared schema。

## 6. Integrator 工作

Agent 0 或人類負責 Integrator。

Integrator 每天做：

1. 檢查 open PR 是否修改越權目錄。
2. 檢查 DB migration 是否衝突。
3. 檢查 API contract 是否符合 `SPEC.md`。
4. 檢查 prompt version 是否同步。
5. 合併 PR 前執行 CI。
6. 合併後更新 `Tasks.md` 狀態。

## 7. 任務狀態追蹤

建議在 GitHub Issues 使用以下 labels：

```text
phase:0-bootstrap
phase:1-db-contracts
phase:2-worker
phase:3-public-web
phase:4-admin
phase:5-deployment
agent:database
agent:youtube
agent:llm
agent:web-public
agent:web-admin
agent:security
agent:qa
status:ready
status:blocked
status:in-progress
status:review
status:done
```

每個 Issue 需包含：

- Task ID。
- Allowed Paths。
- Dependencies。
- Acceptance Criteria。
- Test Command。

## 8. 目錄所有權

| 目錄 | Owner | 其他 Agent 修改規則 |
|---|---|---|
| `packages/db/**` | Agent 1 | 需 Agent 1 review |
| `workers/ingestion/**/sources/**` | Agent 2 | 不可改 scoring/llm |
| `workers/ingestion/**/scoring/**` | Agent 3 | 不可改 source adapters |
| `workers/ingestion/**/llm/**` | Agent 4 | prompt 變更需 Docs review |
| `workers/ingestion/**/pipelines/**` | Agent 5 | 可整合 adapters，但不改其內部邏輯 |
| `apps/web/components/public/**` | Agent 6 | 不可改 admin/auth |
| `apps/web/app/admin/**` | Agent 7 | 不可改 public/auth |
| `apps/web/server/auth/**` | Agent 8 | 需安全 review |
| `apps/web/server/crypto/**` | Agent 8 | 需安全 review |
| `tests/**` | Agent 9 | 可讀所有，修改測試需避免改業務邏輯 |
| `docs/**` | Agent 10 | 規格變更需 Integrator 同意 |

## 9. 衝突處理

如果兩個 Agent 都需要改同一檔案：

1. 停止其中一個任務。
2. 由 Integrator 拆出 shared contract task。
3. 先合併 contract。
4. 兩個 Agent rebase 後再繼續。

常見 shared contract：

- API response schema。
- DB migration。
- Prompt schema。
- Shared constants。

## 10. 對 Codex 的建議控制方式

### 10.1 小任務化

不要給 Codex「幫我做整個 Dashboard」。改成：

```text
請只完成 T03-03 Dashboard cards。
只能修改 apps/web/components/public/** 與 apps/web/app/page.tsx。
必須符合 SPEC.md 12.2 的卡片欄位。
```

### 10.2 明確驗收

給 Codex 的任務一定要包含：

- 測試命令。
- UI 欄位。
- 不可修改的目錄。
- 完成後需回報的項目。

### 10.3 要求 diff-aware

要求 Codex 完成後列出：

```text
git diff --stat
npm run typecheck
npm test
```

## 11. 對 Claude Code 的建議控制方式

Claude Code 適合：

- 將原始 VideoDigestAgent 抽象成 worker 模組。
- 檢查架構文件與實作是否一致。
- 寫 integration tests。
- 修複跨檔案 type mismatch。

Prompt 應加入：

```text
請不要大幅重構 unrelated files。若你發現需要改動超出 Allowed Paths，請先在回覆中提出，不要直接修改。
```

## 12. 對 Cursor 的建議控制方式

Cursor 適合 UI 細修：

- 卡片排版。
- 篩選器。
- 詳情頁 quiz 互動。
- Admin form。

建議在 Cursor 中選定檔案範圍，不要讓它全 repo apply。

## 13. 對 GitHub Copilot 的建議使用方式

Copilot 適合：

- 補 SQL query。
- 補 Zod schema。
- 補測試案例。
- 補 UI component props。

但不要讓 Copilot 自行決定資料模型或 API contract。

## 14. PR Review Checklist

每個 PR review 時檢查：

- [ ] 是否符合 Task Acceptance Criteria。
- [ ] 是否只修改 Allowed Paths。
- [ ] 是否有測試。
- [ ] 是否沒有 secrets。
- [ ] 是否沒有真 API call in CI。
- [ ] 是否有錯誤處理。
- [ ] 是否更新相關文件。
- [ ] 是否影響 DB schema。
- [ ] 是否影響 API contract。
- [ ] 是否影響 prompt version。

## 15. 推薦開發節奏

第一週：

- Repo audit。
- Monorepo bootstrap。
- DB schema。
- Worker adapters mock。

第二週：

- YouTube ingestion。
- Transcript。
- LLM mock + prompts。
- Scoring。
- Daily pipeline dry-run。

第三週：

- Public dashboard。
- Detail page。
- Quiz UI。
- Search。

第四週：

- Admin console。
- BYOK。
- Run logs。
- Deployment。
- E2E。

這是理想節奏，不是承諾時間。實際進度取決於 API、字幕可用性、LLM 穩定度與 UI 完成度。

