# AI Learning Radar 工程文件集

本文件集用於將 `SunFish98/VideoDigestAgent` 改造成「AI Learning Radar」：一個以 YouTube 中文教學影片為主的 Daily Digest Agent + Dashboard，第一版聚焦人工智慧主題，受眾為台灣學員，預留未來納入文章、Bilibili、RSS 與手動內容來源的擴充能力。

## 文件索引

| 文件 | 用途 |
|---|---|
| `PRD.md` | 產品需求文件，定義目標、範圍、使用者、功能、非功能需求與 MVP 邊界。 |
| `Architecture.md` | 技術架構文件，定義系統組件、資料流、部署方案、第三方 API 與安全設計。 |
| `SPEC.md` | 開發規格，定義功能規格、演算法、API、UI、Worker 行為與驗收標準。 |
| `DataModel.md` | PostgreSQL 資料模型、主要資料表與索引設計。 |
| `PromptTemplates.md` | LLM 摘要、分類、難度判斷、測驗與學習指引的 prompt 與 JSON schema。 |
| `Tasks.md` | 多 Agent 任務拆分，含負責目錄、依賴、驗收條件與測試命令。 |
| `AgentWorkflow.md` | 如何用 Codex、Claude Code、Cursor、GitHub Copilot 以多 Agent 模式協作。 |
| `Deployment.md` | 免費雲端部署建議、環境變數、排程、備份與成本風險。 |
| `Runbook.md` | 日常維運、失敗排查、資料修正與回復流程。 |
| `References.md` | 本文件集使用到的官方或重要參考來源。 |

## 建議開發順序

1. 先讀 `PRD.md`，確認 MVP 範圍。
2. 讀 `Architecture.md` 與 `DataModel.md`，先讓資料模型與目錄結構固定。
3. 依 `Tasks.md` 建 issue，分派給不同 Agent。
4. 所有 Agent 開始前都必須讀 `AgentWorkflow.md`。
5. Worker 與 Web API 開發時同步參考 `SPEC.md` 與 `PromptTemplates.md`。
6. 部署前讀 `Deployment.md`，上線後用 `Runbook.md` 維運。

## 重要決策摘要

- 第一版只支援 YouTube，自動蒐集中文教學影片。
- 系統名稱：AI Learning Radar。
- 預設主題：人工智慧，後台可新增資安、雲端、資料庫、Python 等主題。
- 受眾：台灣學員，繁體中文 UI。
- 首頁展示每日 Top 20，四欄五列，類 YouTube 影片列表體驗。
- 所有列入排名範圍的影片都保存到歷史資料庫，可搜尋。
- 每支影片產生：適合誰、短摘要、學習目標、關鍵概念、入門難度判斷、3 題單選測驗。
- 第一版不儲存使用者作答紀錄，但資料模型預留未來擴充。
- 第一版需要管理後台、多管理員、黑名單/推薦頻道、參數設定、手動內容編輯與 run log。
- 技術選型：Next.js Dashboard/Admin + Python Worker + PostgreSQL。
- 建議免費部署：Vercel Hobby + Neon Free PostgreSQL + GitHub Actions daily worker。

