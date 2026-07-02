-- UUID defaults use PostgreSQL's built-in gen_random_uuid().
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "source_type" AS ENUM ('youtube', 'article', 'bilibili', 'rss', 'manual');

-- CreateEnum
CREATE TYPE "content_status" AS ENUM ('discovered', 'metadata_fetched', 'filtered_out', 'transcript_ready', 'analysis_ready', 'quiz_ready', 'published', 'hidden', 'deleted', 'failed');

-- CreateEnum
CREATE TYPE "difficulty_level" AS ENUM ('beginner', 'normal');

-- CreateEnum
CREATE TYPE "admin_role" AS ENUM ('owner', 'admin', 'editor', 'viewer');

-- CreateEnum
CREATE TYPE "channel_list_type" AS ENUM ('recommended', 'blacklisted', 'neutral');

-- CreateEnum
CREATE TYPE "run_status" AS ENUM ('running', 'succeeded', 'partial_failed', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "llm_task_type" AS ENUM ('classify', 'summarize', 'quiz', 'learning_path', 'repair_json');

-- CreateTable
CREATE TABLE "admins" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "admin_role" NOT NULL DEFAULT 'editor',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "admin_id" UUID NOT NULL,
    "session_token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "admin_id" UUID,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "before_json" JSONB,
    "after_json" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topics" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" TEXT NOT NULL,
    "name_zh_hant" TEXT NOT NULL,
    "description" TEXT,
    "parent_topic_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topic_keywords" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "topic_id" UUID NOT NULL,
    "keyword" TEXT NOT NULL,
    "keyword_type" TEXT NOT NULL,
    "weight" DECIMAL(8,4) NOT NULL DEFAULT 1.0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "topic_keywords_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topic_search_settings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "topic_id" UUID NOT NULL,
    "freshness_days" INTEGER NOT NULL DEFAULT 90,
    "candidate_limit" INTEGER NOT NULL DEFAULT 50,
    "top_n" INTEGER NOT NULL DEFAULT 20,
    "min_duration_seconds" INTEGER NOT NULL DEFAULT 300,
    "max_duration_seconds" INTEGER NOT NULL DEFAULT 7200,
    "exclude_shorts" BOOLEAN NOT NULL DEFAULT true,
    "min_view_count" BIGINT NOT NULL DEFAULT 0,
    "min_engagement_score" DECIMAL(8,6) NOT NULL DEFAULT 0.05,
    "growth_guardrail_enabled" BOOLEAN NOT NULL DEFAULT false,
    "min_views_per_day" INTEGER NOT NULL DEFAULT 250,
    "auto_publish" BOOLEAN NOT NULL DEFAULT true,
    "youtube_region_code" TEXT NOT NULL DEFAULT 'TW',
    "relevance_language" TEXT NOT NULL DEFAULT 'zh-Hant',
    "search_order" TEXT NOT NULL DEFAULT 'relevance',
    "schedule_cron" TEXT NOT NULL DEFAULT '0 21 * * *',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "topic_search_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channels" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "source_type" "source_type" NOT NULL DEFAULT 'youtube',
    "source_channel_id" TEXT NOT NULL,
    "handle" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "thumbnail_url" TEXT,
    "subscriber_count" BIGINT,
    "video_count" BIGINT,
    "view_count" BIGINT,
    "list_type" "channel_list_type" NOT NULL DEFAULT 'neutral',
    "trust_weight" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "recommendation_reason" TEXT,
    "metadata_json" JSONB,
    "last_fetched_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "source_type" "source_type" NOT NULL,
    "source_content_id" TEXT NOT NULL,
    "source_url" TEXT NOT NULL,
    "canonical_url" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "thumbnail_url" TEXT,
    "channel_id" UUID,
    "channel_title" TEXT,
    "language" TEXT,
    "caption_language" TEXT,
    "published_at" TIMESTAMPTZ(6),
    "duration_seconds" INTEGER,
    "status" "content_status" NOT NULL DEFAULT 'discovered',
    "is_tutorial" BOOLEAN,
    "tutorial_confidence" DECIMAL(5,4),
    "tutorial_reason" TEXT,
    "difficulty" "difficulty_level" NOT NULL DEFAULT 'normal',
    "difficulty_confidence" DECIMAL(5,4),
    "difficulty_reason" TEXT,
    "difficulty_overridden_by" UUID,
    "difficulty_overridden_at" TIMESTAMPTZ(6),
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "manual_sort_order" INTEGER,
    "hidden_reason" TEXT,
    "raw_metadata_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "youtube_video_stats" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "content_item_id" UUID NOT NULL,
    "view_count" BIGINT NOT NULL DEFAULT 0,
    "like_count" BIGINT NOT NULL DEFAULT 0,
    "comment_count" BIGINT NOT NULL DEFAULT 0,
    "fetched_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "youtube_video_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_scores" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "content_item_id" UUID NOT NULL,
    "topic_id" UUID,
    "age_days" INTEGER NOT NULL,
    "engagement_score" DECIMAL(12,8) NOT NULL,
    "fresh_engagement_score" DECIMAL(12,8) NOT NULL,
    "view_velocity" DECIMAL(16,4) NOT NULL,
    "comment_signal" DECIMAL(8,6) NOT NULL,
    "channel_trust_score" DECIMAL(8,6) NOT NULL DEFAULT 0,
    "topic_relevance_score" DECIMAL(8,6),
    "tutorial_quality_score" DECIMAL(8,6),
    "radar_score" DECIMAL(12,8),
    "calculated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transcripts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "content_item_id" UUID NOT NULL,
    "language" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "transcript_text" TEXT NOT NULL,
    "transcript_hash" TEXT NOT NULL,
    "retrieved_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transcripts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_summaries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "content_item_id" UUID NOT NULL,
    "transcript_id" UUID,
    "prompt_version" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model_id" TEXT NOT NULL,
    "suitable_for" TEXT NOT NULL,
    "short_summary" TEXT NOT NULL,
    "full_summary" TEXT NOT NULL,
    "transcript_summary" TEXT,
    "raw_json" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_objectives" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "content_item_id" UUID NOT NULL,
    "objective_text" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "learning_objectives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_tags" (
    "content_item_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,
    "confidence" DECIMAL(5,4),
    "source" TEXT NOT NULL DEFAULT 'llm',

    CONSTRAINT "content_tags_pkey" PRIMARY KEY ("content_item_id","tag_id")
);

-- CreateTable
CREATE TABLE "content_topics" (
    "content_item_id" UUID NOT NULL,
    "topic_id" UUID NOT NULL,
    "relevance_score" DECIMAL(8,6),
    "source" TEXT NOT NULL DEFAULT 'worker',

    CONSTRAINT "content_topics_pkey" PRIMARY KEY ("content_item_id","topic_id")
);

-- CreateTable
CREATE TABLE "quizzes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "content_item_id" UUID NOT NULL,
    "prompt_version" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quizzes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_questions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "quiz_id" UUID NOT NULL,
    "question_type" TEXT NOT NULL,
    "question_text" TEXT NOT NULL,
    "correct_option_key" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "evidence_text" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "quiz_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_options" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "question_id" UUID NOT NULL,
    "option_key" TEXT NOT NULL,
    "option_text" TEXT NOT NULL,

    CONSTRAINT "quiz_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_digest_snapshots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "topic_id" UUID NOT NULL,
    "snapshot_date" DATE NOT NULL,
    "ranking_method" TEXT NOT NULL DEFAULT 'fresh_engagement_score',
    "created_by_run_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_digest_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_digest_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "snapshot_id" UUID NOT NULL,
    "content_item_id" UUID NOT NULL,
    "rank" INTEGER NOT NULL,
    "score" DECIMAL(12,8) NOT NULL,
    "is_manual_override" BOOLEAN NOT NULL DEFAULT false,
    "manual_reason" TEXT,

    CONSTRAINT "daily_digest_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_runs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "trigger_type" TEXT NOT NULL,
    "status" "run_status" NOT NULL DEFAULT 'running',
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMPTZ(6),
    "requested_by_admin_id" UUID,
    "settings_snapshot" JSONB,
    "summary_json" JSONB,
    "error_message" TEXT,

    CONSTRAINT "agent_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_run_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "run_id" UUID NOT NULL,
    "topic_id" UUID,
    "content_item_id" UUID,
    "phase" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_run_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_result_candidates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "run_id" UUID NOT NULL,
    "topic_id" UUID,
    "query" TEXT NOT NULL,
    "source_type" "source_type" NOT NULL DEFAULT 'youtube',
    "source_content_id" TEXT NOT NULL,
    "raw_result_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_result_candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "llm_api_keys" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "provider" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "encrypted_key" TEXT NOT NULL,
    "encryption_iv" TEXT NOT NULL,
    "encryption_tag" TEXT NOT NULL,
    "masked_key" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_validated_at" TIMESTAMPTZ(6),
    "validation_status" TEXT,
    "validation_error" TEXT,
    "created_by_admin_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "llm_api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "llm_model_settings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "task_type" "llm_task_type" NOT NULL,
    "provider" TEXT NOT NULL,
    "model_id" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "llm_model_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "llm_call_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "run_id" UUID,
    "content_item_id" UUID,
    "task_type" "llm_task_type" NOT NULL,
    "provider" TEXT NOT NULL,
    "model_id" TEXT NOT NULL,
    "prompt_version" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "cost_estimate_usd" DECIMAL(12,6),
    "latency_ms" INTEGER,
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "llm_call_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admins_email_key" ON "admins"("email");

-- CreateIndex
CREATE UNIQUE INDEX "admin_sessions_session_token_hash_key" ON "admin_sessions"("session_token_hash");

-- CreateIndex
CREATE INDEX "admin_sessions_admin_id_idx" ON "admin_sessions"("admin_id");

-- CreateIndex
CREATE INDEX "audit_logs_admin_id_created_at_idx" ON "audit_logs"("admin_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "topics_slug_key" ON "topics"("slug");

-- CreateIndex
CREATE INDEX "topics_parent_topic_id_idx" ON "topics"("parent_topic_id");

-- CreateIndex
CREATE INDEX "topics_is_active_sort_order_idx" ON "topics"("is_active", "sort_order");

-- CreateIndex
CREATE INDEX "topic_keywords_topic_id_is_active_idx" ON "topic_keywords"("topic_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "topic_keywords_topic_id_keyword_keyword_type_key" ON "topic_keywords"("topic_id", "keyword", "keyword_type");

-- CreateIndex
CREATE UNIQUE INDEX "topic_search_settings_topic_id_key" ON "topic_search_settings"("topic_id");

-- CreateIndex
CREATE INDEX "channels_list_type_idx" ON "channels"("list_type");

-- CreateIndex
CREATE UNIQUE INDEX "channels_source_type_source_channel_id_key" ON "channels"("source_type", "source_channel_id");

-- CreateIndex
CREATE INDEX "content_items_status_idx" ON "content_items"("status");

-- CreateIndex
CREATE INDEX "content_items_published_at_idx" ON "content_items"("published_at" DESC);

-- CreateIndex
CREATE INDEX "content_items_difficulty_idx" ON "content_items"("difficulty");

-- CreateIndex
CREATE INDEX "content_items_channel_id_idx" ON "content_items"("channel_id");

-- CreateIndex
CREATE UNIQUE INDEX "content_items_source_type_source_content_id_key" ON "content_items"("source_type", "source_content_id");

-- CreateIndex
CREATE INDEX "youtube_video_stats_content_item_id_fetched_at_idx" ON "youtube_video_stats"("content_item_id", "fetched_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "youtube_video_stats_content_item_id_fetched_at_key" ON "youtube_video_stats"("content_item_id", "fetched_at");

-- CreateIndex
CREATE INDEX "content_scores_topic_id_calculated_at_idx" ON "content_scores"("topic_id", "calculated_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "content_scores_content_item_id_topic_id_calculated_at_key" ON "content_scores"("content_item_id", "topic_id", "calculated_at");

-- CreateIndex
CREATE UNIQUE INDEX "transcripts_content_item_id_transcript_hash_key" ON "transcripts"("content_item_id", "transcript_hash");

-- CreateIndex
CREATE INDEX "content_summaries_content_item_id_created_at_idx" ON "content_summaries"("content_item_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "content_summaries_content_item_id_transcript_id_prompt_vers_key" ON "content_summaries"("content_item_id", "transcript_id", "prompt_version", "provider", "model_id");

-- CreateIndex
CREATE INDEX "learning_objectives_content_item_id_sort_order_idx" ON "learning_objectives"("content_item_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "tags_name_key" ON "tags"("name");

-- CreateIndex
CREATE UNIQUE INDEX "tags_normalized_name_key" ON "tags"("normalized_name");

-- CreateIndex
CREATE INDEX "content_tags_tag_id_idx" ON "content_tags"("tag_id");

-- CreateIndex
CREATE INDEX "content_topics_topic_id_idx" ON "content_topics"("topic_id");

-- CreateIndex
CREATE UNIQUE INDEX "quizzes_content_item_id_prompt_version_provider_model_id_key" ON "quizzes"("content_item_id", "prompt_version", "provider", "model_id");

-- CreateIndex
CREATE INDEX "quiz_questions_quiz_id_sort_order_idx" ON "quiz_questions"("quiz_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "quiz_options_question_id_option_key_key" ON "quiz_options"("question_id", "option_key");

-- CreateIndex
CREATE INDEX "daily_digest_snapshots_topic_id_snapshot_date_idx" ON "daily_digest_snapshots"("topic_id", "snapshot_date" DESC);

-- CreateIndex
CREATE INDEX "daily_digest_snapshots_created_by_run_id_idx" ON "daily_digest_snapshots"("created_by_run_id");

-- CreateIndex
CREATE UNIQUE INDEX "daily_digest_snapshots_topic_id_snapshot_date_ranking_metho_key" ON "daily_digest_snapshots"("topic_id", "snapshot_date", "ranking_method");

-- CreateIndex
CREATE INDEX "daily_digest_items_snapshot_id_rank_idx" ON "daily_digest_items"("snapshot_id", "rank");

-- CreateIndex
CREATE INDEX "daily_digest_items_content_item_id_idx" ON "daily_digest_items"("content_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "daily_digest_items_snapshot_id_rank_key" ON "daily_digest_items"("snapshot_id", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "daily_digest_items_snapshot_id_content_item_id_key" ON "daily_digest_items"("snapshot_id", "content_item_id");

-- CreateIndex
CREATE INDEX "agent_runs_status_started_at_idx" ON "agent_runs"("status", "started_at" DESC);

-- CreateIndex
CREATE INDEX "agent_runs_requested_by_admin_id_idx" ON "agent_runs"("requested_by_admin_id");

-- CreateIndex
CREATE INDEX "agent_run_events_run_id_created_at_idx" ON "agent_run_events"("run_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "agent_run_events_topic_id_idx" ON "agent_run_events"("topic_id");

-- CreateIndex
CREATE INDEX "agent_run_events_content_item_id_idx" ON "agent_run_events"("content_item_id");

-- CreateIndex
CREATE INDEX "search_result_candidates_run_id_idx" ON "search_result_candidates"("run_id");

-- CreateIndex
CREATE INDEX "search_result_candidates_topic_id_idx" ON "search_result_candidates"("topic_id");

-- CreateIndex
CREATE UNIQUE INDEX "search_result_candidates_run_id_topic_id_query_source_type__key" ON "search_result_candidates"("run_id", "topic_id", "query", "source_type", "source_content_id");

-- CreateIndex
CREATE INDEX "llm_api_keys_provider_is_active_idx" ON "llm_api_keys"("provider", "is_active");

-- CreateIndex
CREATE INDEX "llm_api_keys_created_by_admin_id_idx" ON "llm_api_keys"("created_by_admin_id");

-- CreateIndex
CREATE INDEX "llm_model_settings_task_type_is_active_priority_idx" ON "llm_model_settings"("task_type", "is_active", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "llm_model_settings_task_type_provider_model_id_key" ON "llm_model_settings"("task_type", "provider", "model_id");

-- CreateIndex
CREATE INDEX "llm_call_logs_run_id_created_at_idx" ON "llm_call_logs"("run_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "llm_call_logs_content_item_id_idx" ON "llm_call_logs"("content_item_id");

-- CreateIndex
CREATE INDEX "llm_call_logs_task_type_created_at_idx" ON "llm_call_logs"("task_type", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topics" ADD CONSTRAINT "topics_parent_topic_id_fkey" FOREIGN KEY ("parent_topic_id") REFERENCES "topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topic_keywords" ADD CONSTRAINT "topic_keywords_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topic_search_settings" ADD CONSTRAINT "topic_search_settings_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_difficulty_overridden_by_fkey" FOREIGN KEY ("difficulty_overridden_by") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "youtube_video_stats" ADD CONSTRAINT "youtube_video_stats_content_item_id_fkey" FOREIGN KEY ("content_item_id") REFERENCES "content_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_scores" ADD CONSTRAINT "content_scores_content_item_id_fkey" FOREIGN KEY ("content_item_id") REFERENCES "content_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_scores" ADD CONSTRAINT "content_scores_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transcripts" ADD CONSTRAINT "transcripts_content_item_id_fkey" FOREIGN KEY ("content_item_id") REFERENCES "content_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_summaries" ADD CONSTRAINT "content_summaries_content_item_id_fkey" FOREIGN KEY ("content_item_id") REFERENCES "content_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_summaries" ADD CONSTRAINT "content_summaries_transcript_id_fkey" FOREIGN KEY ("transcript_id") REFERENCES "transcripts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_objectives" ADD CONSTRAINT "learning_objectives_content_item_id_fkey" FOREIGN KEY ("content_item_id") REFERENCES "content_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_tags" ADD CONSTRAINT "content_tags_content_item_id_fkey" FOREIGN KEY ("content_item_id") REFERENCES "content_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_tags" ADD CONSTRAINT "content_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_topics" ADD CONSTRAINT "content_topics_content_item_id_fkey" FOREIGN KEY ("content_item_id") REFERENCES "content_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_topics" ADD CONSTRAINT "content_topics_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_content_item_id_fkey" FOREIGN KEY ("content_item_id") REFERENCES "content_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_options" ADD CONSTRAINT "quiz_options_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "quiz_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_digest_snapshots" ADD CONSTRAINT "daily_digest_snapshots_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_digest_snapshots" ADD CONSTRAINT "daily_digest_snapshots_created_by_run_id_fkey" FOREIGN KEY ("created_by_run_id") REFERENCES "agent_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_digest_items" ADD CONSTRAINT "daily_digest_items_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "daily_digest_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_digest_items" ADD CONSTRAINT "daily_digest_items_content_item_id_fkey" FOREIGN KEY ("content_item_id") REFERENCES "content_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_requested_by_admin_id_fkey" FOREIGN KEY ("requested_by_admin_id") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_run_events" ADD CONSTRAINT "agent_run_events_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "agent_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_run_events" ADD CONSTRAINT "agent_run_events_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_run_events" ADD CONSTRAINT "agent_run_events_content_item_id_fkey" FOREIGN KEY ("content_item_id") REFERENCES "content_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_result_candidates" ADD CONSTRAINT "search_result_candidates_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "agent_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_result_candidates" ADD CONSTRAINT "search_result_candidates_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "llm_api_keys" ADD CONSTRAINT "llm_api_keys_created_by_admin_id_fkey" FOREIGN KEY ("created_by_admin_id") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "llm_call_logs" ADD CONSTRAINT "llm_call_logs_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "agent_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "llm_call_logs" ADD CONSTRAINT "llm_call_logs_content_item_id_fkey" FOREIGN KEY ("content_item_id") REFERENCES "content_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;



-- Domain checks documented in DataModel.md and invariants relied on by the worker.
ALTER TABLE "topic_keywords" ADD CONSTRAINT "topic_keywords_keyword_type_check" CHECK ("keyword_type" IN ('positive', 'negative', 'synonym', 'tw_term', 'cn_term', 'english'));
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_question_type_check" CHECK ("question_type" IN ('comprehension', 'application', 'concept'));
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_correct_option_key_check" CHECK ("correct_option_key" IN ('A', 'B', 'C', 'D'));
ALTER TABLE "quiz_options" ADD CONSTRAINT "quiz_options_option_key_check" CHECK ("option_key" IN ('A', 'B', 'C', 'D'));
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_trigger_type_check" CHECK ("trigger_type" IN ('scheduled', 'manual', 'backfill', 'test'));
ALTER TABLE "agent_run_events" ADD CONSTRAINT "agent_run_events_level_check" CHECK ("level" IN ('debug', 'info', 'warning', 'error'));
ALTER TABLE "llm_call_logs" ADD CONSTRAINT "llm_call_logs_status_check" CHECK ("status" IN ('succeeded', 'failed', 'fallback'));

ALTER TABLE "topic_search_settings" ADD CONSTRAINT "topic_search_settings_limits_check" CHECK ("freshness_days" > 0 AND "candidate_limit" > 0 AND "top_n" > 0 AND "top_n" <= "candidate_limit");
ALTER TABLE "topic_search_settings" ADD CONSTRAINT "topic_search_settings_duration_check" CHECK ("min_duration_seconds" >= 0 AND "max_duration_seconds" >= "min_duration_seconds");
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_duration_check" CHECK ("duration_seconds" IS NULL OR "duration_seconds" >= 0);
ALTER TABLE "youtube_video_stats" ADD CONSTRAINT "youtube_video_stats_nonnegative_check" CHECK ("view_count" >= 0 AND "like_count" >= 0 AND "comment_count" >= 0);
ALTER TABLE "content_scores" ADD CONSTRAINT "content_scores_age_days_check" CHECK ("age_days" >= 1);
ALTER TABLE "daily_digest_items" ADD CONSTRAINT "daily_digest_items_rank_check" CHECK ("rank" >= 1);
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_tutorial_confidence_check" CHECK ("tutorial_confidence" IS NULL OR "tutorial_confidence" BETWEEN 0 AND 1);
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_difficulty_confidence_check" CHECK ("difficulty_confidence" IS NULL OR "difficulty_confidence" BETWEEN 0 AND 1);
ALTER TABLE "content_tags" ADD CONSTRAINT "content_tags_confidence_check" CHECK ("confidence" IS NULL OR "confidence" BETWEEN 0 AND 1);
ALTER TABLE "content_topics" ADD CONSTRAINT "content_topics_relevance_score_check" CHECK ("relevance_score" IS NULL OR "relevance_score" BETWEEN 0 AND 1);
