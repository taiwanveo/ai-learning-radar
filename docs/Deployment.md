# Deployment.md — 免費雲端部署建議

## 1. 建議 MVP 部署組合

```text
Frontend/Admin/API: Vercel Hobby
Database: Neon Free PostgreSQL
Daily Worker: GitHub Actions schedule + workflow_dispatch
Secrets: Vercel env vars + GitHub Actions secrets
```

這個組合的優點：

- 成本最低。
- 不需要常駐 Python server。
- Next.js Dashboard 部署簡單。
- Python worker 可每日排程執行。
- Neon 是 PostgreSQL，符合未來擴充需求。

限制：

- 免費方案不適合正式大量使用。
- Neon Free 儲存空間有限，transcript 會快速累積。
- GitHub Actions scheduled workflow 不保證精準秒級觸發。
- Vercel Hobby cron 每日一次限制可作備援，但 Python 長任務不建議直接跑在 Vercel function。

## 2. 環境變數

### 2.1 Web app — Vercel

```bash
DATABASE_URL=postgresql://...
APP_SECRET_KEY=<base64-encoded-exactly-32-byte-key>
ADMIN_SESSION_SECRET=<random-secret-at-least-32-characters>
# Optional: only required while running the database seed.
ADMIN_OWNER_EMAIL=owner@example.com
ADMIN_OWNER_NAME=Owner
ADMIN_OWNER_PASSWORD_HASH=<scrypt-hash-generated-by-web-cli>
```

若 Web API 需要驗證 GitHub Actions 手動觸發：

```bash
WORKER_TRIGGER_SECRET=<random-secret>
```

後台「手動觸發 Run」按鈕會呼叫 GitHub Actions `workflow_dispatch`，Web 端需要：

```bash
GITHUB_TOKEN=<PAT，需 repo 的 Actions write 權限>
GITHUB_REPOSITORY=<owner>/<repo>
# 選填，預設值如下：
# GITHUB_WORKFLOW_REF=main
# GITHUB_WORKFLOW_FILE=ingest-daily.yml
```

### 2.2 Worker — GitHub Actions secrets

```bash
DATABASE_URL=postgresql://...
APP_SECRET_KEY=<same-as-web>
YOUTUBE_API_KEY=...
WORKER_TRIGGER_SECRET=...
LLM_PROVIDER=openai
LLM_MODEL=<provider-model-id>
TRANSCRIPT_MODE=disabled
QUIZ_ENABLED=false
# Set only the selected provider's secret:
OPENAI_API_KEY=...
# GEMINI_API_KEY=...
# ANTHROPIC_API_KEY=...
# OPENROUTER_API_KEY=...
```

LLM API key 若採 BYOK，主要存在 DB encrypted，不一定放 GitHub secrets。但 worker 必須能透過 `APP_SECRET_KEY` 解密 DB 中的 key。

Phase 2 在 Admin/BYOK 尚未完成前，worker 使用上述 provider 環境變數。
完成 T04-06 後應優先改讀 DB 中的加密 key 與 fallback chain，環境變數僅保留為部署備援。

## 3. GitHub Actions 排程

範例：每天台灣時間早上 6 點執行。

GitHub Actions cron 使用 UTC，因此台灣時間 UTC+8 的 06:00 等於 UTC 22:00。

```yaml
name: Ingest Daily Videos

on:
  schedule:
    - cron: "0 22 * * *"
  workflow_dispatch:
    inputs:
      topic_id:
        description: "Optional topic ID"
        required: false
        type: string
      dry_run:
        description: "Dry run"
        required: false
        type: boolean
        default: false

jobs:
  ingest:
    runs-on: ubuntu-latest
    timeout-minutes: 60
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"
      - name: Install worker dependencies
        run: |
          cd workers/ingestion
          pip install -e .[dev]
      - name: Run worker tests
        run: |
          cd workers/ingestion
          pytest -q
      - name: Run daily ingestion
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          APP_SECRET_KEY: ${{ secrets.APP_SECRET_KEY }}
          YOUTUBE_API_KEY: ${{ secrets.YOUTUBE_API_KEY }}
        run: |
          cd workers/ingestion
          python -m ai_learning_radar_worker.cli daily
```

## 4. Vercel 部署

### 4.1 Build settings

```text
Root Directory: apps/web
Build Command: npm run build
Output: Next.js default
```

### 4.2 Production checklist

- [ ] `DATABASE_URL` 已設定。
- [ ] `APP_SECRET_KEY` 已設定。
- [ ] `ADMIN_SESSION_SECRET` 已設定。
- [ ] 第一位 owner admin 已建立。
- [ ] Admin login 只能 HTTPS 使用。
- [ ] Public pages 可匿名瀏覽。
- [ ] Admin API role guard 有測試。

## 5. Neon PostgreSQL

### 5.1 注意事項

- Free plan 空間有限，transcript 需監控。
- Compute scale-to-zero 可能造成第一次查詢較慢。
- 設定 connection pooling 或使用適合 serverless 的連線方式。

### 5.2 DB migration

建議在部署流程中手動執行 migration：

```bash
cd packages/db
npm run db:migrate:deploy
npm run db:seed
```

Owner seed values must be supplied together. The seed intentionally never
accepts or hashes a plaintext password. Generate the same memory-hard scrypt
format used by the web login without putting the password in shell history:

```bash
npm run admin:hash-password --workspace @ai-learning-radar/web
```

The CLI reads hidden stdin and prints only the hash. Pass that value as
`ADMIN_OWNER_PASSWORD_HASH`, then remove the three temporary owner variables
after seeding. Omitting them seeds only the default taxonomy and settings.

避免每次 Vercel build 自動執行 destructive migration。

### 5.3 Demo preview（非正式資料）

需要在 preview environment 驗證完整 Top 20、詳情與測驗時，可執行：

```bash
cd packages/db
npm run db:migrate:deploy
npm run db:seed:demo
```

這些紀錄的標題都以 `[DEMO]` 開頭，URL 使用 `example.com`，metadata 也標記
為 fixture。正式匯入完成後應移除 `source_type = 'manual'` 且
`source_content_id LIKE 'demo-ai-radar-%'` 的示範紀錄，避免與真實排名混用。

## 6. Transcript 與測驗階段

目前內部試用採 metadata-only 模式：

```text
TRANSCRIPT_MODE=disabled
QUIZ_ENABLED=false
```

此模式只使用 YouTube Data API 的標題、說明、頻道與統計資料進行分類、
排名及摘要，不呼叫 `youtube-transcript-api`，也不產生測驗。

若內部試用後決定啟用逐字稿與測驗，再設定
`TRANSCRIPT_MODE=required`、`QUIZ_ENABLED=true`，並提供可用的 transcript
網路路徑（例如 residential proxy）。逐字稿功能程式碼會保留，但目前不啟用。

## 7. BYOK 加密部署

`APP_SECRET_KEY` 必須：

- Web app 與 worker 相同。
- 不存 DB。
- 不寫入 log。
- 不 commit。
- 定期輪替。

若遺失 `APP_SECRET_KEY`，DB 中 encrypted API keys 將無法解密，需要管理者重新輸入。

## 8. 手動觸發 Worker

### 8.1 GitHub UI

1. 到 repository。
2. 點 Actions。
3. 選 Ingest Daily Videos。
4. 點 Run workflow。
5. 可選 topic_id 或 dry_run。

### 8.2 GitHub CLI

```bash
gh workflow run ingest-daily.yml -f topic_id=<topic_uuid> -f dry_run=false
```

### 8.3 管理後台

後台 `/admin/runs` 的「手動觸發 Run」會先建立 `queued` run，再以
`workflow_dispatch` 帶入 `run_id` 啟動 workflow；worker 以 `--run-id`
認領該筆紀錄並回寫執行結果。

## 9. Article ingestion 未來部署

第一版不實作文章 ingestion。若 Phase 2 要加入，建議使用 adapter 架構：

```text
ArticleSearchProvider:
  - FirecrawlSearchProvider
  - GoogleProgrammableSearchProvider
  - BraveSearchProvider
  - SerpApiProvider
  - SiteSpecificRssProvider
```

不建議直接使用 Bing Search API，因其已退役。若企業內部有 Azure AI Foundry 與 Grounding with Bing Search，可另開 enterprise adapter，但不應把它當一般 web search API 替代品。

## 10. 免費部署風險

| 項目 | 風險 | 建議 |
|---|---|---|
| Vercel Hobby | Function 時間與 cron 限制 | Web 放 Vercel，Worker 放 GitHub Actions |
| Neon Free | 空間小、scale-to-zero | 控制 transcript 保留，監控容量 |
| GitHub Actions | 私有 repo 有免費分鐘限制 | 控制每日執行次數與 timeout |
| YouTube API | search quota 限制 | 限制每主題 query 數，快取去重 |
| LLM BYOK | 成本不可控 | 顯示 token/cost logs，支援 fallback 與停用 |

## 11. 升級路線

當使用量超過免費方案：

1. DB 升級 Neon/Supabase paid plan。
2. Worker 改用 Cloud Run Jobs 或 Azure Container Apps Jobs。
3. Secrets 改用 KMS / Secret Manager。
4. Search 改用 Meilisearch / Typesense / Postgres full-text + trigram。
5. Transcript 改存 object storage。

## 12. Release verification

推送前在 repository root 執行與 CI 相同的檢查：

```bash
npm run typecheck
npm test
npm run build
.venv/bin/pytest workers/ingestion/tests -q
.venv/bin/ruff check workers/ingestion
```

Production branch 應要求 `Web CI / test`、`Worker CI / test`、
`Database CI / validate` 三項 checks 通過。測試環境不可放真實 YouTube 或 LLM key。
