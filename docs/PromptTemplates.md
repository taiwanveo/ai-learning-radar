# PromptTemplates.md — LLM Prompt 與 JSON Schema

## 1. 通用要求

所有 prompt 必須：

1. 使用繁體中文輸出。
2. 僅輸出 JSON，不要輸出 Markdown。
3. 不得捏造影片沒有提到的內容。
4. 若資訊不足，需在 JSON 欄位中表明不確定，而不是編造。
5. 使用 `evidence_text` 時只能引用 transcript 中的短片段。
6. 避免提供完整 transcript 或大量重寫影片內容。

## 2. 影片分類與難度判斷

### 2.1 Task

判斷：

- 是否為教學影片。
- 是否為入門影片。
- 內容類型。
- 主題 relevance。
- 判斷理由。

### 2.2 Input variables

```text
{{title}}
{{description}}
{{channel_title}}
{{duration_minutes}}
{{published_at}}
{{topic_name}}
{{topic_keywords}}
{{rule_signals_json}}
{{transcript_excerpt}}
```

### 2.3 Prompt

```text
你是企業培訓內容策展員，負責判斷一支 YouTube 影片是否適合放入「AI Learning Radar」教學影片推薦網站。

請根據影片標題、描述、頻道、主題關鍵字、規則特徵與 transcript 片段，完成以下判斷：

1. 這是否主要是一支教學影片，而不是新聞、閒聊、業配、產品宣傳、評論或純展示？
2. 這支影片是否屬於「入門」難度？
3. 這支影片與指定主題的相關程度如何？
4. 請用繁體中文給出簡短、可讓管理者理解的理由。

「入門」定義：
- 專門為沒有學過該主題的人準備。
- 不要求數學背景。
- 不要求程式基礎。
- 會解釋名詞。
- 有步驟。
- 有範例。

若影片不是明確為初學者設計，difficulty 請輸出 "normal"。

請只輸出 JSON，不要輸出 Markdown 或額外文字。

影片資料：
標題：{{title}}
描述：{{description}}
頻道：{{channel_title}}
長度：{{duration_minutes}} 分鐘
發布時間：{{published_at}}
指定主題：{{topic_name}}
主題關鍵字：{{topic_keywords}}
規則特徵：{{rule_signals_json}}
Transcript 片段：
{{transcript_excerpt}}
```

### 2.4 JSON Schema

```json
{
  "is_tutorial": true,
  "tutorial_confidence": 0.0,
  "content_type": "tutorial",
  "difficulty": "beginner",
  "difficulty_confidence": 0.0,
  "topic_relevance_score": 0.0,
  "tutorial_quality_score": 0.0,
  "reason": "繁體中文簡短理由",
  "difficulty_reason": "繁體中文簡短理由",
  "signals": ["訊號 1", "訊號 2"]
}
```

Allowed values：

```text
content_type: tutorial | news | opinion | product_demo | marketing | interview | other
difficulty: beginner | normal
```

## 3. 摘要與學習目標

### 3.1 Task

產生：

- 適合誰。
- 首頁短摘要，100 到 200 個中文字。
- 詳情頁完整摘要，500 到 800 個中文字。
- Transcript 摘要，300 到 500 個中文字。
- 學習目標 3 到 5 點。
- 關鍵概念 tags。

### 3.2 Input variables

```text
{{title}}
{{description}}
{{channel_title}}
{{topic_name}}
{{difficulty}}
{{transcript_text}}
```

### 3.3 Prompt

```text
你是企業培訓講師與教學內容策展員。請根據以下 YouTube 教學影片 transcript 與 metadata，為「AI Learning Radar」產生繁體中文學習摘要。

要求：
1. 不要捏造 transcript 沒有提到的內容。
2. 不要輸出完整逐字稿。
3. 摘要要幫助學員判斷「這支影片值不值得看」與「看完會學到什麼」。
4. 語氣專業、清楚、適合企業內訓平台。
5. 短摘要 100 到 200 個中文字。
6. 完整摘要 500 到 800 個中文字。
7. Transcript 摘要 300 到 500 個中文字。
8. 學習目標 3 到 5 點。
9. 關鍵概念 tags 3 到 8 個，盡量使用中英混合技術詞，例如 LLM、RAG、Prompt Engineering。
10. suitable_for 請寫成一句話，例如：「適合剛開始接觸生成式 AI、想建立基本觀念的學員。」

請只輸出 JSON，不要輸出 Markdown 或額外文字。

影片資料：
標題：{{title}}
描述：{{description}}
頻道：{{channel_title}}
主題：{{topic_name}}
難度：{{difficulty}}
Transcript：
{{transcript_text}}
```

### 3.4 JSON Schema

```json
{
  "suitable_for": "適合誰，一句話",
  "short_summary": "100 到 200 個中文字",
  "full_summary": "500 到 800 個中文字",
  "transcript_summary": "300 到 500 個中文字",
  "learning_objectives": [
    "學習目標 1",
    "學習目標 2",
    "學習目標 3"
  ],
  "key_concepts": ["LLM", "Prompt Engineering", "RAG"],
  "limitations_or_cautions": "如果影片內容有明顯限制或需注意處，請簡短說明；沒有則輸出空字串"
}
```

## 4. 測驗生成

### 4.1 Task

為每支影片產生 3 題單選題：

1. 理解題。
2. 應用題。
3. 觀念辨識題。

每題 4 個選項、1 個正解、解析、evidence_text。

### 4.2 Prompt

```text
你是企業培訓測驗設計師。請根據以下影片 transcript 與摘要，為學員設計 3 題單選題，用來確認學員是否理解影片內容。

題型固定為：
1. comprehension：理解題，檢查學員是否理解影片中的主要說明。
2. application：應用題，檢查學員能否把影片觀念用在簡單情境。
3. concept：觀念辨識題，檢查學員是否能辨認正確概念。

要求：
- 每題 4 個選項，使用 A/B/C/D。
- 只有一個正確答案。
- 題目必須根據 transcript，不得捏造。
- evidence_text 必須是 transcript 中可支持答案的短片段，不超過 80 個中文字。
- 解析需用繁體中文，簡短清楚。
- 題目難度適合企業學員看完影片後自我檢核。
- 不要出太瑣碎的記憶題，例如精確時間、無關人名、口頭禪。

請只輸出 JSON，不要輸出 Markdown 或額外文字。

影片標題：{{title}}
影片摘要：{{short_summary}}
學習目標：{{learning_objectives}}
Transcript：
{{transcript_text}}
```

### 4.3 JSON Schema

```json
{
  "questions": [
    {
      "question_type": "comprehension",
      "question_text": "題目文字",
      "options": {
        "A": "選項 A",
        "B": "選項 B",
        "C": "選項 C",
        "D": "選項 D"
      },
      "correct_option_key": "A",
      "explanation": "答案解析",
      "evidence_text": "支持答案的 transcript 短片段"
    },
    {
      "question_type": "application",
      "question_text": "題目文字",
      "options": {
        "A": "選項 A",
        "B": "選項 B",
        "C": "選項 C",
        "D": "選項 D"
      },
      "correct_option_key": "B",
      "explanation": "答案解析",
      "evidence_text": "支持答案的 transcript 短片段"
    },
    {
      "question_type": "concept",
      "question_text": "題目文字",
      "options": {
        "A": "選項 A",
        "B": "選項 B",
        "C": "選項 C",
        "D": "選項 D"
      },
      "correct_option_key": "C",
      "explanation": "答案解析",
      "evidence_text": "支持答案的 transcript 短片段"
    }
  ]
}
```

## 5. 學習指引生成

### 5.1 Trigger

搜尋結果頁按下「產生學習順序建議」。

### 5.2 Input

搜尋關鍵字、使用者選擇的難度、搜尋結果前 25 筆。

### 5.3 Prompt

```text
你是企業培訓課程規劃師。使用者正在搜尋「{{query}}」，以下是 AI Learning Radar 找到的教學影片搜尋結果。

請根據影片標題、摘要、學習目標、難度、發布日期與關鍵概念，為「初學者」產生一段學習指引。

要求：
1. 先用 2 到 4 句話說明學習建議。
2. 推薦 3 到 7 支影片的觀看順序。
3. 每支影片給出排序理由。
4. 優先將概念建立影片排前面，再排工具操作或專案實作影片。
5. 若某些影片太進階，請標示「可後看」。
6. 不要推薦搜尋結果以外的影片。
7. 請只輸出 JSON。

搜尋關鍵字：{{query}}
搜尋結果：
{{search_results_json}}
```

### 5.4 JSON Schema

```json
{
  "guidance": "整體學習建議，2 到 4 句話",
  "recommended_order": [
    {
      "content_item_id": "uuid",
      "rank": 1,
      "reason": "為什麼先看這支",
      "learning_role": "建立基本觀念"
    }
  ],
  "watch_later": [
    {
      "content_item_id": "uuid",
      "reason": "為什麼建議後看"
    }
  ],
  "next_steps": ["看完後可以做的下一步"]
}
```

## 6. JSON 修復 Prompt

當模型輸出無法通過 schema：

```text
你剛才的輸出不是合法 JSON，或不符合指定 schema。

請根據以下錯誤訊息修正輸出。

要求：
- 只輸出合法 JSON。
- 不要輸出 Markdown。
- 不要增加 schema 以外的欄位。
- 不要改變原本語意，除非原本欄位缺漏或格式錯誤。

Schema：
{{schema_json}}

錯誤訊息：
{{validation_error}}

原始輸出：
{{bad_output}}
```

## 7. Prompt 版本管理

建議版本：

```text
classifier_prompt_version = 2026-07-02.1
summary_prompt_version = 2026-07-02.1
quiz_prompt_version = 2026-07-02.1
learning_path_prompt_version = 2026-07-02.1
repair_prompt_version = 2026-07-02.1
```

每次修改 prompt，必須：

1. 更新版本號。
2. 更新 `PromptTemplates.md`。
3. 更新測試 fixture。
4. 在 PR 說明是否需要重跑既有內容。

