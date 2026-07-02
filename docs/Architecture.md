# Architecture.md — AI Learning Radar 技術架構

## 1. 技術選型結論

建議採用：

```text
Next.js Dashboard/Admin + Python Ingestion Worker + PostgreSQL
```

理由：

1. 原始參考專案 VideoDigestAgent 是 Python agent pipeline，保留 Python worker 可降低重寫成本。
2. Dashboard 與後台需要較好的 UI、RWD、搜尋與互動體驗，Next.js 比 Flask/Jinja 更適合。
3. 免費部署上，Next.js 可放 Vercel，PostgreSQL 可用 Neon，Python worker 可由 GitHub Actions daily schedule 執行，不需要常駐後端。
4. 第一版沒有一般使用者登入與即時任務需求，不需要複雜 queue，也不需要長駐 worker。

## 2. 高階架構

```text
┌─────────────────────────────┐
│ Public Users                │
│ - Browse dashboard          │
│ - Search history            │
│ - Take anonymous quiz       │
└──────────────┬──────────────┘
               │ HTTPS
┌──────────────▼──────────────┐
│ Next.js Web App             │
│ apps/web                    │
│ - Public Dashboard          │
│ - Content Detail Page       │
│ - Search Page               │
│ - Admin Console             │
│ - API Routes / Server       │
└──────────────┬──────────────┘
               │ SQL / ORM
┌──────────────▼──────────────┐
│ PostgreSQL                  │
│ - content metadata          │
│ - transcripts               │
│ - summaries                 │
│ - quizzes                   │
│ - topics / settings         │
│ - admin users               │
│ - run logs                  │
└──────────────▲──────────────┘
               │ SQL
┌──────────────┴──────────────┐
│ Python Ingestion Worker     │
│ workers/ingestion           │
│ - YouTube search            │
│ - metadata enrichment       │
│ - transcript extraction     │
│ - scoring                   │
│ - LLM summary/quiz          │
│ - daily ranking snapshot    │
└──────────────┬──────────────┘
               │
     ┌─────────┼─────────┬───────────────┐
     │         │         │               │
┌────▼───┐ ┌───▼────┐ ┌──▼──────┐ ┌──────▼─────┐
│YouTube │ │LLM APIs│ │GitHub   │ │Future APIs │
│Data API│ │BYOK    │ │Actions  │ │Articles    │
└────────┘ └────────┘ └─────────┘ └────────────┘
```

## 3. Monorepo 目錄結構

建議將 fork 後的專案逐步整理成 monorepo：

```text
ai-learning-radar/
  apps/
    web/
      app/
      components/
      lib/
      server/
      styles/
      tests/
      package.json
  workers/
    ingestion/
      ai_learning_radar_worker/
        sources/
          youtube.py
          future_article.py
          future_bilibili.py
        transcripts/
          youtube_transcript.py
        scoring/
          ranking.py
          channel_trust.py
        llm/
          providers/
            openai_provider.py
            gemini_provider.py
            anthropic_provider.py
            openrouter_provider.py
          prompts.py
          schemas.py
        pipelines/
          daily_digest.py
          backfill.py
        repositories/
          postgres.py
        cli.py
      tests/
      pyproject.toml
  packages/
    db/
      prisma/
        schema.prisma
        migrations/
      seed/
    shared/
      constants/
      schemas/
  docs/
    PRD.md
    Architecture.md
    SPEC.md
    DataModel.md
    PromptTemplates.md
    Tasks.md
    AgentWorkflow.md
    Deployment.md
    Runbook.md
  .github/
    workflows/
      ingest-daily.yml
      ci-web.yml
      ci-worker.yml
  legacy/
    VideoDigestAgent/
      README.md
      app.py
      main.py
      youtube_monitor.py
      transcript_extractor.py
      summarizer.py
```

## 4. 從 VideoDigestAgent 改造策略

原專案已包含：

- YouTube channel 監控。
- YouTube keyword search。
- Transcript extraction。
- LLM summary。
- Web UI。
- CLI。
- Bilibili monitor。
- local history。
- email output。

本專案建議不要在原檔案上大量直接修改，而是採取「抽取可重用邏輯 + 新增資料庫驅動架構」：

1. 將原專案保留於 `legacy/VideoDigestAgent/`，避免多人 Agent 互相覆蓋。
2. 將 YouTube search、transcript extraction、LLM provider 相關邏輯逐步抽到 `workers/ingestion/`。
3. 移除 email output 作為主流程，改成寫入 PostgreSQL。
4. 原 local history 改為 `content_items`、`agent_runs`、`run_events`。
5. Flask Web UI 不作為第一版正式 UI；正式 UI 使用 Next.js。

## 5. 核心服務邊界

### 5.1 Next.js Web App

負責：

- 公開首頁。
- 歷史搜尋。
- 詳情頁。
- 匿名測驗互動。
- 管理後台。
- Admin authentication。
- API routes。
- 設定與內容管理。

不負責：

- 長時間 transcript 抽取。
- 大量 LLM 摘要。
- 大量 YouTube search。

### 5.2 Python Worker

負責：

- 每日搜尋。
- YouTube metadata enrichment。
- 字幕取得。
- 內容分類。
- 摘要。
- 測驗生成。
- 評分。
- 寫入 DB。
- Run log。

不負責：

- 公開網站 rendering。
- 管理者 session。
- UI 狀態。

### 5.3 PostgreSQL

負責：

- 所有持久化資料。
- 去重。
- 搜尋。
- 管理設定。
- 排名 snapshot。
- run log。

## 6. 資料流

### 6.1 Daily ingestion 流程

```text
1. GitHub Actions schedule 觸發 Python worker
2. Worker 讀取 PostgreSQL 中啟用的 topics 與 source settings
3. 對每個 topic 產生 query expansion
4. 呼叫 YouTube search.list 取得候選 videoId
5. 用 videos.list 批次取得 snippet/statistics/contentDetails
6. 排除 Shorts、過短、過長、過舊、黑名單頻道
7. upsert channel 與 content metadata
8. 取得 transcript，僅接受繁中/簡中/中文字幕
9. 呼叫 LLM 判斷是否教學影片與是否入門
10. 呼叫 LLM 產生摘要、適合對象、學習目標、tags
11. 呼叫 LLM 產生 3 題單選題
12. 計算 scores
13. 每個 topic 建立 daily ranking snapshot Top 20
14. 寫入 run log 與錯誤事件
```

### 6.2 公開 Dashboard 流程

```text
1. 使用者進入首頁
2. Next.js 從 PostgreSQL 讀取指定日期/主題的 daily snapshot
3. 依排序條件取得 Top 20 或篩選結果
4. 回傳 Server-rendered / cached HTML
5. 使用者點擊 YouTube 連結或詳情頁
6. 詳情頁從 DB 讀 summary、quiz、metadata
```

### 6.3 管理後台流程

```text
1. 管理者登入
2. 修改 topics / keywords / thresholds / providers / channels
3. Next.js API route 寫入 DB
4. 下一次 worker run 讀取新設定
5. 管理者可手動觸發 worker 或透過 GitHub Actions workflow_dispatch 執行
```

## 7. 第三方 API

### 7.1 YouTube Data API

使用：

- `search.list`：搜尋影片。
- `videos.list`：取得 snippet、statistics、contentDetails。
- `channels.list`：取得頻道 metadata 與 statistics。

必要欄位：

- videoId。
- title。
- description。
- thumbnails。
- channelId。
- channelTitle。
- publishedAt。
- duration。
- viewCount。
- likeCount。
- commentCount。

### 7.2 Transcript

第一版可使用非官方 transcript 套件，例如 `youtube-transcript-api`，但需封裝於 adapter 中，讓未來可替換。若字幕不可用，該影片標記為 `transcript_unavailable`，不進入摘要與 quiz 流程。

第一版不啟用 Whisper fallback。

### 7.3 LLM Providers

支援 adapter：

- OpenAI。
- Gemini。
- Anthropic。
- OpenRouter。

每個 adapter 需實作：

```python
class LLMProvider:
    def validate_key(self) -> ProviderValidationResult: ...
    def list_models(self) -> list[ModelInfo]: ...
    def generate_json(self, task: str, prompt: str, schema: dict) -> dict: ...
```

### 7.4 Future article ingestion

第一版不實作 article ingestion，但架構預留：

- `ArticleSourceAdapter.search(query, freshness_days)`
- `ArticleSourceAdapter.fetch(url)`
- `ArticleSourceAdapter.extract_main_content(url)`

建議未來優先順序：

1. Firecrawl Search/Scrape：用於取得 AI-ready markdown 與一般網頁內容。
2. Google Programmable Search / Custom Search JSON API：僅作為過渡或既有帳戶使用，不建議長期依賴。
3. 特定網站 RSS / sitemap / 官方 API：品質最好、穩定性最高。
4. Bing Search API：不建議使用，因官方已退役。

## 8. 部署架構

### 8.1 免費優先 MVP

```text
Vercel Hobby
  - Next.js web app
  - Admin API routes
  - Public dashboard

Neon Free PostgreSQL
  - Primary database

GitHub Actions
  - Daily Python worker
  - Manual workflow_dispatch

YouTube Data API
  - Video search and metadata

LLM Provider BYOK
  - OpenAI / Gemini / Anthropic / OpenRouter
```

### 8.2 為何不用 Render 免費 Postgres 作為主資料庫

Render 免費 Postgres 有到期限制，不適合作為需要累積歷史影片、摘要與測驗資料的主資料庫。Render 可作為測試用 web service，但 MVP 正式 demo 建議使用 Neon 或 Supabase 這類可長期保留資料的 PostgreSQL 服務。

### 8.3 備選部署

若未來要企業內部正式使用，建議：

- Web：Azure App Service / AWS Amplify / GCP Cloud Run / internal Kubernetes。
- Worker：Cloud Run Jobs / AWS ECS Scheduled Task / Azure Container Apps Jobs。
- DB：Managed PostgreSQL。
- Secrets：雲端 KMS 或企業 Secret Manager。

## 9. 安全設計

### 9.1 Admin authentication

第一版可用 Auth.js Credentials Provider 或自建 session：

- 密碼使用 Node.js 內建的 memory-hard scrypt（每筆獨立 salt）；CLI 從隱藏 stdin 產生 seed hash。
- Session cookie `HttpOnly`、`Secure`、`SameSite=Lax`。
- 管理者角色寫入 DB。
- 所有 admin API 檢查 role。

### 9.2 API Key 加密

BYOK keys 儲存在 DB 時必須加密。

建議：

- 使用 AES-256-GCM 或 libsodium sealed box。
- 加密主金鑰 `APP_SECRET_KEY` 放在 Vercel/GitHub Actions 環境變數。
- DB 只存 ciphertext、iv、tag、provider、masked_key、created_at。
- 後台只顯示 masked key，例如 `sk-...abcd`。
- 支援刪除與輪替。

限制：

- 免費雲端無 KMS，`APP_SECRET_KEY` 是單點風險。
- 企業正式版應改用 KMS 或 Secret Manager。

### 9.3 Audit log

管理後台以下行為需寫入 audit log：

- 新增/刪除/修改管理員。
- 新增/刪除/修改 API key。
- 修改主題與關鍵字。
- 修改推薦頻道與黑名單。
- 刪除內容。
- 手動覆寫 AI 判斷。
- 手動觸發 run。

### 9.4 Public content safety

- 公開頁不顯示完整 transcript。
- 摘要避免過長替代原影片。
- 影片全部連回 YouTube。
- 縮圖使用 YouTube thumbnail URL，不下載儲存。

## 10. Cache 與去重

### 10.1 去重 key

YouTube 影片以 `source_type = youtube` + `source_content_id = videoId` 唯一。

### 10.2 LLM cache

同一影片 transcript 沒變時，不重跑摘要與 quiz。可用：

```text
transcript_hash = sha256(normalized_transcript)
prompt_version = semantic version
model_id = selected model
```

若 transcript_hash、prompt_version、model_id 都相同，直接使用既有輸出。

### 10.3 Metadata refresh

觀看數、按讚數、留言數會變動。每日 run 對候選影片刷新 metadata。歷史影片可低頻刷新，例如每週一次或當影片再次入選候選時刷新。

## 11. 可觀測性

### 11.1 Run log

每次 worker run 產生：

- run_id。
- trigger type：scheduled / manual / backfill。
- start_time / end_time。
- status。
- topic count。
- candidate count。
- filtered count。
- summarized count。
- quiz generated count。
- failed count。
- YouTube API calls。
- LLM token usage。
- cost estimate。

### 11.2 Event log

每個失敗要記錄：

- phase。
- content_id。
- provider。
- error type。
- error message。
- retryable。
- stack trace，僅後台可見。

## 12. 開發技術建議

### 12.1 Web

- Next.js App Router。
- TypeScript。
- Tailwind CSS。
- shadcn/ui 或自訂 component。
- Prisma ORM。
- Zod validation。
- Auth.js 或自建 session。
- Vitest / Playwright。

### 12.2 Worker

- Python 3.11+。
- httpx。
- pydantic。
- SQLAlchemy 或 psycopg。
- Typer CLI。
- pytest。
- ruff。
- tenacity retry。
- python-dotenv。

### 12.3 DB

- PostgreSQL 16+。
- Prisma migrations 或 SQL migrations。
- pg_trgm extension for Chinese/English fuzzy search if supported。
- Full text search optional；中文搜尋可先用 trigram/ILIKE + tags，未來導入 Meilisearch 或 Typesense。

## 13. 重要設計取捨

| 議題 | 決策 | 理由 |
|---|---|---|
| Flask vs Next.js | Next.js + Python Worker | UI 與部署較好，保留 Python agent 能力 |
| 一般使用者登入 | MVP 不做 | 先驗證內容蒐集價值 |
| Admin 後台 | MVP 要做 | 需求中大量參數需後台調整 |
| 文章來源 | Phase 2 | YouTube 是核心，文章會擴大複雜度 |
| 無字幕影片 | MVP 不支援 | 避免 Whisper 成本與處理時間 |
| 排名公式 | 可配置 | AI 領域變動快，單一公式容易失效 |
| 免費部署 | Vercel + Neon + GitHub Actions | 成本最低，足夠 demo/MVP |
