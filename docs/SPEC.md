# SPEC.md — AI Learning Radar 開發規格

## 1. 系統版本

- 文件版本：v0.1
- 目標產品版本：MVP v0.1
- 預設 UI 語言：繁體中文
- 預設主題：人工智慧
- 預設內容來源：YouTube

## 2. 功能模組

### 2.1 Public Dashboard

#### 功能

- 顯示每日 Top 20 影片。
- 預設四欄五列。
- 支援主題、難度、發布時間、熱門程度、語言、內容類型篩選。
- 支援排序：預設、最新、最熱門、最適合入門。
- 支援關鍵字搜尋。
- 每張卡片包含影片 metadata、摘要、學習目標、tags、測驗狀態。

#### URL

```text
/
```

#### Query parameters

```text
topic=artificial-intelligence|rag|ai-agent|prompt-engineering|llm|…（topic slug）
date=2026-07-02
sort=default|latest|popular|beginner|engagement
level=beginner|normal|all
content_type=video|article|all
language=zh-Hant|zh-Hans|en（省略 = 所有語言）
published=7d|30d|90d|all
q=RAG（由 /search 頁面處理）
```

#### Acceptance criteria

- 影音網站式（video-first）版面：進站不需捲動即可看到搜尋列、篩選列與影片縮圖牆，
  首頁不放大段文字說明。
- 全站 header 內建搜尋列，送出導向 `/search`。
- 支援亮色與暗色兩種主題：預設跟隨系統 `prefers-color-scheme`，header 提供切換按鈕，
  選擇記錄於 `localStorage`（key：`radar-theme`）。
- 桌面版 4 欄（寬 ≤1280px 為 3 欄），平板 2 欄，手機 1 欄。
- 沒有符合資料時顯示空狀態，不報錯。
- 點擊影片縮圖或按鈕可開新分頁前往 YouTube。
- 點擊詳情可進入內容詳情頁。
- 「engagement_score」在 UI 顯示為「參與度分數」。

### 2.2 Content Detail Page

#### URL

```text
/content/[id]
```

#### 顯示內容

- 標題。
- 縮圖。
- 頻道。
- 發布日期。
- 觀看數。
- 按讚數。
- 留言數。
- 參與度分數。
- 主題與關鍵概念 tags。
- 入門標籤。
- 適合誰。
- 完整摘要。
- 學習目標。
- Transcript 摘要。
- 3 題測驗。
- 前往 YouTube 連結。

#### Quiz 行為

- 使用者可匿名作答。
- 前端本機狀態保存作答。
- 作答後顯示正確答案與解析。
- 不呼叫後端保存作答紀錄。

### 2.3 Search Page

#### URL

```text
/search?q=RAG
```

#### 搜尋範圍

- title。
- channel_title。
- short_summary。
- full_summary。
- tags。
- learning_objectives。
- transcript_summary。

#### 學習指引

搜尋結果數量 >= 3 時，顯示「產生學習順序建議」按鈕。

按下後呼叫：

```text
POST /api/public/learning-path
```

回傳（對應 `learningPathResponseSchema`）：

- `guidance`：整體學習指引與初學者注意事項。
- `recommended_order`：建議觀看順序，每項含理由與 `learning_role`。
- `watch_later`：較進階、建議稍後再看的項目與理由。
- `next_steps`：下一步學習建議。

為節省成本，第一版不自動產生學習指引；按鈕僅在搜尋結果 >= 3 筆時顯示，
且產生時只使用當頁搜尋結果。

### 2.4 Admin Console

#### URL

```text
/admin
```

#### 功能區

1. Dashboard
   - 今日 run 狀態。
   - 近期錯誤。
   - 今日 Top 20。
   - API quota 概況。
   - LLM 成本估計。

2. Content
   - 搜尋內容。
   - 新增影片 URL。
   - 編輯標題、摘要、tags、難度。
   - 刪除或隱藏內容。
   - 調整排序或置頂。

3. Topics
   - 新增/編輯主題。
   - 新增/編輯子題。
   - 正向關鍵字。
   - 排除關鍵字。
   - 同義詞。
   - 台灣/中國用詞映射。

4. Channels
   - 推薦頻道。
   - 黑名單頻道。
   - 頻道權重。
   - 推薦理由。

5. Settings
   - 發布時間範圍。
   - 影片長度。
   - 候選數。
   - Top N。
   - 最低觀看數。
   - 最低參與度分數。
   - 是否排除 Shorts。
   - 是否自動發布。
   - run schedule。

6. LLM
   - Provider。
   - API key。
   - 驗證 key。
   - 取得模型清單。
   - 設定 primary model。
   - 設定 fallback chain。
   - 查看 LLM call logs。

7. Admins
   - 新增/停用管理員。
   - 設定角色。
   - 重設密碼。

8. Runs
   - 每次 agent run log。
   - 每個 phase 統計。
   - 錯誤查詢。
   - 重新執行。

## 3. Worker CLI 規格

Python worker 入口：

```bash
python -m ai_learning_radar_worker.cli daily
python -m ai_learning_radar_worker.cli daily --topic-id <id>
python -m ai_learning_radar_worker.cli daily --dry-run
python -m ai_learning_radar_worker.cli backfill --days 90
python -m ai_learning_radar_worker.cli validate-config
python -m ai_learning_radar_worker.cli test-video --url <youtube_url>
```

### 3.1 daily 流程

Pseudo-code：

```python
def run_daily_digest(trigger: str, topic_id: str | None = None):
    run = create_agent_run(trigger=trigger)
    settings = load_active_settings()
    topics = load_active_topics(topic_id)

    for topic in topics:
        queries = expand_queries(topic)
        for query in queries:
            search_results = youtube.search(query, settings)
            record_search_results(run, topic, query, search_results)

        video_ids = dedupe_video_ids(search_results)
        metadata = youtube.fetch_video_metadata(video_ids)
        channels = youtube.fetch_channel_metadata(metadata.channel_ids)

        candidates = apply_basic_filters(metadata, settings, channels)
        for candidate in candidates:
            upsert_content_metadata(candidate)

            if is_blacklisted(candidate.channel_id):
                mark_filtered(candidate, reason="blacklisted_channel")
                continue

            transcript = get_transcript(candidate.video_id, languages=settings.caption_languages)
            if transcript is None:
                mark_filtered(candidate, reason="transcript_unavailable")
                continue

            analysis = classify_and_summarize(candidate, transcript, topic)
            quiz = generate_quiz(candidate, transcript, analysis)
            scores = calculate_scores(candidate, analysis, channels)

            save_analysis(candidate, transcript, analysis, quiz, scores)

        snapshot = build_daily_top_n(topic, date=today(), n=settings.top_n)
        save_ranking_snapshot(snapshot)

    finish_agent_run(run)
```

## 4. YouTube 搜尋規格

### 4.1 search.list parameters

建議參數：

```text
part=snippet
q=<expanded query>
type=video
order=relevance 或 date 或 viewCount，由後台設定
publishedAfter=<now - freshness_days>
maxResults=50
regionCode=TW
relevanceLanguage=zh-Hant 或 zh-Hans
videoCaption=closedCaption
safeSearch=moderate
```

備註：YouTube search API 不保證結果全為指定語言，後續仍需用 transcript 與 LLM 判斷。

### 4.2 videos.list parameters

```text
part=snippet,statistics,contentDetails
id=<comma-separated video IDs>
```

### 4.3 channels.list parameters

```text
part=snippet,statistics
id=<comma-separated channel IDs>
```

## 5. Shorts 排除規格

判斷方式：

1. 使用 `contentDetails.duration`。
2. 若 duration < 5 分鐘，依基本長度條件排除。
3. 若 URL 或 metadata 顯示 shorts 型態，排除。
4. 第一版不需完美辨識 Shorts；因影片長度下限 5 分鐘已排除大多數 Shorts。

## 6. Transcript 規格

### 6.1 語言優先序

```text
zh-Hant > zh-TW > zh > zh-Hans > zh-CN
```

### 6.2 失敗處理

若 transcript 不可用：

- `content_processing_status = transcript_unavailable`
- 不進行 LLM 摘要與 quiz。
- 在 run log 中記錄。
- 不顯示於首頁 Top 20。

### 6.3 存儲

儲存：

- normalized text。
- language。
- transcript_hash。
- source。
- retrieved_at。

若 DB 空間有限，未來可將完整 transcript 壓縮或轉存 object storage。MVP 先存 PostgreSQL。

## 7. LLM 任務規格

### 7.1 任務清單

| 任務 | 輸入 | 輸出 |
|---|---|---|
| 教學分類 | metadata + transcript excerpt | 是否教學、類型、信心、理由 |
| 難度判斷 | metadata + transcript excerpt | beginner/normal、理由、信心 |
| 摘要 | metadata + transcript | 適合誰、短摘要、完整摘要、學習目標、tags |
| 測驗 | metadata + transcript + summary | 3 題單選題、答案、解析、evidence_text |
| 學習指引 | search results | 建議觀看順序與理由 |

### 7.2 JSON-only

所有 worker LLM 任務必須要求模型輸出 JSON。輸出需以 pydantic schema 驗證。驗證失敗時允許 retry 一次，retry prompt 需包含錯誤訊息與 schema。

### 7.3 Prompt versioning

每個 prompt 需有版本號，例如：

```text
summary_prompt_version = 2026-07-02.1
quiz_prompt_version = 2026-07-02.1
```

資料庫需存 prompt version，避免未來重跑結果不可追蹤。

## 8. 難度分類技術解

目前沒有可靠的單一數值可以直接判斷影片難度。建議採用「規則特徵 + LLM 分類 + 管理者覆寫」的混合解。

### 8.1 規則特徵

Worker 先抽取可解釋特徵：

- beginner keywords：入門、新手、零基礎、初學、從零開始、primer、beginner。
- advanced keywords：論文、訓練模型、微調、fine-tuning、evaluation、MLOps、向量資料庫部署、多 agent 架構。
- code markers：`pip install`、`python`、`API key`、程式碼區塊、GitHub。
- math markers：矩陣、梯度、loss function、微分、機率、統計。
- teaching markers：步驟、範例、示範、教學、實作、操作。
- assumed knowledge phrases：你應該已經知道、熟悉、需要具備、進階。

### 8.2 LLM 分類

LLM 取得 metadata、transcript excerpt、規則特徵，輸出：

```json
{
  "difficulty": "beginner",
  "confidence": 0.84,
  "reason": "影片明確標榜零基礎，會解釋基本名詞，且不要求程式或數學背景。",
  "signals": ["標題含入門", "逐字稿多次解釋名詞", "有步驟示範"]
}
```

### 8.3 管理者覆寫

管理者可覆寫：

- 難度。
- 教學影片判斷。
- tags。
- 摘要。
- 排序。

覆寫需寫入 audit log。

## 9. 評分規格

### 9.1 基礎欄位

```text
view_count
like_count
comment_count
published_at
age_days
engagement_score
fresh_engagement_score
view_velocity
comment_signal
channel_trust_score
topic_relevance_score
tutorial_quality_score
radar_score
```

### 9.2 預設排序

```text
fresh_engagement_score = (like_count / max(view_count, 1)) / age_days
```

`age_days` 最小為 1。

### 9.3 可選排序

- 最新：`published_at DESC`
- 最熱門：`view_count DESC`
- 最適合入門：`difficulty = beginner DESC, tutorial_quality_score DESC, fresh_engagement_score DESC`
- 推薦排序：`radar_score DESC`

## 10. Content 狀態機

```text
discovered
metadata_fetched
filtered_out
transcript_ready
analysis_ready
quiz_ready
published
hidden
deleted
failed
```

### 狀態說明

- `discovered`：由搜尋取得 videoId。
- `metadata_fetched`：已取得影片 metadata。
- `filtered_out`：不符合條件。
- `transcript_ready`：已取得字幕。
- `analysis_ready`：摘要與分類完成。
- `quiz_ready`：測驗完成。
- `published`：可公開顯示。
- `hidden`：管理者隱藏。
- `deleted`：軟刪除。
- `failed`：處理失敗。

## 11. API 規格

### 11.1 Public APIs

```text
GET /api/public/digest
GET /api/public/content/:id
GET /api/public/search
POST /api/public/learning-path
```

#### GET /api/public/digest

Request：

```text
?topic=artificial-intelligence&date=2026-07-02&sort=default&level=all
```

Response：

```json
{
  "date": "2026-07-02",
  "topic": { "id": "30000000-0000-4000-8000-000000000001", "slug": "artificial-intelligence", "name": "人工智慧" },
  "items": [
    {
      "id": "content_123",
      "sourceType": "youtube",
      "sourceUrl": "https://www.youtube.com/watch?v=...",
      "thumbnailUrl": "https://i.ytimg.com/...",
      "title": "...",
      "channelTitle": "...",
      "publishedAt": "2026-07-01T08:00:00Z",
      "viewCount": 2500,
      "likeCount": 180,
      "commentCount": 35,
      "engagementScore": 0.072,
      "difficulty": "beginner",
      "tags": ["LLM", "Prompt Engineering"],
      "suitableFor": "適合剛開始接觸生成式 AI 的學員。",
      "shortSummary": "...",
      "learningObjectives": ["...", "...", "..."],
      "quizCount": 3
    }
  ]
}
```

### 11.2 Admin APIs

```text
GET /api/admin/auth/session
POST /api/admin/auth/login
POST /api/admin/auth/logout
GET /api/admin/topics
POST /api/admin/topics
PATCH /api/admin/topics/:id
DELETE /api/admin/topics/:id
GET /api/admin/settings
PATCH /api/admin/settings
GET /api/admin/channels
POST /api/admin/channels/recommended
POST /api/admin/channels/blacklist
DELETE /api/admin/channels/:id
GET /api/admin/content
PATCH /api/admin/content/:id
DELETE /api/admin/content/:id
POST /api/admin/content/manual-youtube
GET /api/admin/runs
GET /api/admin/runs/:id
POST /api/admin/runs/trigger
GET /api/admin/llm
POST /api/admin/llm
POST /api/admin/llm/validate
POST /api/admin/llm/models
PUT /api/admin/llm/fallback
GET /api/admin/audit-logs
```

備註：`/admin/login` 位於未驗證的路由層（route group `(console)` 之外），其餘 `/admin/*`
頁面共用需要 session 的 layout，未登入一律重導到 `/admin/login`。

## 12. Admin 手動新增 YouTube 影片

輸入：

```json
{
  "url": "https://www.youtube.com/watch?v=...",
  "topicId": "ai",
  "publishImmediately": true
}
```

流程：

1. 解析 videoId。
2. 查 DB 是否已存在。
3. 取得 metadata。
4. 取得 transcript。
5. 跑 LLM 分析與 quiz。
6. 寫入 DB。
7. 顯示處理結果。

## 13. 測試規格

### 13.1 Web 測試

- Unit：component rendering、formatters、score display。
- API：public digest、search、admin settings。
- E2E：首頁瀏覽、篩選、詳情頁作答、admin login、修改設定。

### 13.2 Worker 測試

- Query expansion。
- Duration parser。
- Scoring formula。
- Dedup。
- LLM JSON schema validation。
- Transcript language selection。
- Repository upsert。

### 13.3 Integration 測試

- 使用 mock YouTube API。
- 使用 mock LLM provider。
- 使用 test Postgres。
- 完成一個 dry-run daily pipeline。

## 14. 錯誤處理

### 14.1 Retry 策略

- YouTube API transient error：最多 3 次 exponential backoff。
- Transcript fetch：最多 2 次。
- LLM：最多 2 次，schema fail 可追加 repair prompt。
- DB：transaction rollback，記錄 run event。

### 14.2 不可重試錯誤

- API key invalid。
- quota exceeded。
- transcript unavailable。
- video unavailable。
- blacklisted channel。
- private/deleted video。

## 15. Performance 需求

- 首頁載入 p95 < 2 秒，資料量小於 5 萬筆時。
- 搜尋 p95 < 1.5 秒，資料量小於 5 萬筆時。
- 每日 worker 可在 30 分鐘內處理第一版規模。
- LLM 任務需有 timeout，單支影片單一 LLM 任務 timeout 預設 90 秒。

## 16. Accessibility 與 UI 細節

- 所有縮圖需要 alt text。
- 卡片上數字用繁中格式，例如「2,500 次觀看」。
- 參與度分數顯示百分比，例如「7.2%」。
- 入門影片用標籤顯示「入門」。
- 推薦頻道用「推薦頻道」標籤顯示。
- 作答後正確選項與錯誤選項需用文字與 icon，不只靠顏色。

