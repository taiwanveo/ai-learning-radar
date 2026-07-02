# T00-01 Repository Audit

## Audit scope

Audit date: 2026-07-02

The workspace contains only the AI Learning Radar engineering document set under
`docs/`. It is not a Git checkout and does not contain the referenced
`SunFish98/VideoDigestAgent` source tree.

## Files available for audit

- Product and engineering specifications in `docs/*.md`.
- `docs/ai-learning-radar-docs.zip`, which contains the same documentation set.

## Original repository modules

The architecture document says the original repository contains YouTube channel
monitoring, keyword search, transcript extraction, LLM summarization, a Flask web
UI, a CLI, Bilibili monitoring, local history, and email output. None of those
source files are present in this workspace, so their implementation quality,
licenses, dependencies, tests, and reusable interfaces cannot be verified.

| Area | Audit decision | Reason |
|---|---|---|
| YouTube search | Reassess when legacy source is supplied | The API interaction may be reusable, but no code is available. |
| Transcript extraction | Reassess when legacy source is supplied | Adapter isolation is required by the new architecture. |
| LLM summarization | Reassess when legacy source is supplied | New JSON schemas and prompt versioning materially change the contract. |
| CLI | Rewrite | The new worker CLI and run logging contract are fully specified. |
| Flask UI | Do not reuse for the product UI | The target architecture requires Next.js. |
| Local history | Replace | PostgreSQL is the system of record. |
| Email output | Remove from the primary flow | It is outside the MVP scope. |
| Bilibili monitor | Defer | Bilibili ingestion is explicitly outside the MVP scope. |

## Migration risks

1. Legacy behavior cannot be regression-tested until the original source is supplied.
2. YouTube quota handling and transcript edge cases may need to be rediscovered.
3. Any legacy dependency licenses must be reviewed before code is copied.
4. The documented legacy feature inventory may not match the exact upstream revision.
5. A later legacy import must not replace the new database, API, prompt, or package contracts without an explicit migration decision.

## Bootstrap decision

Proceed with a clean monorepo scaffold based on `Architecture.md`. Keep
`legacy/VideoDigestAgent/` reserved for a future, traceable import. Once the
source is supplied, perform a second audit and extract only verified adapter
logic behind the new interfaces.

## v1.0 code review（2026-07-03）

針對開發團隊完成的 v1.0 進行全面審查，發現並修正下列問題。修正後
web/shared/worker 全數測試、typecheck 與 production build 均通過。

### 已修正的功能缺陷

| 問題 | 影響 | 修正 |
|---|---|---|
| `/admin/login` 與受保護頁共用同一個驗證 layout，未登入時無限重導 | 登入頁完全無法開啟 | 受保護頁移入 route group `app/admin/(console)/`，登入頁獨立於驗證 layout 之外 |
| 三個 admin 表單在 `await` 之後才呼叫 `event.currentTarget.reset()`（React 事件在 handler 讓出後 `currentTarget` 為 `null`） | 新增主題／頻道／內容成功時反而顯示「新增失敗」 | 在 `await` 前先保留 form 參考 |
| 首頁主題篩選的 option 值（`ai agent`、`prompt`）與 DB seed 的 topic slug（`ai-agent`、`prompt-engineering`）不一致 | 資料庫模式下選這些主題永遠查無資料 | option 值改用正式 slug；demo 模式比對時將連字號正規化 |
| `/search?difficulty=<非法值>` 直接丟出 ZodError | 使用者看到 500 錯誤頁 | 非法參數退回預設值 |
| 詳情頁缺少 SPEC 2.2 要求的發布日期、按讚數、留言數、縮圖 | 規格與實作不一致 | 補齊四個欄位 |
| SPEC 11.1 定義的 `GET /api/public/content/:id`、`GET /api/public/search` 未實作 | 規格與實作不一致 | 新增兩個 route |
| 測驗選項作答結果只以顏色區分（違反 SPEC 16） | 色弱使用者無法辨識對錯 | 選項加上「✓ 正確」「✕ 你的選擇」文字標記 |
| 影片縮圖 `alt=""`（違反 SPEC 16「所有縮圖需要 alt text」） | 螢幕閱讀器缺資訊 | alt 改為影片標題 |
| 站台導覽「今日精選」永遠標示為 active | 導覽狀態錯誤 | header 改為依 `usePathname` 判斷，並加 `aria-current` |
| 學習指引按鈕在回應非 JSON 或網路失敗時未捕捉例外 | 未處理的 promise rejection | 加上 try/catch 與 `.catch` 保護 |

### UI／設計強化（frontend-design skill）

- 品牌雷達標記加入 6 秒掃描動畫（`prefers-reduced-motion` 時停用），作為全站的視覺記憶點。
- 有真實縮圖時隱藏卡片上的雷達圓圈裝飾（先前會疊在縮圖上）。
- 全站補上 `:focus-visible` 鍵盤焦點樣式。
- 影片卡 hover 時邊框帶入品牌綠、primary button 增加 hover 狀態。
- Admin 側邊欄導覽依目前路徑標示 active 項目。

### 同步更新的文件

- `SPEC.md`：admin API 路徑改為實作的 `auth/*`、`llm/*` 版本；digest query 參數與
  topic slug 範例對齊 seed 資料；學習指引回傳欄位對齊 `learningPathResponseSchema`；
  註記 `/admin/login` 的 route group 結構。
