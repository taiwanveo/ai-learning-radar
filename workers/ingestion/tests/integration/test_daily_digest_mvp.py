from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import NAMESPACE_URL, UUID, uuid5

from ai_learning_radar_worker.llm.schemas import (
    ClassificationResult,
    QuizResult,
    SummaryResult,
)
from ai_learning_radar_worker.llm.tasks import TaskResult
from ai_learning_radar_worker.pipelines.daily_digest import DailyDigestPipeline
from ai_learning_radar_worker.sources.youtube import (
    ChannelMetadata,
    SearchResult,
    VideoMetadata,
)
from ai_learning_radar_worker.transcripts.youtube_transcript import TranscriptResult

NOW = datetime(2026, 7, 2, 8, tzinfo=UTC)
TOPIC_ID = UUID("30000000-0000-4000-8000-000000000001")


class FakeYouTube:
    """Deterministic source adapter; never performs an HTTP request."""

    video_ids = [f"fixture-video-{index:02}" for index in range(20)]

    def search(self, query: str, **kwargs: Any) -> list[SearchResult]:
        del query, kwargs
        return [
            SearchResult(video_id, f"AI 教學 {index}", "", "fixture-channel", "測試頻道", NOW, None)
            for index, video_id in enumerate(self.video_ids)
        ]

    def fetch_video_metadata(self, video_ids: list[str]) -> list[VideoMetadata]:
        return [
            VideoMetadata(
                video_id=video_id,
                title=f"AI 教學 {index}",
                description="完整逐步教學",
                channel_id="fixture-channel",
                channel_title="測試頻道",
                published_at=NOW,
                thumbnail_url=None,
                duration_seconds=900,
                view_count=10_000 - index * 100,
                like_count=1_000 - index * 10,
                comment_count=100 - index,
                default_language="zh-Hant",
                caption_available=True,
                raw={"fixture": True},
            )
            for index, video_id in enumerate(video_ids)
        ]

    def fetch_channel_metadata(self, channel_ids: Any) -> list[ChannelMetadata]:
        assert set(channel_ids) == {"fixture-channel"}
        return [
            ChannelMetadata(
                "fixture-channel", "測試頻道", "", None, None, 50_000, 100, 1_000_000, {}
            )
        ]


class FakeTranscripts:
    """Deterministic transcript adapter; never contacts YouTube."""

    def fetch(self, video_id: str) -> TranscriptResult:
        return TranscriptResult(
            video_id=video_id,
            text=f"{video_id} 的 AI 教學逐字稿，包含可驗證的步驟與範例。",
            language="zh-Hant",
            transcript_hash=f"fixture-hash-{video_id}",
            source="fixture",
            retrieved_at=NOW,
        )


class FakeLLM:
    """Schema-valid local task runner; never calls an LLM provider."""

    def classify(self, **kwargs: Any) -> TaskResult[ClassificationResult]:
        del kwargs
        return TaskResult(
            ClassificationResult(
                is_tutorial=True,
                tutorial_confidence=0.99,
                content_type="tutorial",
                difficulty="beginner",
                difficulty_confidence=0.95,
                topic_relevance_score=0.9,
                tutorial_quality_score=0.85,
                reason="包含完整步驟",
                difficulty_reason="不需要先備知識",
                signals=["步驟", "範例"],
            ),
            "classifier-fixture-v1",
            "fixture",
            "fixture-model",
        )

    def summarize(self, **kwargs: Any) -> TaskResult[SummaryResult]:
        del kwargs
        return TaskResult(
            SummaryResult(
                suitable_for="AI 初學者",
                short_summary="從基本概念到可執行範例的逐步教學。" * 10,
                full_summary="說明核心概念、實作步驟、驗證方法與常見限制。" * 30,
                transcript_summary="逐字稿涵蓋概念、步驟與驗證。" * 25,
                learning_objectives=["理解概念", "完成實作", "驗證結果"],
                key_concepts=["AI", "實作", "驗證"],
                limitations_or_cautions="正式環境需重新驗證。",
            ),
            "summary-fixture-v1",
            "fixture",
            "fixture-model",
        )

    def quiz(self, **kwargs: Any) -> TaskResult[QuizResult]:
        del kwargs
        questions = [
            {
                "question_type": question_type,
                "question_text": f"{question_type} 題目",
                "options": {"A": "正確", "B": "錯誤一", "C": "錯誤二", "D": "錯誤三"},
                "correct_option_key": "A",
                "explanation": "逐字稿支持答案 A。",
                "evidence_text": "可驗證的教學證據。",
            }
            for question_type in ("comprehension", "application", "concept")
        ]
        return TaskResult(
            QuizResult.model_validate({"questions": questions}),
            "quiz-fixture-v1",
            "fixture",
            "fixture-model",
        )


class FakeRepository:
    """Captures the integration output in memory instead of using Postgres."""

    def __init__(self) -> None:
        self.run_status: str | None = None
        self.events: list[dict[str, Any]] = []
        self.content_ids: set[UUID] = set()
        self.quiz_content_ids: set[UUID] = set()
        self.published_ids: set[UUID] = set()
        self.snapshot: list[tuple[UUID, float]] = []

    @staticmethod
    def id_for(value: str) -> UUID:
        return uuid5(NAMESPACE_URL, value)

    def create_run(self, *args: Any, **kwargs: Any) -> UUID:
        del args, kwargs
        return self.id_for("fixture-run")

    def finish_run(self, run_id: UUID, status: str, *args: Any, **kwargs: Any) -> None:
        del run_id, args, kwargs
        self.run_status = status

    def log_event(self, run_id: UUID, phase: str, level: str, message: str, **kwargs: Any) -> None:
        self.events.append(
            {"run_id": run_id, "phase": phase, "level": level, "message": message, **kwargs}
        )

    def record_search_candidate(self, *args: Any, **kwargs: Any) -> None:
        del args, kwargs

    def load_channel_policies(self, ids: list[str]) -> dict[str, dict[str, Any]]:
        assert ids == ["fixture-channel"]
        return {"fixture-channel": {"list_type": "recommended"}}

    def upsert_channel(self, channel: dict[str, Any]) -> UUID:
        return self.id_for(channel["source_channel_id"])

    def upsert_content(self, content: dict[str, Any], channel_id: UUID) -> UUID:
        assert channel_id == self.id_for("fixture-channel")
        content_id = self.id_for(content["source_content_id"])
        self.content_ids.add(content_id)
        return content_id

    def save_video_stats(self, *args: Any, **kwargs: Any) -> None:
        del args, kwargs

    def save_transcript(self, content_id: UUID, *args: Any, **kwargs: Any) -> UUID:
        del args, kwargs
        return self.id_for(f"transcript:{content_id}")

    def save_classification(self, *args: Any, **kwargs: Any) -> None:
        del args, kwargs

    def save_summary(self, content_id: UUID, *args: Any, **kwargs: Any) -> UUID:
        del args, kwargs
        return self.id_for(f"summary:{content_id}")

    def save_quiz(self, content_id: UUID, *args: Any, **kwargs: Any) -> UUID:
        del args, kwargs
        self.quiz_content_ids.add(content_id)
        return self.id_for(f"quiz:{content_id}")

    def publish_content(self, content_id: UUID) -> None:
        self.published_ids.add(content_id)

    def save_score(self, *args: Any, **kwargs: Any) -> UUID:
        del args, kwargs
        return self.id_for("score")

    def save_snapshot(
        self,
        topic_id: UUID,
        snapshot_date: Any,
        ranking_method: str,
        run_id: UUID,
        ranked_items: list[tuple[UUID, float]],
    ) -> UUID:
        del snapshot_date, ranking_method, run_id
        assert topic_id == TOPIC_ID
        self.snapshot = ranked_items
        return self.id_for("snapshot")

    def mark_filtered(self, *args: Any, **kwargs: Any) -> None:
        raise AssertionError(f"fixture content must not be filtered: {args!r} {kwargs!r}")


def topic() -> dict[str, Any]:
    return {
        "id": TOPIC_ID,
        "name": "人工智慧",
        "keywords": [
            {"keyword": "AI 入門", "keyword_type": "positive", "weight": 1, "is_active": True}
        ],
        "settings": {
            "freshness_days": 90,
            "candidate_limit": 20,
            "top_n": 20,
            "min_duration_seconds": 300,
            "max_duration_seconds": 7_200,
            "min_view_count": 0,
            "min_engagement_score": 0,
            "growth_guardrail_enabled": False,
            "min_views_per_day": 0,
            "auto_publish": True,
            "youtube_region_code": "TW",
            "relevance_language": "zh-Hant",
            "search_order": "relevance",
        },
    }


def test_fake_adapters_produce_complete_top_20_and_run_log() -> None:
    repository = FakeRepository()
    pipeline = DailyDigestPipeline(
        youtube=FakeYouTube(),  # type: ignore[arg-type]
        transcripts=FakeTranscripts(),  # type: ignore[arg-type]
        llm=FakeLLM(),  # type: ignore[arg-type]
        repository=repository,  # type: ignore[arg-type]
        now=NOW,
    )

    report = pipeline.run([topic()], trigger="integration-test")

    assert report.status == "succeeded"
    assert report.candidates == 20
    assert report.analyzed == 20
    assert report.published == 20
    assert report.snapshots == 1
    assert repository.run_status == "succeeded"
    assert len(repository.content_ids) == 20
    assert repository.quiz_content_ids == repository.content_ids
    assert repository.published_ids == repository.content_ids
    assert len(repository.snapshot) == 20
    assert {content_id for content_id, _score in repository.snapshot} == repository.content_ids
    assert {event["phase"] for event in repository.events} >= {
        "search",
        "metadata",
        "transcript",
        "analysis",
        "scoring",
        "snapshot",
    }
