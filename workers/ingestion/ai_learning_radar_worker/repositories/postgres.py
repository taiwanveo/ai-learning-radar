"""Transaction-safe PostgreSQL persistence for the ingestion worker."""

from __future__ import annotations

import json
from collections.abc import Iterable, Mapping, Sequence
from datetime import date, datetime
from typing import Any, Protocol
from uuid import UUID


class ResultCursor(Protocol):
    def fetchone(self) -> Sequence[Any] | None: ...

    def fetchall(self) -> Sequence[Sequence[Any]]: ...


class TransactionContext(Protocol):
    def __enter__(self) -> Any: ...

    def __exit__(self, exc_type: object, exc: object, traceback: object) -> bool | None: ...


class DatabaseConnection(Protocol):
    def execute(self, query: str, params: Sequence[Any] | None = None) -> ResultCursor: ...

    def transaction(self) -> TransactionContext: ...


def _json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, default=str, separators=(",", ":"))


def _required_id(cursor: ResultCursor, operation: str) -> UUID:
    row = cursor.fetchone()
    if row is None:
        raise RuntimeError(f"{operation} did not return an id")
    return UUID(str(row[0]))


def _execute_many(
    connection: DatabaseConnection,
    query: str,
    params_seq: Iterable[Sequence[Any]],
) -> None:
    for params in params_seq:
        connection.execute(query, params)


class PostgresRepository:
    """SQL repository with caller-owned connection lifecycle.

    Multi-statement writes are wrapped in explicit transactions. The injected
    connection makes the SQL contract testable without opening a network socket.
    """

    def __init__(self, connection: DatabaseConnection) -> None:
        self._connection = connection

    def load_active_topics(self, topic_id: UUID | None = None) -> list[dict[str, Any]]:
        cursor = self._connection.execute(
            """
            SELECT jsonb_build_object(
              'id', t.id, 'slug', t.slug, 'name', t.name_zh_hant,
              'settings', jsonb_build_object(
                'freshness_days', s.freshness_days,
                'candidate_limit', s.candidate_limit,
                'top_n', s.top_n,
                'min_duration_seconds', s.min_duration_seconds,
                'max_duration_seconds', s.max_duration_seconds,
                'exclude_shorts', s.exclude_shorts,
                'min_view_count', s.min_view_count,
                'min_engagement_score', s.min_engagement_score,
                'growth_guardrail_enabled', s.growth_guardrail_enabled,
                'min_views_per_day', s.min_views_per_day,
                'auto_publish', s.auto_publish,
                'youtube_region_code', s.youtube_region_code,
                'relevance_language', s.relevance_language,
                'search_order', s.search_order
              ),
              'keywords', COALESCE(
                jsonb_agg(jsonb_build_object(
                  'keyword', k.keyword, 'keyword_type', k.keyword_type,
                  'weight', k.weight, 'is_active', k.is_active
                ) ORDER BY k.weight DESC, k.created_at)
                FILTER (WHERE k.id IS NOT NULL), '[]'::jsonb
              )
            )
            FROM topics t
            JOIN topic_search_settings s ON s.topic_id = t.id
            LEFT JOIN topic_keywords k ON k.topic_id = t.id AND k.is_active = true
            WHERE t.is_active = true AND (%s::uuid IS NULL OR t.id = %s)
            GROUP BY t.id, s.id
            ORDER BY t.sort_order, t.name_zh_hant
            """,
            (topic_id, topic_id),
        )
        return [dict(row[0]) for row in cursor.fetchall()]

    def load_channel_policies(
        self, source_channel_ids: Sequence[str]
    ) -> dict[str, dict[str, Any]]:
        if not source_channel_ids:
            return {}
        cursor = self._connection.execute(
            """
            SELECT source_channel_id, list_type::text, trust_weight
            FROM channels
            WHERE source_type = 'youtube' AND source_channel_id = ANY(%s)
            """,
            (list(source_channel_ids),),
        )
        return {
            str(row[0]): {"list_type": str(row[1]), "trust_weight": float(row[2])}
            for row in cursor.fetchall()
        }

    def load_llm_api_keys(self) -> dict[str, dict[str, str]]:
        """Latest active encrypted API key envelope per provider (BYOK)."""
        cursor = self._connection.execute(
            """
            SELECT DISTINCT ON (provider) provider, encrypted_key, encryption_iv, encryption_tag
            FROM llm_api_keys
            WHERE is_active = true
            ORDER BY provider, updated_at DESC
            """
        )
        return {
            str(row[0]): {
                "encrypted_key": str(row[1]),
                "encryption_iv": str(row[2]),
                "encryption_tag": str(row[3]),
            }
            for row in cursor.fetchall()
        }

    def load_llm_fallback_chains(self) -> dict[str, list[tuple[str, str]]]:
        """Active provider/model fallback chain per task, in priority order."""
        cursor = self._connection.execute(
            """
            SELECT task_type::text, provider, model_id
            FROM llm_model_settings
            WHERE is_active = true
            ORDER BY task_type, priority
            """
        )
        chains: dict[str, list[tuple[str, str]]] = {}
        for row in cursor.fetchall():
            chains.setdefault(str(row[0]), []).append((str(row[1]), str(row[2])))
        return chains

    def create_run(
        self,
        trigger_type: str,
        settings_snapshot: Mapping[str, Any],
        requested_by_admin_id: UUID | None = None,
    ) -> UUID:
        cursor = self._connection.execute(
            """
            INSERT INTO agent_runs (trigger_type, requested_by_admin_id, settings_snapshot)
            VALUES (%s, %s, %s::jsonb)
            RETURNING id
            """,
            (trigger_type, requested_by_admin_id, _json(settings_snapshot)),
        )
        return _required_id(cursor, "create_run")

    def claim_run(self, run_id: UUID, settings_snapshot: Mapping[str, Any]) -> None:
        """Take over a queued run created by the admin console."""
        cursor = self._connection.execute(
            """
            UPDATE agent_runs
            SET status = 'running', started_at = now(), settings_snapshot = %s::jsonb
            WHERE id = %s
            RETURNING id
            """,
            (_json(settings_snapshot), run_id),
        )
        if cursor.fetchone() is None:
            raise RuntimeError(f"run {run_id} does not exist")

    def finish_run(
        self,
        run_id: UUID,
        status: str,
        summary: Mapping[str, Any],
        error_message: str | None = None,
    ) -> None:
        self._connection.execute(
            """
            UPDATE agent_runs
            SET status = %s, ended_at = now(), summary_json = %s::jsonb, error_message = %s
            WHERE id = %s
            """,
            (status, _json(summary), error_message, run_id),
        )

    def log_event(
        self,
        run_id: UUID,
        phase: str,
        level: str,
        message: str,
        *,
        topic_id: UUID | None = None,
        content_item_id: UUID | None = None,
        data: Mapping[str, Any] | None = None,
    ) -> None:
        self._connection.execute(
            """
            INSERT INTO agent_run_events
              (run_id, topic_id, content_item_id, phase, level, message, data_json)
            VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb)
            """,
            (run_id, topic_id, content_item_id, phase, level, message, _json(data or {})),
        )

    def record_search_candidate(
        self,
        run_id: UUID,
        topic_id: UUID,
        query: str,
        source_content_id: str,
        raw_result: Mapping[str, Any],
    ) -> None:
        self._connection.execute(
            """
            INSERT INTO search_result_candidates
              (run_id, topic_id, query, source_type, source_content_id, raw_result_json)
            VALUES (%s, %s, %s, 'youtube', %s, %s::jsonb)
            ON CONFLICT (run_id, topic_id, query, source_type, source_content_id)
            DO UPDATE SET raw_result_json = EXCLUDED.raw_result_json
            """,
            (run_id, topic_id, query, source_content_id, _json(raw_result)),
        )

    def save_classification(
        self,
        content_item_id: UUID,
        topic_id: UUID,
        classification: Mapping[str, Any],
    ) -> None:
        with self._connection.transaction():
            self._connection.execute(
                """
                UPDATE content_items SET
                  is_tutorial = %s, tutorial_confidence = %s, tutorial_reason = %s,
                  difficulty = %s, difficulty_confidence = %s, difficulty_reason = %s,
                  updated_at = now()
                WHERE id = %s
                """,
                (
                    classification["is_tutorial"],
                    classification["tutorial_confidence"],
                    classification["reason"],
                    classification["difficulty"],
                    classification["difficulty_confidence"],
                    classification["difficulty_reason"],
                    content_item_id,
                ),
            )
            self._connection.execute(
                """
                INSERT INTO content_topics (content_item_id, topic_id, relevance_score, source)
                VALUES (%s, %s, %s, 'worker')
                ON CONFLICT (content_item_id, topic_id) DO UPDATE SET
                  relevance_score = EXCLUDED.relevance_score, source = EXCLUDED.source
                """,
                (content_item_id, topic_id, classification["topic_relevance_score"]),
            )

    def mark_filtered(self, content_item_id: UUID, reason: str) -> None:
        self._connection.execute(
            """
            UPDATE content_items
            SET status = 'filtered_out', hidden_reason = %s, updated_at = now() WHERE id = %s
            """,
            (reason, content_item_id),
        )

    def publish_content(self, content_item_id: UUID) -> None:
        self._connection.execute(
            "UPDATE content_items SET status = 'published', updated_at = now() WHERE id = %s",
            (content_item_id,),
        )

    def upsert_channel(self, channel: Mapping[str, Any]) -> UUID:
        cursor = self._connection.execute(
            """
            INSERT INTO channels
              (source_type, source_channel_id, handle, title, description, thumbnail_url,
               subscriber_count, video_count, view_count, metadata_json, last_fetched_at)
            VALUES ('youtube', %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, now())
            ON CONFLICT (source_type, source_channel_id) DO UPDATE SET
              handle = EXCLUDED.handle, title = EXCLUDED.title,
              description = EXCLUDED.description, thumbnail_url = EXCLUDED.thumbnail_url,
              subscriber_count = EXCLUDED.subscriber_count,
              video_count = EXCLUDED.video_count, view_count = EXCLUDED.view_count,
              metadata_json = EXCLUDED.metadata_json, last_fetched_at = now(), updated_at = now()
            RETURNING id
            """,
            (
                channel["source_channel_id"],
                channel.get("handle"),
                channel["title"],
                channel.get("description"),
                channel.get("thumbnail_url"),
                channel.get("subscriber_count"),
                channel.get("video_count"),
                channel.get("view_count"),
                _json(channel.get("raw", {})),
            ),
        )
        return _required_id(cursor, "upsert_channel")

    def upsert_content(self, content: Mapping[str, Any], channel_id: UUID | None) -> UUID:
        cursor = self._connection.execute(
            """
            INSERT INTO content_items
              (source_type, source_content_id, source_url, canonical_url, title, description,
               thumbnail_url, channel_id, channel_title, language, caption_language,
               published_at, duration_seconds, status, raw_metadata_json)
            VALUES ('youtube', %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                    'metadata_fetched', %s::jsonb)
            ON CONFLICT (source_type, source_content_id) DO UPDATE SET
              source_url = EXCLUDED.source_url, canonical_url = EXCLUDED.canonical_url,
              title = EXCLUDED.title, description = EXCLUDED.description,
              thumbnail_url = EXCLUDED.thumbnail_url, channel_id = EXCLUDED.channel_id,
              channel_title = EXCLUDED.channel_title, language = EXCLUDED.language,
              caption_language = EXCLUDED.caption_language,
              published_at = EXCLUDED.published_at, duration_seconds = EXCLUDED.duration_seconds,
              raw_metadata_json = EXCLUDED.raw_metadata_json, updated_at = now()
            RETURNING id
            """,
            (
                content["source_content_id"],
                content["source_url"],
                content.get("canonical_url"),
                content["title"],
                content.get("description"),
                content.get("thumbnail_url"),
                channel_id,
                content.get("channel_title"),
                content.get("language"),
                content.get("caption_language"),
                content.get("published_at"),
                content.get("duration_seconds"),
                _json(content.get("raw", {})),
            ),
        )
        return _required_id(cursor, "upsert_content")

    def save_video_stats(
        self,
        content_item_id: UUID,
        view_count: int,
        like_count: int,
        comment_count: int,
        fetched_at: datetime,
    ) -> None:
        self._connection.execute(
            """
            INSERT INTO youtube_video_stats
              (content_item_id, view_count, like_count, comment_count, fetched_at)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (content_item_id, fetched_at) DO UPDATE SET
              view_count = EXCLUDED.view_count, like_count = EXCLUDED.like_count,
              comment_count = EXCLUDED.comment_count
            """,
            (content_item_id, view_count, like_count, comment_count, fetched_at),
        )

    def save_transcript(
        self,
        content_item_id: UUID,
        language: str,
        source: str,
        text: str,
        transcript_hash: str,
    ) -> UUID:
        with self._connection.transaction():
            cursor = self._connection.execute(
                """
                INSERT INTO transcripts
                  (content_item_id, language, source, transcript_text, transcript_hash)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (content_item_id, transcript_hash) DO UPDATE SET
                  language = EXCLUDED.language, source = EXCLUDED.source,
                  transcript_text = EXCLUDED.transcript_text, retrieved_at = now()
                RETURNING id
                """,
                (content_item_id, language, source, text, transcript_hash),
            )
            transcript_id = _required_id(cursor, "save_transcript")
            self._connection.execute(
                """
                UPDATE content_items
                SET status = 'transcript_ready', updated_at = now() WHERE id = %s
                """,
                (content_item_id,),
            )
        return transcript_id

    def save_summary(
        self,
        content_item_id: UUID,
        transcript_id: UUID | None,
        *,
        prompt_version: str,
        provider: str,
        model_id: str,
        summary: Mapping[str, Any],
    ) -> UUID:
        with self._connection.transaction():
            if transcript_id is None:
                self._connection.execute(
                    """
                    DELETE FROM content_summaries
                    WHERE content_item_id = %s AND transcript_id IS NULL
                      AND prompt_version = %s AND provider = %s AND model_id = %s
                    """,
                    (content_item_id, prompt_version, provider, model_id),
                )
            cursor = self._connection.execute(
                """
                INSERT INTO content_summaries
                  (content_item_id, transcript_id, prompt_version, provider, model_id,
                   suitable_for, short_summary, full_summary, transcript_summary, raw_json)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb)
                ON CONFLICT (content_item_id, transcript_id, prompt_version, provider, model_id)
                DO UPDATE SET suitable_for = EXCLUDED.suitable_for,
                  short_summary = EXCLUDED.short_summary, full_summary = EXCLUDED.full_summary,
                  transcript_summary = EXCLUDED.transcript_summary, raw_json = EXCLUDED.raw_json
                RETURNING id
                """,
                (
                    content_item_id,
                    transcript_id,
                    prompt_version,
                    provider,
                    model_id,
                    summary["suitable_for"],
                    summary["short_summary"],
                    summary["full_summary"],
                    summary.get("transcript_summary"),
                    _json(summary),
                ),
            )
            summary_id = _required_id(cursor, "save_summary")
            self._connection.execute(
                "DELETE FROM learning_objectives WHERE content_item_id = %s",
                (content_item_id,),
            )
            _execute_many(
                self._connection,
                """
                INSERT INTO learning_objectives (content_item_id, objective_text, sort_order)
                VALUES (%s, %s, %s)
                """,
                [
                    (content_item_id, objective, index)
                    for index, objective in enumerate(summary["learning_objectives"], start=1)
                ],
            )
            self._save_tags(content_item_id, summary.get("key_concepts", []))
            self._connection.execute(
                """
                UPDATE content_items
                SET status = 'analysis_ready', updated_at = now() WHERE id = %s
                """,
                (content_item_id,),
            )
        return summary_id

    def _save_tags(self, content_item_id: UUID, tags: Iterable[str]) -> None:
        self._connection.execute(
            "DELETE FROM content_tags WHERE content_item_id = %s", (content_item_id,)
        )
        for tag_name in tags:
            normalized = tag_name.strip().casefold()
            cursor = self._connection.execute(
                """
                INSERT INTO tags (name, normalized_name) VALUES (%s, %s)
                ON CONFLICT (normalized_name) DO UPDATE SET name = EXCLUDED.name
                RETURNING id
                """,
                (tag_name.strip(), normalized),
            )
            tag_id = _required_id(cursor, "save_tag")
            self._connection.execute(
                """
                INSERT INTO content_tags (content_item_id, tag_id, source)
                VALUES (%s, %s, 'llm') ON CONFLICT (content_item_id, tag_id) DO NOTHING
                """,
                (content_item_id, tag_id),
            )

    def save_quiz(
        self,
        content_item_id: UUID,
        *,
        prompt_version: str,
        provider: str,
        model_id: str,
        questions: Sequence[Mapping[str, Any]],
    ) -> UUID:
        with self._connection.transaction():
            cursor = self._connection.execute(
                """
                INSERT INTO quizzes (content_item_id, prompt_version, provider, model_id)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (content_item_id, prompt_version, provider, model_id)
                DO UPDATE SET created_at = now()
                RETURNING id
                """,
                (content_item_id, prompt_version, provider, model_id),
            )
            quiz_id = _required_id(cursor, "save_quiz")
            self._connection.execute("DELETE FROM quiz_questions WHERE quiz_id = %s", (quiz_id,))
            for index, question in enumerate(questions, start=1):
                question_cursor = self._connection.execute(
                    """
                    INSERT INTO quiz_questions
                      (quiz_id, question_type, question_text, correct_option_key,
                       explanation, evidence_text, sort_order)
                    VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id
                    """,
                    (
                        quiz_id,
                        question["question_type"],
                        question["question_text"],
                        question["correct_option_key"],
                        question["explanation"],
                        question["evidence_text"],
                        index,
                    ),
                )
                question_id = _required_id(question_cursor, "save_quiz_question")
                _execute_many(
                    self._connection,
                    """
                    INSERT INTO quiz_options (question_id, option_key, option_text)
                    VALUES (%s, %s, %s)
                    """,
                    [
                        (question_id, key, question["options"][key])
                        for key in ("A", "B", "C", "D")
                    ],
                )
            self._connection.execute(
                "UPDATE content_items SET status = 'quiz_ready', updated_at = now() WHERE id = %s",
                (content_item_id,),
            )
        return quiz_id

    def save_score(self, content_item_id: UUID, topic_id: UUID, score: Mapping[str, Any]) -> UUID:
        cursor = self._connection.execute(
            """
            INSERT INTO content_scores
              (content_item_id, topic_id, age_days, engagement_score, fresh_engagement_score,
               view_velocity, comment_signal, channel_trust_score, topic_relevance_score,
               tutorial_quality_score, radar_score, calculated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (content_item_id, topic_id, calculated_at) DO UPDATE SET
              engagement_score = EXCLUDED.engagement_score,
              fresh_engagement_score = EXCLUDED.fresh_engagement_score,
              view_velocity = EXCLUDED.view_velocity, comment_signal = EXCLUDED.comment_signal,
              channel_trust_score = EXCLUDED.channel_trust_score,
              topic_relevance_score = EXCLUDED.topic_relevance_score,
              tutorial_quality_score = EXCLUDED.tutorial_quality_score,
              radar_score = EXCLUDED.radar_score
            RETURNING id
            """,
            (
                content_item_id,
                topic_id,
                score["age_days"],
                score["engagement_score"],
                score["fresh_engagement_score"],
                score["view_velocity"],
                score["comment_signal"],
                score.get("channel_trust_score", 0),
                score.get("topic_relevance_score"),
                score.get("tutorial_quality_score"),
                score.get("radar_score"),
                score.get("calculated_at", datetime.now().astimezone()),
            ),
        )
        return _required_id(cursor, "save_score")

    def save_snapshot(
        self,
        topic_id: UUID,
        snapshot_date: date,
        ranking_method: str,
        run_id: UUID,
        ranked_items: Sequence[tuple[UUID, float]],
    ) -> UUID:
        with self._connection.transaction():
            cursor = self._connection.execute(
                """
                INSERT INTO daily_digest_snapshots
                  (topic_id, snapshot_date, ranking_method, created_by_run_id)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (topic_id, snapshot_date, ranking_method) DO UPDATE SET
                  created_by_run_id = EXCLUDED.created_by_run_id, created_at = now()
                RETURNING id
                """,
                (topic_id, snapshot_date, ranking_method, run_id),
            )
            snapshot_id = _required_id(cursor, "save_snapshot")
            self._connection.execute(
                "DELETE FROM daily_digest_items WHERE snapshot_id = %s", (snapshot_id,)
            )
            _execute_many(
                self._connection,
                """
                INSERT INTO daily_digest_items (snapshot_id, content_item_id, rank, score)
                VALUES (%s, %s, %s, %s)
                """,
                [
                    (snapshot_id, content_item_id, rank, score)
                    for rank, (content_item_id, score) in enumerate(ranked_items, start=1)
                ],
            )
        return snapshot_id
