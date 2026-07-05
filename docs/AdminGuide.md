# AI Learning Radar 管理後台使用說明書（Admin Guide）

本說明書提供給系統管理者，說明如何操作 `/admin` 管理後台（Admin Console）的
每一個功能區，以及常見問題的排解方式。閱讀對象為 owner、admin、editor、viewer
四種角色的後台使用者。

- 適用版本：v1.0
- 後台網址：`https://<your-domain>/admin`
- 介面語言：繁體中文

---

## 1. 登入與帳號

### 1.1 登入

1. 開啟 `/admin/login`。
2. 輸入 Email 與密碼（密碼至少 12 碼）。
3. 登入成功後會自動導向 `/admin` Dashboard。

登入 session 有效期為 **12 小時**，逾期需重新登入。未登入時開啟任何
`/admin/*` 頁面都會被導回登入頁。

### 1.2 建立第一個 owner 帳號

第一個 owner 帳號需在部署時用 seed 建立，且**不可**把明碼密碼留在
shell history：

```bash
npm run admin:hash-password --workspace @ai-learning-radar/web
ADMIN_OWNER_EMAIL=owner@example.com \
ADMIN_OWNER_NAME='Owner' \
ADMIN_OWNER_PASSWORD_HASH='<generated-scrypt-hash>' \
npm run db:seed --workspace @ai-learning-radar/db
```

### 1.3 角色與權限（Roles）

| 功能區 | owner | admin | editor | viewer |
|---|:-:|:-:|:-:|:-:|
| Dashboard | ✅ | ✅ | ✅ | ✅（唯讀） |
| Content | ✅ | ✅ | ✅ | 唯讀 |
| Topics | ✅ | ✅ | ✅ | 唯讀 |
| Channels | ✅ | ✅ | ✅ | 唯讀 |
| Settings | ✅ | ✅ | — | — |
| LLM（BYOK） | ✅ | ✅ | — | — |
| Admins | ✅ | — | — | — |
| Runs | ✅ | ✅ | ✅ | 唯讀 |

viewer 看得到列表但不會出現任何寫入按鈕。沒有權限的功能區不會出現在左側選單。

### 1.4 登出

呼叫 `POST /api/admin/auth/logout`（介面上的登出動作），session 會立即失效。

---

## 2. Dashboard（總覽）

進入 `/admin` 後可看到：

- **有效內容**：目前未刪除的內容總數。
- **啟用主題**：`isActive` 的主題數。
- **頻道規則**：推薦與黑名單頻道規則數。
- **最近執行**：最新一次 pipeline run 的狀態與開始時間。

---

## 3. Content（內容管理）

路徑：`/admin/content`

### 3.1 搜尋內容

輸入標題或頻道名稱的關鍵字後按「搜尋」，比對範圍是標題與頻道名稱。

### 3.2 手動新增 YouTube 影片

填寫表單「手動新增 YouTube」：

| 欄位 | 說明 |
|---|---|
| 影片網址 | 完整 YouTube URL，例如 `https://www.youtube.com/watch?v=…` |
| 標題 | 影片標題（可自訂覆寫） |
| Topic UUID（選填） | 要掛到哪個主題底下，可留空 |
| 立即發布 | 勾選後直接以 `published` 狀態顯示在前台 |

同一支影片（相同 video ID）重複新增會回傳 `CONTENT_EXISTS` 錯誤。

### 3.3 發布 / 隱藏 / 刪除

- **隱藏**：把 `published` 內容改成 `hidden`，前台立即看不到，可再按「發布」還原。
- **刪除**：soft delete，資料仍保留在資料庫（狀態 `deleted`），前台與列表都不再顯示。

所有寫入動作都會寫進 audit log（誰、何時、改了什麼，含修改前後的值）。

---

## 4. Topics（主題管理）

路徑：`/admin/topics`

### 4.1 新增主題

| 欄位 | 說明 |
|---|---|
| 名稱 | 繁體中文名稱，例如「RAG 入門」 |
| Slug | 網址用識別字，只能小寫英數與連字號，例如 `rag`、`ai-agent` |
| 第一個關鍵字 | 選填，之後可再擴充 |
| 關鍵字類型 | `tw_term` 台灣用語 / `cn_term` 中國用語 / `english` 英文 / `positive` 正向 / `negative` 排除 / `synonym` 同義詞 |

Slug 不可重複，重複會回傳 `TOPIC_SLUG_EXISTS`。

> 注意：前台首頁的主題下拉選單使用的就是這裡的 slug，新增主題後若要出現在
> 前台選單，需同步更新 `filter-bar.tsx` 的選項。

### 4.2 停用主題

按「停用」後主題不再參與每日 pipeline，既有內容與歷史資料都會保留。

---

## 5. Channels（頻道管理）

路徑：`/admin/channels`

新增頻道規則時選擇類型：

- **推薦（recommended）**：排名時獲得加分（recommended boost），卡片會標示推薦頻道。可填「推薦理由」。
- **黑名單（blacklisted）**：該頻道影片一律不進入每日排名。

| 欄位 | 說明 |
|---|---|
| Channel ID | YouTube channel ID（`UC…` 開頭） |
| 名稱 | 頻道顯示名稱 |
| Handle | 選填，例如 `@channel` |
| 權重 | -10 ～ 10，影響 channel trust score |

同一個 Channel ID 再次送出會直接更新（upsert）原有規則。

---

## 6. Settings（搜尋與排名設定）

路徑：`/admin/settings`（僅 owner / admin）

每個主題各有一組設定：

| 設定 | 說明 |
|---|---|
| Freshness 天數 | 只搜尋最近 N 天發布的影片（1–3650） |
| 候選上限 | 每日每主題最多處理的候選影片數（1–500） |
| Top N | 每日精選顯示的數量（1–100，預設 20） |
| 最短 / 最長秒數 | 影片長度範圍，低於下限（預設 5 分鐘）可排除大多數 Shorts |
| 最低互動率 | engagement score 門檻（0–1） |
| 自動發布 | 勾選後 pipeline 分析完的影片自動 `published`；不勾則需在 Content 手動發布 |

---

## 7. LLM（模型與金鑰，BYOK）

路徑：`/admin/llm`（僅 owner / admin）

### 7.1 新增 Provider 金鑰

1. 選擇 provider：OpenAI / Gemini / Anthropic / OpenRouter。
2. 填顯示名稱與 API key。
3. 按「驗證並儲存」— 系統會先呼叫 provider 驗證 key 是否有效，
   驗證通過後**加密儲存**（資料庫只存密文與遮罩後的 key）。

### 7.2 重新驗證與模型清單

每把 key 可按「重新驗證」；驗證成功會同時列出該 provider 可用的模型清單。

### 7.3 Fallback chain

為每種 LLM 任務（分類 / 摘要 / 測驗 / 學習路徑 / JSON 修復）設定備援順序，
每行一個 `provider:model-id`，第一行是 primary：

```text
openai:gpt-4.1-mini
anthropic:claude-haiku-4-5
```

primary 失敗時會依序改用下一個。

---

## 8. Admins（管理員帳號）

路徑：`/admin/admins`（僅 owner）

此頁顯示目前登入帳號的資訊與 session 到期時間。帳號建立、密碼重設與
角色異動需透過受控的部署流程（seed / DB migration）執行，不在前端開放，
以避免憑證操作暴露在瀏覽器端。

---

## 9. Runs（Pipeline 執行紀錄）

路徑：`/admin/runs`

- 每列一個 run：開始時間、觸發方式（`manual` / `scheduled`）、狀態
  （`queued` / `succeeded` / `partial_failed` / `failed`）、各 phase 統計與失敗事件。
- **手動觸發 Run**：按右上角按鈕建立一筆 `queued` run，並透過 GitHub Actions
  `workflow_dispatch` 啟動 ingest-daily workflow；worker 啟動後會把該筆 run 標為
  `running` 並回寫統計。同一位管理者 **60 秒內只能觸發一次**（rate limit）。
  Web 端需設定 `GITHUB_TOKEN` 與 `GITHUB_REPOSITORY` 環境變數，否則觸發會回報
  設定錯誤。

實際執行 daily pipeline 的是 Python worker（由 GitHub Actions 排程或手動執行）：

```bash
.venv/bin/python -m ai_learning_radar_worker.cli validate-config
.venv/bin/python -m ai_learning_radar_worker.cli daily --dry-run
.venv/bin/python -m ai_learning_radar_worker.cli daily
```

`--dry-run` 會照常呼叫 YouTube / LLM API，但不寫入任何 run、內容、分數或
snapshot 紀錄。

---

## 10. Audit Logs

所有後台寫入操作（新增 / 修改 / 停用 / 刪除 / 觸發 run）都會留下 audit log，
可經由 `GET /api/admin/audit-logs` 查詢，內容包含操作者、動作、對象、
修改前後的完整值與時間。

---

## 11. 疑難排解（Troubleshooting）

| 症狀 | 可能原因與處理 |
|---|---|
| 登入顯示「帳號或密碼不正確」 | 密碼錯誤、帳號被停用（`isActive = false`），或 owner 尚未 seed |
| 後台打不開、被導回登入頁 | session 已逾期（12 小時），重新登入即可 |
| 前台顯示「示範資料」 | 未設定 `DATABASE_URL`，目前跑的是 demo 模式 |
| 新增主題回傳 409 | slug 重複（`TOPIC_SLUG_EXISTS`） |
| 手動觸發 run 沒反應 | 60 秒 rate limit 內重複觸發，稍候再試 |
| LLM 金鑰驗證失敗 | key 無效、額度用盡，或 provider 選錯 |
| 伺服器啟動即報錯 `ADMIN_SESSION_SECRET` | 環境變數未設定或長度不足 32 字元 |
