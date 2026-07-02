# Tasks.md — 多 Agent 任務清單

## Implementation status

截至 2026-07-03，T00-01 至 T05-04 的 MVP 開發範圍均已實作。Phase 3
包含公開 digest、完整篩選、詳情／匿名測驗、搜尋與按需學習指引；Phase 4
包含持久化 auth／RBAC、AES-256-GCM BYOK 與可操作的管理後台；Phase 5
包含 20 筆 demo seed、CI、部署／維運文件與離線 E2E／worker integration。

Release gate：Web 30 tests、E2E 4 flows、shared 5 tests、worker 52 tests、
Ruff、Prisma migration/demo seed validation、workspace typecheck 與 Next.js
production build 全數通過。Vercel、Neon 與 GitHub production 資源仍需由部署者
提供帳號與 secrets 後依 `Deployment.md` 套用；repository 不保存任何真實憑證。

## 1. 任務格式

每個任務包含：

- Task ID
- Owner Agent
- Goal
- Allowed Paths
- Inputs
- Outputs
- Dependencies
- Acceptance Criteria
- Test Command
- Risk Notes

## 2. Agent 分工總覽

| Agent | 角色 | 主要目錄 |
|---|---|---|
| Agent 0 | Repo Auditor / Integrator | 全域，只做規劃、檢查、整合 PR |
| Agent 1 | Database Agent | `packages/db/**`, `docs/DataModel.md` |
| Agent 2 | YouTube Ingestion Agent | `workers/ingestion/**/sources/youtube.py`, `workers/ingestion/tests/**` |
| Agent 3 | Scoring Agent | `workers/ingestion/**/scoring/**`, `packages/shared/**` |
| Agent 4 | LLM Agent | `workers/ingestion/**/llm/**`, `docs/PromptTemplates.md` |
| Agent 5 | Worker Pipeline Agent | `workers/ingestion/**/pipelines/**`, `.github/workflows/ingest-daily.yml` |
| Agent 6 | Public Web Agent | `apps/web/app/**`, `apps/web/components/public/**` |
| Agent 7 | Admin Web Agent | `apps/web/app/admin/**`, `apps/web/components/admin/**` |
| Agent 8 | Auth & Security Agent | `apps/web/server/auth/**`, `apps/web/server/crypto/**` |
| Agent 9 | QA Agent | `apps/web/tests/**`, `workers/ingestion/tests/**`, `.github/workflows/ci-*.yml` |
| Agent 10 | Docs Agent | `docs/**`, `README.md` |

## 3. 開發階段

### Phase 0 — Repo Audit and Bootstrap

目標：盤點原專案，建立 monorepo、CI、基本文件與開發規範。

### Phase 1 — Database and Contracts

目標：先固定資料模型、API contract、shared schema，避免多 Agent 互相阻塞。

### Phase 2 — Worker MVP

目標：YouTube 搜尋、metadata、transcript、LLM、score、snapshot 全流程可 dry-run。

### Phase 3 — Public Dashboard

目標：首頁、詳情頁、搜尋頁、測驗互動。

### Phase 4 — Admin Console

目標：管理登入、設定、主題、頻道、內容、LLM keys、run logs。

### Phase 5 — Deployment and QA

目標：Vercel + Neon + GitHub Actions 部署、測試、監控與 runbook。

## 4. Phase 0 Tasks

### T00-01 — Repository audit

- Owner Agent: Agent 0
- Goal: 分析 fork 後的 VideoDigestAgent 既有檔案，決定哪些邏輯可重用。
- Allowed Paths: `docs/repo-audit.md`, `legacy/**`
- Inputs: 原始 repository
- Outputs: `docs/repo-audit.md`
- Dependencies: none
- Acceptance Criteria:
  - 列出原始檔案功能。
  - 標示可重用、需重寫、需刪除的模組。
  - 列出 migration risk。
- Test Command: none
- Risk Notes: 不要在 audit 任務修改原始功能。

### T00-02 — Monorepo bootstrap

- Owner Agent: Agent 0
- Goal: 建立建議目錄結構與基本 package scaffolding。
- Allowed Paths: `apps/**`, `workers/**`, `packages/**`, `.github/**`, `docs/**`
- Inputs: `Architecture.md`
- Outputs: monorepo skeleton
- Dependencies: T00-01
- Acceptance Criteria:
  - `apps/web` 可安裝依賴。
  - `workers/ingestion` 可執行空 CLI。
  - `packages/db` 有 migration 入口。
  - CI skeleton 存在。
- Test Command:
  - `cd apps/web && npm test`
  - `cd workers/ingestion && pytest`
- Risk Notes: 不要一次塞入大量功能。

## 5. Phase 1 Tasks — Database and Contracts

### T01-01 — PostgreSQL schema migration

- Owner Agent: Agent 1
- Goal: 根據 `DataModel.md` 建立 Prisma schema 或 SQL migrations。
- Allowed Paths: `packages/db/**`
- Inputs: `docs/DataModel.md`
- Outputs: migration files, seed script
- Dependencies: T00-02
- Acceptance Criteria:
  - 所有 MVP tables 建立完成。
  - 有 seed topic「人工智慧」。
  - 有 seed admin owner 建立方式。
  - 支援 unique constraint：`source_type + source_content_id`。
- Test Command:
  - `cd packages/db && npm run db:migrate:test`
  - `cd packages/db && npm run db:seed:test`
- Risk Notes: migration 合併後不要隨意改已套用 migration，新增 migration 修正。

### T01-02 — Shared TypeScript schemas

- Owner Agent: Agent 1
- Goal: 建立前端與 API 使用的 Zod schemas。
- Allowed Paths: `packages/shared/**`, `apps/web/lib/schemas/**`
- Inputs: `SPEC.md`, `DataModel.md`
- Outputs: Zod types
- Dependencies: T01-01
- Acceptance Criteria:
  - Public digest item schema。
  - Content detail schema。
  - Admin settings schema。
  - Topic schema。
  - Quiz schema。
- Test Command: `cd apps/web && npm run typecheck`
- Risk Notes: schema 名稱應穩定，避免後續 Agent 大量修改。

### T01-03 — Python pydantic schemas

- Owner Agent: Agent 4
- Goal: 建立 worker 端 LLM JSON 輸出與 pipeline data models。
- Allowed Paths: `workers/ingestion/**/llm/schemas.py`, `workers/ingestion/tests/**`
- Inputs: `PromptTemplates.md`, `SPEC.md`
- Outputs: pydantic models
- Dependencies: T00-02
- Acceptance Criteria:
  - classifier schema。
  - summary schema。
  - quiz schema。
  - learning path schema。
  - validation failure test。
- Test Command: `cd workers/ingestion && pytest tests/test_llm_schemas.py`
- Risk Notes: schema 改動需同步 PromptTemplates。

## 6. Phase 2 Tasks — Worker MVP

### T02-01 — YouTube source adapter

- Owner Agent: Agent 2
- Goal: 實作 YouTube search/list/channel metadata adapter。
- Allowed Paths: `workers/ingestion/**/sources/youtube.py`, `workers/ingestion/tests/**`
- Inputs: YouTube Data API key, `SPEC.md`
- Outputs: YouTube adapter
- Dependencies: T01-03
- Acceptance Criteria:
  - 支援 query search。
  - 支援 videos.list 批次 metadata。
  - 支援 channels.list 批次 metadata。
  - 支援 quota/log instrumentation。
  - 測試使用 mock HTTP，不打真 API。
- Test Command: `cd workers/ingestion && pytest tests/test_youtube_adapter.py`
- Risk Notes: 不要把 API key 寫入程式或測試 fixture。

### T02-02 — Query expansion

- Owner Agent: Agent 2
- Goal: 根據 topic keywords 產生台灣/中國/英文同義 query。
- Allowed Paths: `workers/ingestion/**/sources/query_expansion.py`, `workers/ingestion/tests/**`
- Inputs: topic keywords
- Outputs: query expansion module
- Dependencies: T01-01
- Acceptance Criteria:
  - 支援 positive/negative/synonym/tw_term/cn_term/english。
  - 可限制 max queries per topic。
  - 對 AI 預設子題有測試 fixture。
- Test Command: `cd workers/ingestion && pytest tests/test_query_expansion.py`
- Risk Notes: Query 過多會消耗 quota，需有上限。

### T02-03 — Transcript adapter

- Owner Agent: Agent 2
- Goal: 實作 YouTube transcript 取得與語言優先序。
- Allowed Paths: `workers/ingestion/**/transcripts/**`, `workers/ingestion/tests/**`
- Inputs: `SPEC.md`
- Outputs: transcript adapter
- Dependencies: T02-01
- Acceptance Criteria:
  - 語言優先序：zh-Hant > zh-TW > zh > zh-Hans > zh-CN。
  - transcript unavailable 時回傳 typed error。
  - normalize transcript 並產生 hash。
- Test Command: `cd workers/ingestion && pytest tests/test_transcript_adapter.py`
- Risk Notes: 非官方套件可能不穩，需封裝並隔離錯誤。

### T02-04 — Scoring engine

- Owner Agent: Agent 3
- Goal: 實作 engagement_score、fresh_engagement_score、comment_signal、radar_score。
- Allowed Paths: `workers/ingestion/**/scoring/**`, `workers/ingestion/tests/**`
- Inputs: `SPEC.md`
- Outputs: scoring module
- Dependencies: T01-03
- Acceptance Criteria:
  - age_days 最小值為 1。
  - view_count 為 0 不除以 0。
  - 支援推薦頻道 boost 與黑名單 penalty。
  - 有 snapshot ranking test。
- Test Command: `cd workers/ingestion && pytest tests/test_scoring.py`
- Risk Notes: 不要把排序公式硬寫死在 UI；需由 DB 設定讀取。

### T02-05 — LLM provider abstraction

- Owner Agent: Agent 4
- Goal: 實作 OpenAI、Gemini、Anthropic、OpenRouter provider adapter 介面與 mock。
- Allowed Paths: `workers/ingestion/**/llm/**`, `workers/ingestion/tests/**`
- Inputs: `PromptTemplates.md`
- Outputs: provider interfaces and adapters
- Dependencies: T01-03
- Acceptance Criteria:
  - validate_key。
  - list_models。
  - generate_json。
  - fallback chain。
  - token/cost logging interface。
  - mock provider 支援測試。
- Test Command: `cd workers/ingestion && pytest tests/test_llm_providers.py`
- Risk Notes: 不要在單元測試呼叫真 LLM。

### T02-06 — LLM tasks

- Owner Agent: Agent 4
- Goal: 實作 classify、summarize、quiz、learning_path task。
- Allowed Paths: `workers/ingestion/**/llm/**`, `workers/ingestion/tests/**`
- Inputs: `PromptTemplates.md`, T02-05
- Outputs: task runners
- Dependencies: T02-05
- Acceptance Criteria:
  - 每個任務產生 JSON。
  - pydantic validation。
  - schema fail 自動 repair 一次。
  - prompt version 存入結果。
- Test Command: `cd workers/ingestion && pytest tests/test_llm_tasks.py`
- Risk Notes: prompt 變更需更新版本。

### T02-07 — Postgres repository for worker

- Owner Agent: Agent 5
- Goal: 實作 worker DB repository layer。
- Allowed Paths: `workers/ingestion/**/repositories/**`, `workers/ingestion/tests/**`
- Inputs: `DataModel.md`
- Outputs: repository methods
- Dependencies: T01-01
- Acceptance Criteria:
  - upsert content。
  - upsert channel。
  - save transcript。
  - save summary。
  - save quiz。
  - save score。
  - save snapshot。
  - save run log。
- Test Command: `cd workers/ingestion && pytest tests/test_repositories.py`
- Risk Notes: 所有寫入需 transaction-safe。

### T02-08 — Daily digest pipeline

- Owner Agent: Agent 5
- Goal: 串接 YouTube、transcript、LLM、scoring、repository。
- Allowed Paths: `workers/ingestion/**/pipelines/**`, `workers/ingestion/**/cli.py`, `workers/ingestion/tests/**`
- Inputs: T02-01 to T02-07
- Outputs: daily pipeline
- Dependencies: T02-01, T02-03, T02-04, T02-06, T02-07
- Acceptance Criteria:
  - `daily --dry-run` 可執行。
  - `test-video --url` 可處理單支影片。
  - 每個 phase 都有 run event。
  - 支援 topic-id。
- Test Command: `cd workers/ingestion && pytest tests/test_daily_pipeline.py`
- Risk Notes: Pipeline 需可部分失敗，不能一支影片失敗就整批中斷。

### T02-09 — GitHub Actions daily workflow

- Owner Agent: Agent 5
- Goal: 建立每日排程與手動觸發 worker workflow。
- Allowed Paths: `.github/workflows/ingest-daily.yml`, `Deployment.md`
- Inputs: T02-08
- Outputs: workflow
- Dependencies: T02-08
- Acceptance Criteria:
  - 支援 schedule。
  - 支援 workflow_dispatch。
  - 使用 GitHub secrets。
  - 執行 pytest smoke test 後才跑 worker。
- Test Command: `gh workflow run ingest-daily.yml` 或 GitHub UI 手動觸發
- Risk Notes: schedule 時區為 UTC，文件需換算台灣時間。

## 7. Phase 3 Tasks — Public Web

### T03-01 — Web app shell

- Owner Agent: Agent 6
- Goal: 建立 Next.js app layout、導航、RWD 基礎。
- Allowed Paths: `apps/web/app/**`, `apps/web/components/public/**`, `apps/web/styles/**`
- Inputs: `PRD.md`, `SPEC.md`
- Outputs: app shell
- Dependencies: T01-02
- Acceptance Criteria:
  - 首頁 layout 可顯示 mock cards。
  - 繁體中文 UI。
  - RWD 4/2/1 欄。
- Test Command: `cd apps/web && npm run test && npm run typecheck`
- Risk Notes: 不要碰 admin 目錄。

### T03-02 — Public digest API

- Owner Agent: Agent 6
- Goal: 實作公開 digest API 與 DB query。
- Allowed Paths: `apps/web/app/api/public/**`, `apps/web/server/public/**`
- Inputs: T01-01, T01-02
- Outputs: `/api/public/digest`
- Dependencies: T01-02
- Acceptance Criteria:
  - 支援 topic/date/sort/filters。
  - 回傳 schema valid JSON。
  - 空結果處理。
- Test Command: `cd apps/web && npm run test -- public-digest`
- Risk Notes: Public API 不回傳 admin-only 欄位，例如 difficulty_reason。

### T03-03 — Dashboard cards

- Owner Agent: Agent 6
- Goal: 實作影片卡片與篩選 UI。
- Allowed Paths: `apps/web/components/public/**`, `apps/web/app/page.tsx`
- Inputs: T03-02
- Outputs: dashboard
- Dependencies: T03-02
- Acceptance Criteria:
  - 顯示完整 card 欄位。
  - 「參與度分數」中文顯示。
  - 入門標籤只在 beginner 顯示。
  - YouTube 連結開新分頁。
- Test Command: `cd apps/web && npm run test -- dashboard`
- Risk Notes: 注意 metadata 缺值 fallback。

### T03-04 — Content detail and quiz UI

- Owner Agent: Agent 6
- Goal: 實作詳情頁與匿名測驗。
- Allowed Paths: `apps/web/app/content/**`, `apps/web/components/public/quiz/**`
- Inputs: T01-02, T03-02
- Outputs: detail page
- Dependencies: T03-02
- Acceptance Criteria:
  - 可顯示完整摘要、學習目標、tags、quiz。
  - 作答後顯示解析。
  - 不呼叫 API 保存作答結果。
- Test Command: `cd apps/web && npm run test -- quiz`
- Risk Notes: 答案不要在未作答前視覺暴露，但 HTML 中仍可能存在；MVP 可接受。

### T03-05 — Search page and learning path API

- Owner Agent: Agent 6 + Agent 4
- Goal: 實作搜尋頁與學習指引生成。
- Allowed Paths: `apps/web/app/search/**`, `apps/web/app/api/public/learning-path/**`, `workers/ingestion/**/llm/**`
- Inputs: T02-06, T03-02
- Outputs: search page
- Dependencies: T02-06, T03-02
- Acceptance Criteria:
  - 搜尋 title/summary/tags。
  - 有產生學習指引按鈕。
  - 學習指引只使用搜尋結果內容。
- Test Command: `cd apps/web && npm run test -- search`
- Risk Notes: LLM 成本需透過按鈕觸發，不自動觸發。

## 8. Phase 4 Tasks — Admin Console

### T04-01 — Admin auth

- Owner Agent: Agent 8
- Goal: 實作管理者登入、session、role guard。
- Allowed Paths: `apps/web/server/auth/**`, `apps/web/app/admin/login/**`, `apps/web/middleware.ts`
- Inputs: T01-01
- Outputs: auth system
- Dependencies: T01-01
- Acceptance Criteria:
  - owner/admin/editor/viewer role。
  - 未登入不得進入 admin。
  - 密碼 hash。
  - session cookie secure settings。
- Test Command: `cd apps/web && npm run test -- auth`
- Risk Notes: 不要輸出 password hash 或 secret 到 log。

### T04-02 — Admin layout

- Owner Agent: Agent 7
- Goal: 建立 admin navigation 與頁面框架。
- Allowed Paths: `apps/web/app/admin/**`, `apps/web/components/admin/**`
- Inputs: T04-01
- Outputs: admin shell
- Dependencies: T04-01
- Acceptance Criteria:
  - Dashboard / Content / Topics / Channels / Settings / LLM / Admins / Runs nav。
  - role-based menu visibility。
- Test Command: `cd apps/web && npm run test -- admin-layout`
- Risk Notes: 不要實作 auth 內部邏輯。

### T04-03 — Topic and keyword admin

- Owner Agent: Agent 7
- Goal: 主題、關鍵字、排除關鍵字管理。
- Allowed Paths: `apps/web/app/admin/topics/**`, `apps/web/app/api/admin/topics/**`
- Inputs: T01-02, T04-01
- Outputs: topic admin
- Dependencies: T04-01
- Acceptance Criteria:
  - CRUD topics。
  - CRUD keywords。
  - tw/cn/english keyword types。
  - audit log。
- Test Command: `cd apps/web && npm run test -- admin-topics`
- Risk Notes: 刪除 topic 前需檢查依賴或採 soft disable。

### T04-04 — Settings admin

- Owner Agent: Agent 7
- Goal: 管理搜尋、排名、影片長度、freshness、Top N 等設定。
- Allowed Paths: `apps/web/app/admin/settings/**`, `apps/web/app/api/admin/settings/**`
- Inputs: T01-02, T04-01
- Outputs: settings admin
- Dependencies: T04-01
- Acceptance Criteria:
  - 可修改 PRD 中列出設定。
  - 表單驗證。
  - audit log。
- Test Command: `cd apps/web && npm run test -- admin-settings`
- Risk Notes: 設定值需有上下限，避免 quota 爆量。

### T04-05 — Channel admin

- Owner Agent: Agent 7
- Goal: 推薦頻道與黑名單頻道管理。
- Allowed Paths: `apps/web/app/admin/channels/**`, `apps/web/app/api/admin/channels/**`
- Inputs: T01-02, T04-01
- Outputs: channels admin
- Dependencies: T04-01
- Acceptance Criteria:
  - 新增推薦頻道。
  - 新增黑名單。
  - 設定權重。
  - 顯示推薦理由。
  - audit log。
- Test Command: `cd apps/web && npm run test -- admin-channels`
- Risk Notes: 同一頻道不可同時 recommended 與 blacklisted。

### T04-06 — LLM key management

- Owner Agent: Agent 8
- Goal: BYOK 加密儲存、驗證 key、列出模型。
- Allowed Paths: `apps/web/server/crypto/**`, `apps/web/app/admin/llm/**`, `apps/web/app/api/admin/llm/**`
- Inputs: `Architecture.md`, `PRD.md`
- Outputs: llm key admin
- Dependencies: T04-01
- Acceptance Criteria:
  - key encrypted at rest。
  - UI 只顯示 masked key。
  - validate key。
  - list models。
  - fallback chain 設定。
  - audit log。
- Test Command: `cd apps/web && npm run test -- admin-llm`
- Risk Notes: `APP_SECRET_KEY` 不可進 DB，不可進 log。

### T04-07 — Content admin

- Owner Agent: Agent 7
- Goal: 內容管理、手動新增、刪除、隱藏、覆寫摘要/難度/tags。
- Allowed Paths: `apps/web/app/admin/content/**`, `apps/web/app/api/admin/content/**`
- Inputs: T04-01, T03-02
- Outputs: content admin
- Dependencies: T04-01, T03-02
- Acceptance Criteria:
  - list/search content。
  - edit metadata。
  - override difficulty。
  - hide/delete content。
  - manual add YouTube URL。
  - audit log。
- Test Command: `cd apps/web && npm run test -- admin-content`
- Risk Notes: 刪除採 soft delete。

### T04-08 — Run logs admin

- Owner Agent: Agent 7
- Goal: 顯示 agent run 與 event log。
- Allowed Paths: `apps/web/app/admin/runs/**`, `apps/web/app/api/admin/runs/**`
- Inputs: T02-08, T04-01
- Outputs: run logs UI
- Dependencies: T02-08, T04-01
- Acceptance Criteria:
  - 顯示 run list。
  - 顯示 phase statistics。
  - 顯示 failed events。
  - 支援手動觸發 run。
- Test Command: `cd apps/web && npm run test -- admin-runs`
- Risk Notes: 手動觸發需 rate limit。

## 9. Phase 5 Tasks — QA and Deployment

### T05-01 — CI pipelines

- Owner Agent: Agent 9
- Goal: Web/Worker/DB CI。
- Allowed Paths: `.github/workflows/**`, `apps/web/**`, `workers/ingestion/**`
- Inputs: all tasks
- Outputs: CI workflows
- Dependencies: T02-08, T03-04, T04-08
- Acceptance Criteria:
  - web typecheck/test。
  - worker pytest/ruff。
  - migration test。
  - PR required checks documented。
- Test Command: GitHub Actions
- Risk Notes: CI 不應呼叫真 API。

### T05-02 — Deployment docs and scripts

- Owner Agent: Agent 10
- Goal: 完成部署文件與 env example。
- Allowed Paths: `Deployment.md`, `.env.example`, `apps/web/.env.example`, `workers/ingestion/.env.example`
- Inputs: `Architecture.md`
- Outputs: deployment guide
- Dependencies: T05-01
- Acceptance Criteria:
  - Vercel env。
  - Neon env。
  - GitHub Actions secrets。
  - manual run instructions。
- Test Command: none
- Risk Notes: 不要放真 secrets。

### T05-03 — Seed and demo data

- Owner Agent: Agent 1 + Agent 9
- Goal: 建立 demo seed 讓 UI 可預覽。
- Allowed Paths: `packages/db/seed/**`, `apps/web/tests/fixtures/**`
- Inputs: DataModel
- Outputs: seed script
- Dependencies: T01-01, T03-04
- Acceptance Criteria:
  - 20 筆 demo content。
  - 3 題 quiz。
  - tags、topics、scores 完整。
- Test Command: `cd packages/db && npm run db:seed:demo`
- Risk Notes: Demo URL 不要冒用不存在資料；可用假資料標示 fixture。

### T05-04 — End-to-end MVP verification

- Owner Agent: Agent 9
- Goal: 驗證完整 MVP。
- Allowed Paths: `apps/web/tests/e2e/**`, `workers/ingestion/tests/integration/**`
- Inputs: all features
- Outputs: E2E tests
- Dependencies: T05-01, T05-03
- Acceptance Criteria:
  - 首頁 Top 20。
  - 詳情頁 quiz。
  - 搜尋。
  - admin login。
  - 修改 topic settings。
  - run log 顯示。
- Test Command: `cd apps/web && npm run test:e2e`
- Risk Notes: E2E 使用 demo DB，不呼叫真 YouTube/LLM。

## 10. PR 規則

每個 Agent 提交 PR 時需包含：

- Task ID。
- 修改摘要。
- 修改目錄。
- 測試結果。
- 已知限制。
- 是否改變 DB schema / API contract / prompt version。

禁止：

- 未經任務授權修改其他 Agent 目錄。
- 將 API key、token、cookie 寫入 repo。
- 在測試中呼叫真 YouTube 或真 LLM，除非明確是 manual integration test。
- 大量格式化無關檔案。
- 修改已合併 migration，應新增 migration。
