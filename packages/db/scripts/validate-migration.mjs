import { readFile } from "node:fs/promises";

const migrationUrl = new URL("../prisma/migrations/20260702000000_initial_schema/migration.sql", import.meta.url);
const sql = await readFile(migrationUrl, "utf8");

const requiredTables = [
  "admins", "admin_sessions", "audit_logs", "topics", "topic_keywords",
  "topic_search_settings", "channels", "content_items", "youtube_video_stats",
  "content_scores", "transcripts", "content_summaries", "learning_objectives",
  "tags", "content_tags", "content_topics", "quizzes", "quiz_questions",
  "quiz_options", "daily_digest_snapshots", "daily_digest_items", "agent_runs",
  "agent_run_events", "search_result_candidates", "llm_api_keys",
  "llm_model_settings", "llm_call_logs",
];

for (const table of requiredTables) {
  if (!sql.includes(`CREATE TABLE "${table}"`)) throw new Error(`Migration is missing table ${table}`);
}

const requiredFragments = [
  'CREATE UNIQUE INDEX "content_items_source_type_source_content_id_key"',
  'daily_digest_snapshots_created_by_run_id_fkey',
  'topic_keywords_keyword_type_check',
  'quiz_questions_correct_option_key_check',
  'agent_runs_trigger_type_check',
  'llm_call_logs_status_check',
];
for (const fragment of requiredFragments) {
  if (!sql.includes(fragment)) throw new Error(`Migration is missing ${fragment}`);
}

const agentRunsPosition = sql.indexOf('CREATE TABLE "agent_runs"');
const circularFkPosition = sql.indexOf('daily_digest_snapshots_created_by_run_id_fkey');
if (agentRunsPosition < 0 || circularFkPosition < agentRunsPosition) {
  throw new Error("Snapshot-to-run foreign key must be added after agent_runs exists");
}

console.log(`Migration valid: ${requiredTables.length} MVP tables and required constraints found.`);
