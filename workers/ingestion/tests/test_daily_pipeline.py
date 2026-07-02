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
from ai_learning_radar_worker.sources.youtube import ChannelMetadata, SearchResult, VideoMetadata
from ai_learning_radar_worker.transcripts.youtube_transcript import (
    TranscriptResult,
    TranscriptUnavailableError,
)

NOW = datetime(2026, 7, 2, 8, tzinfo=UTC)
TOPIC_ID = UUID("00000000-0000-4000-8000-000000000001")


def topic() -> dict[str, Any]:
    return {
        "id": TOPIC_ID,
        "name": "人工智慧",
        "keywords": [
            {"keyword": "AI 入門", "keyword_type": "positive", "weight": 1, "is_active": True}
        ],
        "settings": {
            "freshness_days": 90,
            "candidate_limit": 10,
            "top_n": 5,
            "min_duration_seconds": 300,
            "max_duration_seconds": 7200,
            "min_view_count": 0,
            "min_engagement_score": 0.05,
            "growth_guardrail_enabled": False,
            "min_views_per_day": 250,
            "auto_publish": True,
            "youtube_region_code": "TW",
            "relevance_language": "zh-Hant",
            "search_order": "relevance",
        },
    }


class FakeYouTube:
    def search(self, query: str, **kwargs: Any) -> list[SearchResult]:
        del query, kwargs
        return [
            SearchResult(video_id, video_id, "", "channel-1", "頻道", NOW, None)
            for video_id in ("ok", "unavailable", "broken")
        ]

    def fetch_video_metadata(self, video_ids: list[str]) -> list[VideoMetadata]:
        return [
            VideoMetadata(
                video_id=video_id,
                title=f"{video_id} AI 入門",
                description="教學",
                channel_id="channel-1",
                channel_title="頻道",
                published_at=NOW,
                thumbnail_url=None,
                duration_seconds=600,
                view_count=100,
                like_count=10,
                comment_count=3,
                default_language="zh-Hant",
                caption_available=True,
                raw={},
            )
            for video_id in video_ids
        ]

    def fetch_channel_metadata(self, channel_ids: Any) -> list[ChannelMetadata]:
        assert list(channel_ids)
        return [
            ChannelMetadata("channel-1", "頻道", "", None, None, 1000, 10, 10_000, {})
        ]


class FakeTranscripts:
    def fetch(self, video_id: str) -> TranscriptResult:
        if video_id == "unavailable":
            raise TranscriptUnavailableError(video_id)
        if video_id == "broken":
            raise RuntimeError("temporary transcript failure")
        return TranscriptResult(
            video_id, "這是一段 AI 教學逐字稿。", "zh-Hant", "hash", "mock", NOW
        )


class FakeLLM:
    def classify(self, **kwargs: Any) -> TaskResult[ClassificationResult]:
        del kwargs
        value = ClassificationResult(
            is_tutorial=True,
            tutorial_confidence=0.9,
            content_type="tutorial",
            difficulty="beginner",
            difficulty_confidence=0.8,
            topic_relevance_score=0.9,
            tutorial_quality_score=0.8,
            reason="有步驟",
            difficulty_reason="無先備知識",
            signals=["教學"],
        )
        return TaskResult(value, "classifier-v1", "mock", "mock-model")

    def summarize(self, **kwargs: Any) -> TaskResult[SummaryResult]:
        del kwargs
        value = SummaryResult(
            suitable_for="適合初學者",
            short_summary="短" * 100,
            full_summary="長" * 500,
            transcript_summary="逐" * 300,
            learning_objectives=["目標一", "目標二", "目標三"],
            key_concepts=["AI", "LLM", "RAG"],
            limitations_or_cautions="",
        )
        return TaskResult(value, "summary-v1", "mock", "mock-model")

    def quiz(self, **kwargs: Any) -> TaskResult[QuizResult]:
        del kwargs
        value = QuizResult.model_validate(
            {
                "questions": [
                    {
                        "question_type": kind,
                        "question_text": "題目",
                        "options": {"A": "甲", "B": "乙", "C": "丙", "D": "丁"},
                        "correct_option_key": "A",
                        "explanation": "解析",
                        "evidence_text": "證據",
                    }
                    for kind in ("comprehension", "application", "concept")
                ]
            }
        )
        return TaskResult(value, "quiz-v1", "mock", "mock-model")


class FakeRepository:
    def __init__(self) -> None:
        self.calls: list[str] = []
        self.finished_status: str | None = None

    def _id(self, value: str) -> UUID:
        return uuid5(NAMESPACE_URL, value)

    def create_run(self, *args: Any, **kwargs: Any) -> UUID:
        self.calls.append("create_run")
        return self._id("run")

    def finish_run(self, run_id: UUID, status: str, *args: Any, **kwargs: Any) -> None:
        self.calls.append("finish_run")
        self.finished_status = status

    def log_event(self, *args: Any, **kwargs: Any) -> None:
        self.calls.append("log_event")

    def record_search_candidate(self, *args: Any, **kwargs: Any) -> None:
        self.calls.append("record_search_candidate")

    def load_channel_policies(self, ids: list[str]) -> dict[str, Any]:
        return {}

    def upsert_channel(self, channel: dict[str, Any]) -> UUID:
        self.calls.append("upsert_channel")
        return self._id(channel["source_channel_id"])

    def upsert_content(self, content: dict[str, Any], channel_id: UUID) -> UUID:
        self.calls.append("upsert_content")
        return self._id(content["source_content_id"])

    def __getattr__(self, name: str) -> Any:
        if name.startswith(("save_", "mark_", "publish_")):
            def method(*args: Any, **kwargs: Any) -> UUID:
                self.calls.append(name)
                return self._id(f"{name}:{len(self.calls)}")

            return method
        raise AttributeError(name)


def build_pipeline(repository: FakeRepository) -> DailyDigestPipeline:
    return DailyDigestPipeline(
        youtube=FakeYouTube(),  # type: ignore[arg-type]
        transcripts=FakeTranscripts(),  # type: ignore[arg-type]
        llm=FakeLLM(),  # type: ignore[arg-type]
        repository=repository,  # type: ignore[arg-type]
        now=NOW,
    )


def test_pipeline_isolates_video_failures_and_saves_snapshot() -> None:
    repository = FakeRepository()
    report = build_pipeline(repository).run([topic()], trigger="test")

    assert report.status == "partial_failed"
    assert report.candidates == 3
    assert report.transcript_unavailable == 1
    assert report.failed == 1
    assert report.analyzed == 1
    assert report.snapshots == 1
    assert repository.finished_status == "partial_failed"
    assert "save_summary" in repository.calls
    assert "save_quiz" in repository.calls
    assert "save_snapshot" in repository.calls


def test_dry_run_performs_no_repository_writes() -> None:
    repository = FakeRepository()
    report = build_pipeline(repository).run([topic()], dry_run=True, trigger="test")

    assert report.status == "partial_failed"
    assert repository.calls == []
