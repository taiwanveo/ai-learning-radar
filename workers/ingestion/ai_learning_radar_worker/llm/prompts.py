"""Versioned prompts for all structured LLM tasks."""

# ruff: noqa: E501 -- Prompt wording is versioned and line breaks affect snapshots.

CLASSIFIER_PROMPT_VERSION = "2026-07-03.1"
SUMMARY_PROMPT_VERSION = "2026-07-03.1"
QUIZ_PROMPT_VERSION = "2026-07-02.1"
LEARNING_PATH_PROMPT_VERSION = "2026-07-02.1"
REPAIR_PROMPT_VERSION = "2026-07-02.1"

COMMON = "只輸出合法 JSON，不要輸出 Markdown。使用繁體中文，不得捏造輸入沒有提到的內容。"

CLASSIFIER_PROMPT = """你是企業培訓內容策展員。判斷影片是否為教學、是否入門、內容類型、主題相關度與教學品質。
入門表示不要求數學或程式背景、會解釋名詞、有步驟與範例；不明確時 difficulty 使用 normal。
{common}
標題：{title}
描述：{description}
頻道：{channel_title}
長度：{duration_minutes} 分鐘
發布時間：{published_at}
指定主題：{topic_name}
主題關鍵字：{topic_keywords}
規則特徵：{rule_signals_json}
分析來源：{source_kind}
來源內容：{source_text}"""

SUMMARY_PROMPT = """你是企業培訓講師與教學內容策展員。產生適合對象、短摘要、完整摘要、3 至 5 點學習目標、3 至 8 個關鍵概念與限制。
短摘要 100 至 200 字，完整摘要 200 至 800 字。只能根據提供的來源內容摘要；資料不足時必須在 limitations_or_cautions 明確說明。
只有分析來源為 Transcript 時才能產生 transcript_summary（300 至 500 字）；其他來源必須輸出 null。
{common}
標題：{title}
描述：{description}
頻道：{channel_title}
主題：{topic_name}
難度：{difficulty}
分析來源：{source_kind}
來源內容：{source_text}"""

QUIZ_PROMPT = """你是企業培訓測驗設計師。設計 comprehension、application、concept 各一題且依此順序。每題四個 A/B/C/D 選項且只有一個正解；解析須簡短；evidence_text 必須出自 Transcript 且不超過 80 字。
{common}
影片標題：{title}
影片摘要：{short_summary}
學習目標：{learning_objectives}
Transcript：{transcript_text}"""

LEARNING_PATH_PROMPT = """你是企業培訓課程規劃師。針對搜尋關鍵字產生 2 至 4 句整體建議，推薦搜尋結果中 3 至 7 支影片並排序；概念影片優先，進階影片可列入 watch_later，不得加入搜尋結果外的影片。
{common}
搜尋關鍵字：{query}
使用者難度：{difficulty}
搜尋結果：{search_results_json}"""

REPAIR_PROMPT = """你剛才的輸出不是合法 JSON，或不符合指定 schema。根據錯誤修正一次；不要增加 schema 以外欄位，不要改變原意。
{common}
Schema：{schema_json}
錯誤訊息：{validation_error}
原始輸出：{bad_output}"""
