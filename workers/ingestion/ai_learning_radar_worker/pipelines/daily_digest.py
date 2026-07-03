"""Daily YouTube digest orchestration with per-video failure isolation."""

from __future__ import annotations

import json
from collections.abc import Mapping, Sequence
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from typing import Any, Protocol
from uuid import NAMESPACE_URL, UUID, uuid4, uuid5

from ..llm.tasks import LLMTaskRunner
from ..scoring import (
    ChannelTrustSignals,
    RankingMethod,
    ScoringCandidate,
    ScoringConfig,
    calculate_snapshot_scores,
    rank_snapshot,
)
from ..sources import YouTubeAdapter, expand_queries
from ..sources.youtube import ChannelMetadata, SearchResult, VideoMetadata
from ..transcripts import TranscriptUnavailableError, YouTubeTranscriptAdapter


class PipelineRepository(Protocol):
    def create_run(
        self,
        trigger_type: str,
        settings_snapshot: Mapping[str, Any],
        requested_by_admin_id: UUID | None = None,
    ) -> UUID: ...

    def finish_run(
        self,
        run_id: UUID,
        status: str,
        summary: Mapping[str, Any],
        error_message: str | None = None,
    ) -> None: ...

    def log_event(
        self, run_id: UUID, phase: str, level: str, message: str, **kwargs: Any
    ) -> None: ...

    def record_search_candidate(
        self,
        run_id: UUID,
        topic_id: UUID,
        query: str,
        source_content_id: str,
        raw_result: Mapping[str, Any],
    ) -> None: ...

    def load_channel_policies(
        self, source_channel_ids: Sequence[str]
    ) -> Mapping[str, Mapping[str, Any]]: ...

    def upsert_channel(self, channel: Mapping[str, Any]) -> UUID: ...

    def upsert_content(self, content: Mapping[str, Any], channel_id: UUID | None) -> UUID: ...

    def save_video_stats(
        self,
        content_item_id: UUID,
        view_count: int,
        like_count: int,
        comment_count: int,
        fetched_at: datetime,
    ) -> None: ...

    def save_transcript(
        self, content_item_id: UUID, language: str, source: str, text: str, transcript_hash: str
    ) -> UUID: ...

    def save_classification(
        self, content_item_id: UUID, topic_id: UUID, classification: Mapping[str, Any]
    ) -> None: ...

    def save_summary(
        self, content_item_id: UUID, transcript_id: UUID | None, **kwargs: Any
    ) -> UUID: ...

    def save_quiz(self, content_item_id: UUID, **kwargs: Any) -> UUID: ...

    def save_score(
        self, content_item_id: UUID, topic_id: UUID, score: Mapping[str, Any]
    ) -> UUID: ...

    def save_snapshot(
        self,
        topic_id: UUID,
        snapshot_date: Any,
        ranking_method: str,
        run_id: UUID,
        ranked_items: Sequence[tuple[UUID, float]],
    ) -> UUID: ...

    def mark_filtered(self, content_item_id: UUID, reason: str) -> None: ...

    def publish_content(self, content_item_id: UUID) -> None: ...


@dataclass(slots=True)
class PipelineReport:
    run_id: UUID
    status: str = "succeeded"
    topics: int = 0
    queries: int = 0
    candidates: int = 0
    filtered: int = 0
    transcript_unavailable: int = 0
    analyzed: int = 0
    published: int = 0
    failed: int = 0
    snapshots: int = 0

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(slots=True)
class _Processed:
    content_id: UUID
    metadata: VideoMetadata
    classification: Mapping[str, Any]
    channel_signals: ChannelTrustSignals


class DailyDigestPipeline:
    def __init__(
        self,
        *,
        youtube: YouTubeAdapter,
        transcripts: YouTubeTranscriptAdapter | None,
        llm: LLMTaskRunner,
        repository: PipelineRepository,
        scoring_config: ScoringConfig | None = None,
        quiz_enabled: bool = True,
        now: datetime | None = None,
    ) -> None:
        self.youtube = youtube
        self.transcripts = transcripts
        self.llm = llm
        self.repository = repository
        self.scoring_config = scoring_config or ScoringConfig()
        self.quiz_enabled = quiz_enabled
        self.now = now or datetime.now(UTC)
        if self.now.tzinfo is None or self.now.utcoffset() is None:
            raise ValueError("pipeline now must be timezone-aware")

    def run(
        self,
        topics: Sequence[Mapping[str, Any]],
        *,
        dry_run: bool = False,
        trigger: str = "manual",
    ) -> PipelineReport:
        settings_snapshot = {str(topic["id"]): topic["settings"] for topic in topics}
        run_id = uuid4() if dry_run else self.repository.create_run(trigger, settings_snapshot)
        report = PipelineReport(run_id=run_id, topics=len(topics))
        try:
            for topic in topics:
                self._run_topic(topic, report, dry_run=dry_run)
            if report.failed:
                report.status = "partial_failed"
        except Exception as exc:
            report.status = "failed"
            if not dry_run:
                self.repository.log_event(
                    run_id, "pipeline", "error", str(exc), data={"error_type": type(exc).__name__}
                )
                self.repository.finish_run(run_id, report.status, report.as_dict(), str(exc))
            raise
        if not dry_run:
            self.repository.finish_run(run_id, report.status, report.as_dict())
        return report

    def _run_topic(
        self, topic: Mapping[str, Any], report: PipelineReport, *, dry_run: bool
    ) -> None:
        topic_id = UUID(str(topic["id"]))
        settings = topic["settings"]
        queries = expand_queries(topic["keywords"], max_queries=12)
        report.queries += len(queries)
        self._event(
            report,
            dry_run,
            "search",
            "info",
            "query expansion completed",
            topic_id,
            data={"query_count": len(queries)},
        )
        if not queries:
            self._event(
                report, dry_run, "search", "warning", "topic has no active queries", topic_id
            )
            return

        candidate_limit = int(settings["candidate_limit"])
        per_query = max(1, min(50, (candidate_limit + len(queries) - 1) // len(queries)))
        search_by_id: dict[str, SearchResult] = {}
        for query in queries:
            results = self.youtube.search(
                query,
                freshness_days=int(settings["freshness_days"]),
                max_results=per_query,
                order=str(settings["search_order"]),
                region_code=str(settings["youtube_region_code"]),
                relevance_language=str(settings["relevance_language"]),
                now=self.now,
            )
            for result in results:
                search_by_id.setdefault(result.video_id, result)
                if not dry_run:
                    self.repository.record_search_candidate(
                        report.run_id, topic_id, query, result.video_id, asdict(result)
                    )

        selected_ids = list(search_by_id)[: int(settings["candidate_limit"])]
        report.candidates += len(selected_ids)
        metadata = self.youtube.fetch_video_metadata(selected_ids)
        channel_by_id = {
            channel.channel_id: channel
            for channel in self.youtube.fetch_channel_metadata(
                item.channel_id for item in metadata if item.channel_id
            )
        }
        policies = self.repository.load_channel_policies(list(channel_by_id))
        self._event(
            report,
            dry_run,
            "metadata",
            "info",
            "video and channel metadata fetched",
            topic_id,
            data={"video_count": len(metadata), "channel_count": len(channel_by_id)},
        )
        processed: list[_Processed] = []
        for item in metadata:
            try:
                candidate = self._process_video(
                    item,
                    channel_by_id.get(item.channel_id),
                    policies.get(item.channel_id, {}),
                    topic,
                    report,
                    dry_run=dry_run,
                )
                if candidate is not None:
                    processed.append(candidate)
            except TranscriptUnavailableError as exc:
                report.filtered += 1
                report.transcript_unavailable += 1
                self._event(
                    report,
                    dry_run,
                    "transcript",
                    "warning",
                    str(exc),
                    topic_id,
                    data={"video_id": item.video_id, "retryable": False},
                )
            except Exception as exc:
                report.failed += 1
                self._event(
                    report,
                    dry_run,
                    "content",
                    "error",
                    str(exc),
                    topic_id,
                    data={"video_id": item.video_id, "error_type": type(exc).__name__},
                )

        scoring_candidates = [
            ScoringCandidate(
                content_id=str(item.content_id),
                published_at=item.metadata.published_at or self.now,
                view_count=item.metadata.view_count,
                like_count=item.metadata.like_count,
                comment_count=item.metadata.comment_count,
                topic_relevance_score=float(item.classification["topic_relevance_score"]),
                tutorial_quality_score=float(item.classification["tutorial_quality_score"]),
                channel_signals=item.channel_signals,
            )
            for item in processed
        ]
        scores = calculate_snapshot_scores(
            scoring_candidates, now=self.now, config=self._topic_scoring_config(settings)
        )
        score_by_id = {UUID(score.content_id): score for score in scores}
        if not dry_run:
            for content_id, score in score_by_id.items():
                self.repository.save_score(content_id, topic_id, asdict(score))
        self._event(
            report,
            dry_run,
            "scoring",
            "info",
            "candidate scores calculated",
            topic_id,
            data={"scored_count": len(scores)},
        )
        ranked = rank_snapshot(
            scores,
            top_n=int(settings["top_n"]),
            method=RankingMethod.FRESH_ENGAGEMENT,
        )
        if not dry_run:
            self.repository.save_snapshot(
                topic_id,
                self.now.date(),
                RankingMethod.FRESH_ENGAGEMENT.value,
                report.run_id,
                [(UUID(item.content_id), item.fresh_engagement_score) for item in ranked],
            )
        report.snapshots += 1
        self._event(
            report,
            dry_run,
            "snapshot",
            "info",
            "daily ranking snapshot completed",
            topic_id,
            data={"ranked_count": len(ranked)},
        )

    def _process_video(
        self,
        item: VideoMetadata,
        channel: ChannelMetadata | None,
        policy: Mapping[str, Any],
        topic: Mapping[str, Any],
        report: PipelineReport,
        *,
        dry_run: bool,
    ) -> _Processed | None:
        settings = topic["settings"]
        topic_id = UUID(str(topic["id"]))
        reason = self._filter_reason(
            item,
            settings,
            policy,
            require_caption=self.transcripts is not None,
        )
        fallback_id = uuid5(NAMESPACE_URL, f"youtube:{item.video_id}")
        channel_id: UUID | None = None
        if not dry_run and channel is not None:
            channel_id = self.repository.upsert_channel(self._channel_record(channel))
        content_id = fallback_id
        if not dry_run:
            content_id = self.repository.upsert_content(self._content_record(item), channel_id)
            self.repository.save_video_stats(
                content_id,
                item.view_count,
                item.like_count,
                item.comment_count,
                self.now,
            )
        if reason is not None:
            report.filtered += 1
            if not dry_run:
                self.repository.mark_filtered(content_id, reason)
            return None

        transcript = None
        transcript_id = None
        source_kind = "影片標題與說明"
        source_text = item.description.strip() or "影片沒有提供說明。"
        if self.transcripts is not None:
            try:
                transcript = self.transcripts.fetch(item.video_id)
            except TranscriptUnavailableError:
                if not dry_run:
                    self.repository.mark_filtered(content_id, "transcript_unavailable")
                raise
            self._event(
                report,
                dry_run,
                "transcript",
                "info",
                "transcript retrieved",
                topic_id,
                content_item_id=content_id,
                data={"language": transcript.language},
            )
            source_kind = "Transcript"
            source_text = transcript.text
            transcript_id = uuid5(NAMESPACE_URL, f"transcript:{transcript.transcript_hash}")
            if not dry_run:
                transcript_id = self.repository.save_transcript(
                    content_id,
                    transcript.language,
                    transcript.source,
                    transcript.text,
                    transcript.transcript_hash,
                )
        classification_result = self.llm.classify(
            title=item.title,
            description=item.description,
            channel_title=item.channel_title,
            duration_minutes=item.duration_seconds / 60,
            published_at=item.published_at.isoformat() if item.published_at else "unknown",
            topic_name=str(topic["name"]),
            topic_keywords=[str(keyword["keyword"]) for keyword in topic["keywords"]],
            rule_signals={},
            source_kind=source_kind,
            source_text=source_text[:6000],
        )
        classification = classification_result.value.model_dump()
        if not dry_run:
            self.repository.save_classification(content_id, topic_id, classification)
        if not classification["is_tutorial"]:
            report.filtered += 1
            if not dry_run:
                self.repository.mark_filtered(content_id, "not_tutorial")
            return None

        summary_result = self.llm.summarize(
            title=item.title,
            description=item.description,
            channel_title=item.channel_title,
            topic_name=str(topic["name"]),
            difficulty=str(classification["difficulty"]),
            source_kind=source_kind,
            source_text=source_text,
        )
        summary = summary_result.value.model_dump()
        quiz_result = None
        if self.quiz_enabled and transcript is not None:
            quiz_result = self.llm.quiz(
                title=item.title,
                short_summary=str(summary["short_summary"]),
                learning_objectives=list(summary["learning_objectives"]),
                transcript_text=transcript.text,
            )
        if not dry_run:
            self.repository.save_summary(
                content_id,
                transcript_id,
                prompt_version=summary_result.prompt_version,
                provider=summary_result.provider,
                model_id=summary_result.model,
                summary=summary,
            )
            if quiz_result is not None:
                self.repository.save_quiz(
                    content_id,
                    prompt_version=quiz_result.prompt_version,
                    provider=quiz_result.provider,
                    model_id=quiz_result.model,
                    questions=[question.model_dump() for question in quiz_result.value.questions],
                )
            if bool(settings["auto_publish"]):
                self.repository.publish_content(content_id)
        report.analyzed += 1
        if bool(settings["auto_publish"]):
            report.published += 1
        self._event(
            report,
            dry_run,
            "analysis",
            "info",
            "classification and summary completed"
            + (" with quiz" if quiz_result is not None else ""),
            topic_id,
            content_item_id=content_id,
        )
        return _Processed(
            content_id,
            item,
            classification,
            ChannelTrustSignals(
                is_recommended=policy.get("list_type") == "recommended",
                is_blacklisted=policy.get("list_type") == "blacklisted",
                subscriber_count=channel.subscriber_count if channel else None,
            ),
        )

    def _filter_reason(
        self,
        item: VideoMetadata,
        settings: Mapping[str, Any],
        policy: Mapping[str, Any],
        *,
        require_caption: bool,
    ) -> str | None:
        if policy.get("list_type") == "blacklisted":
            return "blacklisted_channel"
        if not int(settings["min_duration_seconds"]) <= item.duration_seconds <= int(
            settings["max_duration_seconds"]
        ):
            return "duration_out_of_range"
        if item.view_count < int(settings["min_view_count"]):
            return "below_min_view_count"
        if require_caption and not item.caption_available:
            return "caption_unavailable"
        return None

    def _topic_scoring_config(self, settings: Mapping[str, Any]) -> ScoringConfig:
        return ScoringConfig(
            growth_guardrail_enabled=bool(settings["growth_guardrail_enabled"]),
            min_views_per_day=float(settings["min_views_per_day"]),
            min_engagement_score=float(settings["min_engagement_score"]),
        )

    def _event(
        self,
        report: PipelineReport,
        dry_run: bool,
        phase: str,
        level: str,
        message: str,
        topic_id: UUID,
        *,
        content_item_id: UUID | None = None,
        data: Mapping[str, Any] | None = None,
    ) -> None:
        if dry_run:
            print(
                json.dumps(
                    {
                        "phase": phase,
                        "level": level,
                        "message": message,
                        "topic_id": str(topic_id),
                        "content_item_id": str(content_item_id) if content_item_id else None,
                        "data": data,
                    },
                    ensure_ascii=False,
                    default=str,
                )
            )
            return
        self.repository.log_event(
            report.run_id,
            phase,
            level,
            message,
            topic_id=topic_id,
            content_item_id=content_item_id,
            data=data,
        )

    @staticmethod
    def _channel_record(channel: ChannelMetadata) -> dict[str, Any]:
        record = asdict(channel)
        record["source_channel_id"] = record.pop("channel_id")
        return record

    @staticmethod
    def _content_record(item: VideoMetadata) -> dict[str, Any]:
        return {
            "source_content_id": item.video_id,
            "source_url": f"https://www.youtube.com/watch?v={item.video_id}",
            "canonical_url": f"https://www.youtube.com/watch?v={item.video_id}",
            "title": item.title,
            "description": item.description,
            "thumbnail_url": item.thumbnail_url,
            "channel_title": item.channel_title,
            "language": item.default_language,
            "published_at": item.published_at,
            "duration_seconds": item.duration_seconds,
            "raw": item.raw,
        }
