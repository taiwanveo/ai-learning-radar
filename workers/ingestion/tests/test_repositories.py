from __future__ import annotations

from contextlib import AbstractContextManager
from datetime import UTC, date, datetime
from types import TracebackType
from typing import Any
from uuid import UUID

import pytest

from ai_learning_radar_worker.repositories.postgres import PostgresRepository

IDS = [UUID(f"00000000-0000-4000-8000-{index:012d}") for index in range(1, 30)]


class FakeCursor:
    def __init__(
        self,
        row: tuple[Any, ...] | None = None,
        rows: list[tuple[Any, ...]] | None = None,
    ) -> None:
        self.row = row
        self.rows = rows or []

    def fetchone(self) -> tuple[Any, ...] | None:
        return self.row

    def fetchall(self) -> list[tuple[Any, ...]]:
        return self.rows


class FakeTransaction(AbstractContextManager[None]):
    def __init__(self, connection: FakeConnection) -> None:
        self.connection = connection

    def __enter__(self) -> None:
        self.connection.transactions += 1

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc_value: BaseException | None,
        traceback: TracebackType | None,
    ) -> bool:
        self.connection.rollbacks += exc_type is not None
        return False


class FakeConnection:
    def __init__(self) -> None:
        self.statements: list[tuple[str, Any]] = []
        self.transactions = 0
        self.rollbacks = 0
        self._ids = iter(IDS)

    def execute(self, query: str, params: Any = None) -> FakeCursor:
        normalized = " ".join(query.split())
        self.statements.append((normalized, params))
        return FakeCursor((next(self._ids),)) if "RETURNING id" in normalized else FakeCursor()

    def executemany(self, query: str, params_seq: Any) -> None:
        self.statements.append((" ".join(query.split()), list(params_seq)))

    def transaction(self) -> FakeTransaction:
        return FakeTransaction(self)


@pytest.fixture
def repository() -> tuple[PostgresRepository, FakeConnection]:
    connection = FakeConnection()
    return PostgresRepository(connection), connection


def test_upserts_channel_content_and_stats(
    repository: tuple[PostgresRepository, FakeConnection],
) -> None:
    repo, connection = repository
    channel_id = repo.upsert_channel({"source_channel_id": "UC1", "title": "Channel"})
    content_id = repo.upsert_content(
        {
            "source_content_id": "video-1",
            "source_url": "https://youtube.com/watch?v=video-1",
            "title": "AI 入門",
        },
        channel_id,
    )
    repo.save_video_stats(content_id, 100, 10, 3, datetime(2026, 7, 2, tzinfo=UTC))

    sql = " ".join(statement for statement, _ in connection.statements)
    assert "ON CONFLICT (source_type, source_channel_id)" in sql
    assert "ON CONFLICT (source_type, source_content_id)" in sql
    assert "INSERT INTO youtube_video_stats" in sql


def test_summary_and_quiz_are_atomic_replacements(
    repository: tuple[PostgresRepository, FakeConnection],
) -> None:
    repo, connection = repository
    content_id, transcript_id = IDS[10], IDS[11]
    repo.save_summary(
        content_id,
        transcript_id,
        prompt_version="2026-07-02.1",
        provider="mock",
        model_id="mock-model",
        summary={
            "suitable_for": "初學者",
            "short_summary": "摘要",
            "full_summary": "完整摘要",
            "transcript_summary": "逐字稿摘要",
            "learning_objectives": ["目標一", "目標二", "目標三"],
            "key_concepts": ["RAG"],
        },
    )
    repo.save_quiz(
        content_id,
        prompt_version="2026-07-02.1",
        provider="mock",
        model_id="mock-model",
        questions=[
            {
                "question_type": kind,
                "question_text": "題目",
                "correct_option_key": "A",
                "explanation": "解析",
                "evidence_text": "證據",
                "options": {"A": "甲", "B": "乙", "C": "丙", "D": "丁"},
            }
            for kind in ("comprehension", "application", "concept")
        ],
    )

    sql = " ".join(statement for statement, _ in connection.statements)
    assert connection.transactions == 2
    assert "DELETE FROM learning_objectives" in sql
    assert "DELETE FROM quiz_questions" in sql
    assert "INSERT INTO quiz_options" in sql
    assert "status = 'analysis_ready'" in sql
    assert "status = 'quiz_ready'" in sql


def test_snapshot_replaces_ranked_items_in_one_transaction(
    repository: tuple[PostgresRepository, FakeConnection],
) -> None:
    repo, connection = repository
    snapshot_id = repo.save_snapshot(
        IDS[0], date(2026, 7, 2), "fresh_engagement_score", IDS[1], [(IDS[2], 0.2), (IDS[3], 0.1)]
    )

    assert snapshot_id == IDS[0]
    assert connection.transactions == 1
    inserts = [
        params
        for sql, params in connection.statements
        if "INSERT INTO daily_digest_items" in sql
    ]
    assert inserts[0][0][2:] == (1, 0.2)
    assert inserts[0][1][2:] == (2, 0.1)


def test_run_and_event_logging(repository: tuple[PostgresRepository, FakeConnection]) -> None:
    repo, connection = repository
    run_id = repo.create_run("test", {"dry_run": True})
    repo.log_event(run_id, "search", "info", "started", data={"queries": 3})
    repo.finish_run(run_id, "succeeded", {"processed": 0})

    sql = " ".join(statement for statement, _ in connection.statements)
    assert "INSERT INTO agent_runs" in sql
    assert "INSERT INTO agent_run_events" in sql
    assert "UPDATE agent_runs" in sql


def test_topic_loading_and_classification_updates(
    repository: tuple[PostgresRepository, FakeConnection],
) -> None:
    repo, connection = repository
    assert repo.load_active_topics() == []
    repo.save_classification(
        IDS[0],
        IDS[1],
        {
            "is_tutorial": True,
            "tutorial_confidence": 0.9,
            "reason": "有步驟教學",
            "difficulty": "beginner",
            "difficulty_confidence": 0.8,
            "difficulty_reason": "不需先備知識",
            "topic_relevance_score": 0.95,
        },
    )
    repo.publish_content(IDS[0])

    sql = " ".join(statement for statement, _ in connection.statements)
    assert "FROM topics t" in sql
    assert "INSERT INTO content_topics" in sql
    assert "status = 'published'" in sql
