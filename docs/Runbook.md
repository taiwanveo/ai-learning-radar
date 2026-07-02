# Runbook.md — AI Learning Radar 維運手冊

## 1. 每日檢查

管理者每天檢查：

1. Admin > Runs：確認最新 run 是否 succeeded。
2. Admin > Dashboard：確認今日 Top 20 是否已產生。
3. Admin > Runs > Errors：確認是否有大量 transcript unavailable、quota exceeded 或 LLM errors。
4. Public homepage：確認首頁正常顯示。
5. Search：用「LLM」、「RAG」、「AI Agent」測試搜尋。

## 2. 常見問題

### 2.1 今日沒有 Top 20

檢查順序：

1. GitHub Actions 是否執行。
2. `agent_runs` 是否有今日 run。
3. run status 是否 failed。
4. 是否 YouTube API quota exceeded。
5. 是否 topics 被停用。
6. 是否 topic_search_settings 設定過嚴。
7. 是否所有影片都 transcript unavailable。
8. 是否 daily snapshot 建立失敗。

處理：

- 放寬 freshness_days 或 duration。
- 檢查 YouTube API key。
- 手動 workflow_dispatch 重新執行。

### 2.2 transcript unavailable 太多

可能原因：

- 影片沒有中文字幕。
- transcript 套件失效。
- YouTube rate limit。
- 搜尋條件沒有要求 closed caption。

處理：

- 檢查 `videoCaption=closedCaption` 是否啟用。
- 改用更明確的中文教學 query。
- 暫時降低候選數。
- 未來可評估 Whisper fallback。

### 2.3 LLM JSON parse 失敗

處理：

1. 查看 `llm_call_logs`。
2. 查看 raw output。
3. 確認 prompt 要求 JSON-only。
4. 確認 repair prompt 有執行。
5. 若同一模型常失敗，切換 fallback model。
6. 更新 PromptTemplates 並 bump prompt version。

### 2.4 影片品質不佳但排名很高

處理：

- 將頻道加入黑名單。
- 手動隱藏影片。
- 調整推薦頻道權重。
- 調整 `tutorial_quality_score` prompt。
- 降低 comment_signal 或 engagement 權重。
- 開啟 growth guardrail penalty。

### 2.5 新影片太少

處理：

- 增加 freshness_days。
- 增加 query expansion。
- 放寬 min_duration。
- 增加 candidate_limit。
- 加入更多中國常用詞與英文技術詞。
- 新增推薦頻道。

### 2.6 DB 空間快滿

處理順序：

1. 查 transcript 表容量。
2. 清理 failed/filtered transcript。
3. 將舊 transcript 壓縮。
4. 只保留 transcript_summary。
5. 升級 DB 或改 object storage。

## 3. 手動新增影片

流程：

1. Admin > Content > Add YouTube URL。
2. 輸入 URL。
3. 選 topic。
4. 選是否立即發布。
5. 等待 metadata、transcript、summary、quiz 完成。
6. 檢查摘要與 quiz。
7. 必要時手動修正。

## 4. 手動修正難度

1. Admin > Content。
2. 搜尋影片。
3. 進入編輯。
4. 查看 AI difficulty_reason。
5. 將 difficulty 改為 beginner 或 normal。
6. 儲存。
7. Audit log 會記錄。

## 5. 推薦頻道管理

### 加入推薦頻道

1. Admin > Channels。
2. Add channel。
3. 輸入 YouTube channel URL / handle / channel ID。
4. 選「推薦頻道」。
5. 設定 trust_weight。
6. 輸入推薦理由。

### 加入黑名單

1. Admin > Channels。
2. 搜尋頻道。
3. 設為黑名單。
4. 輸入原因。
5. 下一次 run 起排除該頻道。

## 6. API key 輪替

1. Admin > LLM。
2. 新增新的 API key。
3. Validate。
4. 取得 models。
5. 設為 active。
6. 停用舊 key。
7. 觀察下一次 run。
8. 刪除舊 key。

YouTube API key 若放在 GitHub Secrets：

1. 到 GitHub repository settings。
2. Secrets and variables > Actions。
3. 更新 `YOUTUBE_API_KEY`。
4. 手動觸發 workflow_dispatch 測試。

## 7. 回復失敗 run

若 run 失敗：

```bash
gh workflow run ingest-daily.yml -f dry_run=false
```

若只重跑特定 topic：

```bash
gh workflow run ingest-daily.yml -f topic_id=<topic_uuid> -f dry_run=false
```

若本地重跑：

```bash
cd workers/ingestion
DATABASE_URL=... APP_SECRET_KEY=... YOUTUBE_API_KEY=... \
python -m ai_learning_radar_worker.cli daily --topic-id <topic_uuid>
```

## 8. 資料修復

### 8.1 重建某日 snapshot

```bash
python -m ai_learning_radar_worker.cli rebuild-snapshot --date 2026-07-02 --topic-id <topic_uuid>
```

### 8.2 重跑單支影片摘要

```bash
python -m ai_learning_radar_worker.cli reprocess-content --content-id <uuid> --task summarize
```

### 8.3 重跑測驗

```bash
python -m ai_learning_radar_worker.cli reprocess-content --content-id <uuid> --task quiz
```

## 9. 監控指標

建議每週查看：

- 每日 run 成功率。
- 平均候選數。
- transcript unavailable 比率。
- LLM failure 比率。
- 平均處理時間。
- 每日新增影片數。
- DB 大小。
- LLM token/cost estimate。
- Top 20 中管理者手動隱藏比例。

## 10. 內容品質抽查

每週抽查：

- Top 20 前 5 支影片。
- 搜尋熱門關鍵字結果。
- AI 摘要是否準確。
- quiz 是否可由影片內容回答。
- 入門標籤是否合理。
- 推薦頻道加權是否造成偏差。

若品質偏差明顯，優先調整：

1. 排除關鍵字。
2. 推薦/黑名單頻道。
3. LLM 教學分類 prompt。
4. 排名公式權重。
5. 搜尋 query expansion。

## 11. Release smoke test

每次 production release 後依序確認：

1. `/` 回傳成功且可顯示當日 digest 或明確空狀態。
2. `/search?q=RAG` 可顯示結果，學習指引只會在使用者按下按鈕後產生。
3. 任一 `/content/<id>` 可完成三題匿名測驗，Network panel 不應出現保存作答請求。
4. 未登入請求 `/admin` 與 `/api/admin/*` 會被拒絕。
5. owner 登入後可修改一項 topic 設定，並在 audit log 看到 before/after。
6. Runs 頁可看到最近 pipeline 與失敗事件，重複手動觸發會受到 rate limit。
7. LLM 頁只顯示 masked key；回應與 application log 不得含明文 key。
