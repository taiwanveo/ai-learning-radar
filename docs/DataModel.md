# DataModel.md — PostgreSQL 資料模型

## 1. 設計原則

1. 所有內容使用 polymorphic content model，第一版只實作 YouTube，未來可納入 article、Bilibili、RSS、manual。
2. YouTube videoId 是去重 key。
3. 每日 Top 20 使用 snapshot，不直接依即時計算結果查詢，確保當日排名可追蹤。
4. LLM 輸出需保留 prompt version、model、raw JSON 與解析結果。
5. 管理者手動覆寫需保留 audit log。
6. 使用者作答第一版不儲存，但預留 future tables。

## 2. Enum

```sql
CREATE TYPE source_type AS ENUM ('youtube', 'article', 'bilibili', 'rss', 'manual');
CREATE TYPE content_status AS ENUM (
  'discovered',
  'metadata_fetched',
  'filtered_out',
  'transcript_ready',
  'analysis_ready',
  'quiz_ready',
  'published',
  'hidden',
  'deleted',
  'failed'
);
CREATE TYPE difficulty_level AS ENUM ('beginner', 'normal');
CREATE TYPE admin_role AS ENUM ('owner', 'admin', 'editor', 'viewer');
CREATE TYPE channel_list_type AS ENUM ('recommended', 'blacklisted', 'neutral');
CREATE TYPE run_status AS ENUM ('running', 'succeeded', 'partial_failed', 'failed', 'cancelled');
CREATE TYPE llm_task_type AS ENUM ('classify', 'summarize', 'quiz', 'learning_path', 'repair_json');
```

## 3. 管理者與權限

### admins

```sql
CREATE TABLE admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role admin_role NOT NULL DEFAULT 'editor',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### admin_sessions

若使用 Auth.js，可不建此表，改由 Auth.js schema 管理。

```sql
CREATE TABLE admin_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES admins(id),
  session_token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### audit_logs

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES admins(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  before_json JSONB,
  after_json JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## 4. 主題與關鍵字

### topics

```sql
CREATE TABLE topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name_zh_hant TEXT NOT NULL,
  description TEXT,
  parent_topic_id UUID REFERENCES topics(id),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### topic_keywords

```sql
CREATE TABLE topic_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  keyword_type TEXT NOT NULL CHECK (keyword_type IN ('positive', 'negative', 'synonym', 'tw_term', 'cn_term', 'english')),
  weight NUMERIC(8,4) NOT NULL DEFAULT 1.0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(topic_id, keyword, keyword_type)
);
```

### topic_search_settings

```sql
CREATE TABLE topic_search_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID NOT NULL UNIQUE REFERENCES topics(id) ON DELETE CASCADE,
  freshness_days INTEGER NOT NULL DEFAULT 90,
  candidate_limit INTEGER NOT NULL DEFAULT 50,
  top_n INTEGER NOT NULL DEFAULT 20,
  min_duration_seconds INTEGER NOT NULL DEFAULT 300,
  max_duration_seconds INTEGER NOT NULL DEFAULT 7200,
  exclude_shorts BOOLEAN NOT NULL DEFAULT TRUE,
  min_view_count BIGINT NOT NULL DEFAULT 0,
  min_engagement_score NUMERIC(8,6) NOT NULL DEFAULT 0.05,
  growth_guardrail_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  min_views_per_day INTEGER NOT NULL DEFAULT 250,
  auto_publish BOOLEAN NOT NULL DEFAULT TRUE,
  youtube_region_code TEXT NOT NULL DEFAULT 'TW',
  relevance_language TEXT NOT NULL DEFAULT 'zh-Hant',
  search_order TEXT NOT NULL DEFAULT 'relevance',
  schedule_cron TEXT NOT NULL DEFAULT '0 21 * * *',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

備註：`schedule_cron` 可先作為設定紀錄；免費部署時實際排程由 GitHub Actions 或 Vercel cron 控制。

## 5. 頻道

### channels

```sql
CREATE TABLE channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type source_type NOT NULL DEFAULT 'youtube',
  source_channel_id TEXT NOT NULL,
  handle TEXT,
  title TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  subscriber_count BIGINT,
  video_count BIGINT,
  view_count BIGINT,
  list_type channel_list_type NOT NULL DEFAULT 'neutral',
  trust_weight NUMERIC(8,4) NOT NULL DEFAULT 0,
  recommendation_reason TEXT,
  metadata_json JSONB,
  last_fetched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(source_type, source_channel_id)
);
```

## 6. 內容主表

### content_items

```sql
CREATE TABLE content_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type source_type NOT NULL,
  source_content_id TEXT NOT NULL,
  source_url TEXT NOT NULL,
  canonical_url TEXT,
  title TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  channel_id UUID REFERENCES channels(id),
  channel_title TEXT,
  language TEXT,
  caption_language TEXT,
  published_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  status content_status NOT NULL DEFAULT 'discovered',
  is_tutorial BOOLEAN,
  tutorial_confidence NUMERIC(5,4),
  tutorial_reason TEXT,
  difficulty difficulty_level NOT NULL DEFAULT 'normal',
  difficulty_confidence NUMERIC(5,4),
  difficulty_reason TEXT,
  difficulty_overridden_by UUID REFERENCES admins(id),
  difficulty_overridden_at TIMESTAMPTZ,
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  manual_sort_order INTEGER,
  hidden_reason TEXT,
  raw_metadata_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(source_type, source_content_id)
);
```

### youtube_video_stats

統計數字會變動，保留歷史 snapshot。

```sql
CREATE TABLE youtube_video_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  view_count BIGINT NOT NULL DEFAULT 0,
  like_count BIGINT NOT NULL DEFAULT 0,
  comment_count BIGINT NOT NULL DEFAULT 0,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(content_item_id, fetched_at)
);
```

### content_scores

```sql
CREATE TABLE content_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  topic_id UUID REFERENCES topics(id),
  age_days INTEGER NOT NULL,
  engagement_score NUMERIC(12,8) NOT NULL,
  fresh_engagement_score NUMERIC(12,8) NOT NULL,
  view_velocity NUMERIC(16,4) NOT NULL,
  comment_signal NUMERIC(8,6) NOT NULL,
  channel_trust_score NUMERIC(8,6) NOT NULL DEFAULT 0,
  topic_relevance_score NUMERIC(8,6),
  tutorial_quality_score NUMERIC(8,6),
  radar_score NUMERIC(12,8),
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(content_item_id, topic_id, calculated_at)
);
```

## 7. Transcript 與摘要

### transcripts

```sql
CREATE TABLE transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  language TEXT NOT NULL,
  source TEXT NOT NULL,
  transcript_text TEXT NOT NULL,
  transcript_hash TEXT NOT NULL,
  retrieved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(content_item_id, transcript_hash)
);
```

### content_summaries

```sql
CREATE TABLE content_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  transcript_id UUID REFERENCES transcripts(id),
  prompt_version TEXT NOT NULL,
  provider TEXT NOT NULL,
  model_id TEXT NOT NULL,
  suitable_for TEXT NOT NULL,
  short_summary TEXT NOT NULL,
  full_summary TEXT NOT NULL,
  transcript_summary TEXT,
  raw_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(content_item_id, transcript_id, prompt_version, provider, model_id)
);
```

### learning_objectives

```sql
CREATE TABLE learning_objectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  objective_text TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);
```

### tags

```sql
CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  normalized_name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### content_tags

```sql
CREATE TABLE content_tags (
  content_item_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  confidence NUMERIC(5,4),
  source TEXT NOT NULL DEFAULT 'llm',
  PRIMARY KEY(content_item_id, tag_id)
);
```

### content_topics

```sql
CREATE TABLE content_topics (
  content_item_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  relevance_score NUMERIC(8,6),
  source TEXT NOT NULL DEFAULT 'worker',
  PRIMARY KEY(content_item_id, topic_id)
);
```

## 8. Quiz

### quizzes

```sql
CREATE TABLE quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  prompt_version TEXT NOT NULL,
  provider TEXT NOT NULL,
  model_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(content_item_id, prompt_version, provider, model_id)
);
```

### quiz_questions

```sql
CREATE TABLE quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  question_type TEXT NOT NULL CHECK (question_type IN ('comprehension', 'application', 'concept')),
  question_text TEXT NOT NULL,
  correct_option_key TEXT NOT NULL CHECK (correct_option_key IN ('A', 'B', 'C', 'D')),
  explanation TEXT NOT NULL,
  evidence_text TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);
```

### quiz_options

```sql
CREATE TABLE quiz_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
  option_key TEXT NOT NULL CHECK (option_key IN ('A', 'B', 'C', 'D')),
  option_text TEXT NOT NULL,
  UNIQUE(question_id, option_key)
);
```

## 9. Daily snapshots

### daily_digest_snapshots

```sql
CREATE TABLE daily_digest_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID NOT NULL REFERENCES topics(id),
  snapshot_date DATE NOT NULL,
  ranking_method TEXT NOT NULL DEFAULT 'fresh_engagement_score',
  created_by_run_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(topic_id, snapshot_date, ranking_method)
);
```

### daily_digest_items

```sql
CREATE TABLE daily_digest_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id UUID NOT NULL REFERENCES daily_digest_snapshots(id) ON DELETE CASCADE,
  content_item_id UUID NOT NULL REFERENCES content_items(id),
  rank INTEGER NOT NULL,
  score NUMERIC(12,8) NOT NULL,
  is_manual_override BOOLEAN NOT NULL DEFAULT FALSE,
  manual_reason TEXT,
  UNIQUE(snapshot_id, rank),
  UNIQUE(snapshot_id, content_item_id)
);
```

## 10. Agent runs

### agent_runs

```sql
CREATE TABLE agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('scheduled', 'manual', 'backfill', 'test')),
  status run_status NOT NULL DEFAULT 'running',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  requested_by_admin_id UUID REFERENCES admins(id),
  settings_snapshot JSONB,
  summary_json JSONB,
  error_message TEXT
);
```

### agent_run_events

```sql
CREATE TABLE agent_run_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  topic_id UUID REFERENCES topics(id),
  content_item_id UUID REFERENCES content_items(id),
  phase TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('debug', 'info', 'warning', 'error')),
  message TEXT NOT NULL,
  data_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### search_result_candidates

```sql
CREATE TABLE search_result_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  topic_id UUID REFERENCES topics(id),
  query TEXT NOT NULL,
  source_type source_type NOT NULL DEFAULT 'youtube',
  source_content_id TEXT NOT NULL,
  raw_result_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(run_id, topic_id, query, source_type, source_content_id)
);
```

## 11. LLM settings 與 logs

### llm_api_keys

```sql
CREATE TABLE llm_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  display_name TEXT NOT NULL,
  encrypted_key TEXT NOT NULL,
  encryption_iv TEXT NOT NULL,
  encryption_tag TEXT NOT NULL,
  masked_key TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_validated_at TIMESTAMPTZ,
  validation_status TEXT,
  validation_error TEXT,
  created_by_admin_id UUID REFERENCES admins(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### llm_model_settings

```sql
CREATE TABLE llm_model_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_type llm_task_type NOT NULL,
  provider TEXT NOT NULL,
  model_id TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(task_type, provider, model_id)
);
```

### llm_call_logs

```sql
CREATE TABLE llm_call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES agent_runs(id),
  content_item_id UUID REFERENCES content_items(id),
  task_type llm_task_type NOT NULL,
  provider TEXT NOT NULL,
  model_id TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('succeeded', 'failed', 'fallback')),
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost_estimate_usd NUMERIC(12,6),
  latency_ms INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## 12. Future user progress tables

MVP 不使用，但可預留 migration：

```sql
CREATE TABLE users_future (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE quiz_attempts_future (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users_future(id),
  quiz_id UUID REFERENCES quizzes(id),
  score INTEGER,
  total INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## 13. 索引建議

```sql
CREATE INDEX idx_content_items_source ON content_items(source_type, source_content_id);
CREATE INDEX idx_content_items_status ON content_items(status);
CREATE INDEX idx_content_items_published_at ON content_items(published_at DESC);
CREATE INDEX idx_content_items_difficulty ON content_items(difficulty);
CREATE INDEX idx_content_items_channel_id ON content_items(channel_id);
CREATE INDEX idx_youtube_video_stats_content_fetched ON youtube_video_stats(content_item_id, fetched_at DESC);
CREATE INDEX idx_daily_snapshots_topic_date ON daily_digest_snapshots(topic_id, snapshot_date DESC);
CREATE INDEX idx_daily_items_snapshot_rank ON daily_digest_items(snapshot_id, rank);
CREATE INDEX idx_agent_run_events_run ON agent_run_events(run_id, created_at DESC);
CREATE INDEX idx_tags_normalized ON tags(normalized_name);
```

若 PostgreSQL 服務允許：

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_content_title_trgm ON content_items USING gin (title gin_trgm_ops);
CREATE INDEX idx_summary_short_trgm ON content_summaries USING gin (short_summary gin_trgm_ops);
CREATE INDEX idx_summary_full_trgm ON content_summaries USING gin (full_summary gin_trgm_ops);
```

## 14. Seed data

MVP 初始 seed：

- topic：人工智慧。
- 子題：AI 入門、生成式 AI、Prompt Engineering、LLM、RAG、AI Agent、Python AI 入門等。
- 預設 topic_search_settings。
- 第一個 owner admin。

