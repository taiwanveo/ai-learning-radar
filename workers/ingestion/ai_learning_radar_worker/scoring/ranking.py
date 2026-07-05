"""Ranking calculations for daily digest snapshots."""

from __future__ import annotations

import math
from collections.abc import Iterable
from dataclasses import dataclass, replace
from datetime import UTC, datetime
from enum import StrEnum

from .channel_trust import (
    ChannelTrustSignals,
    ChannelTrustWeights,
    channel_trust_score,
)


def _non_negative(name: str, value: float) -> None:
    if not math.isfinite(value) or value < 0:
        raise ValueError(f"{name} must be finite and non-negative")


def _unit(name: str, value: float) -> float:
    if not math.isfinite(value) or not 0 <= value <= 1:
        raise ValueError(f"{name} must be finite and between 0 and 1")
    return value


class RankingMethod(StrEnum):
    FRESH_ENGAGEMENT = "fresh_engagement_score"
    RADAR = "radar_score"
    VIEW_COUNT = "view_count"
    LATEST = "published_at"


@dataclass(frozen=True)
class RadarWeights:
    fresh_engagement: float = 0.35
    view_velocity: float = 0.25
    comment_signal: float = 0.10
    topic_relevance: float = 0.15
    tutorial_quality: float = 0.10
    channel_trust: float = 0.05

    def __post_init__(self) -> None:
        values = vars(self).values()
        if any(not math.isfinite(value) or value < 0 for value in values):
            raise ValueError("radar weights must be finite and non-negative")
        if sum(vars(self).values()) <= 0:
            raise ValueError("at least one radar weight must be positive")


@dataclass(frozen=True)
class ScoringConfig:
    weights: RadarWeights = RadarWeights()
    channel_trust_weights: ChannelTrustWeights = ChannelTrustWeights()
    comment_rate_cap: float = 0.03
    recommended_boost: float = 0.05
    blacklist_penalty: float = 1.0
    exclude_blacklisted: bool = True
    growth_guardrail_enabled: bool = False
    min_views_per_day: float = 250.0
    min_engagement_score: float = 0.05
    growth_guardrail_penalty: float = 0.10

    def __post_init__(self) -> None:
        for name in (
            "comment_rate_cap",
            "recommended_boost",
            "blacklist_penalty",
            "min_views_per_day",
            "min_engagement_score",
            "growth_guardrail_penalty",
        ):
            _non_negative(name, getattr(self, name))
        if self.comment_rate_cap == 0:
            raise ValueError("comment_rate_cap must be positive")


@dataclass(frozen=True)
class ScoringCandidate:
    content_id: str
    published_at: datetime
    view_count: int = 0
    like_count: int = 0
    comment_count: int = 0
    topic_relevance_score: float = 0.0
    tutorial_quality_score: float = 0.0
    channel_signals: ChannelTrustSignals = ChannelTrustSignals()

    def __post_init__(self) -> None:
        if not self.content_id:
            raise ValueError("content_id is required")
        if self.published_at.tzinfo is None or self.published_at.utcoffset() is None:
            raise ValueError("published_at must be timezone-aware")
        for name in ("view_count", "like_count", "comment_count"):
            if getattr(self, name) < 0:
                raise ValueError(f"{name} cannot be negative")
        _unit("topic_relevance_score", self.topic_relevance_score)
        _unit("tutorial_quality_score", self.tutorial_quality_score)


@dataclass(frozen=True)
class ScoreResult:
    content_id: str
    published_at: datetime
    view_count: int
    age_days: int
    engagement_score: float
    fresh_engagement_score: float
    view_velocity: float
    comment_signal: float
    channel_trust_score: float
    topic_relevance_score: float
    tutorial_quality_score: float
    normalized_fresh_engagement_score: float = 0.0
    normalized_view_velocity: float = 0.0
    radar_score: float = 0.0
    recommended_boost_applied: float = 0.0
    blacklist_penalty_applied: float = 0.0
    growth_guardrail_penalty_applied: float = 0.0
    excluded: bool = False
    exclusion_reason: str | None = None


def age_days(published_at: datetime, now: datetime | None = None) -> int:
    if published_at.tzinfo is None or published_at.utcoffset() is None:
        raise ValueError("published_at must be timezone-aware")
    current = now or datetime.now(UTC)
    if current.tzinfo is None or current.utcoffset() is None:
        raise ValueError("now must be timezone-aware")
    elapsed_seconds = (current - published_at).total_seconds()
    # Future timestamps and content less than one day old are deliberately age 1.
    return max(1, math.ceil(elapsed_seconds / 86_400))


def engagement_score(like_count: int, view_count: int) -> float:
    if like_count < 0 or view_count < 0:
        raise ValueError("counts cannot be negative")
    return like_count / max(view_count, 1)


def fresh_engagement_score(engagement: float, age: int) -> float:
    _non_negative("engagement", engagement)
    if age < 1:
        raise ValueError("age must be at least one day")
    return engagement / age


def view_velocity(view_count: int, age: int) -> float:
    if view_count < 0 or age < 1:
        raise ValueError("view_count must be non-negative and age at least one")
    return view_count / age


def comment_signal(comment_count: int, view_count: int, cap: float = 0.03) -> float:
    if comment_count < 0 or view_count < 0:
        raise ValueError("counts cannot be negative")
    if not math.isfinite(cap) or cap <= 0:
        raise ValueError("cap must be finite and positive")
    return min(comment_count / max(view_count, 1), cap) / cap


def normalize_scores(values: Iterable[float]) -> list[float]:
    """Min-max normalize finite non-negative values.

    A positive constant population maps to 1 (all candidates equally strong); an
    all-zero population maps to 0. Empty input stays empty.
    """

    materialized = list(values)
    for value in materialized:
        _non_negative("normalization value", value)
    if not materialized:
        return []
    low, high = min(materialized), max(materialized)
    if high == low:
        fill = 1.0 if high > 0 else 0.0
        return [fill] * len(materialized)
    return [(value - low) / (high - low) for value in materialized]


def _raw_score(candidate: ScoringCandidate, now: datetime, config: ScoringConfig) -> ScoreResult:
    age = age_days(candidate.published_at, now)
    engagement = engagement_score(candidate.like_count, candidate.view_count)
    trust = channel_trust_score(
        candidate.channel_signals,
        config.channel_trust_weights,
    )
    return ScoreResult(
        content_id=candidate.content_id,
        published_at=candidate.published_at,
        view_count=candidate.view_count,
        age_days=age,
        engagement_score=engagement,
        fresh_engagement_score=fresh_engagement_score(engagement, age),
        view_velocity=view_velocity(candidate.view_count, age),
        comment_signal=comment_signal(
            candidate.comment_count, candidate.view_count, config.comment_rate_cap
        ),
        channel_trust_score=trust,
        topic_relevance_score=candidate.topic_relevance_score,
        tutorial_quality_score=candidate.tutorial_quality_score,
        excluded=config.exclude_blacklisted and candidate.channel_signals.is_blacklisted,
        exclusion_reason=(
            "blacklisted_channel"
            if config.exclude_blacklisted and candidate.channel_signals.is_blacklisted
            else None
        ),
    )


def calculate_snapshot_scores(
    candidates: Iterable[ScoringCandidate],
    *,
    now: datetime | None = None,
    config: ScoringConfig | None = None,
) -> list[ScoreResult]:
    """Calculate raw, normalized and composite scores for one snapshot population."""

    config = config or ScoringConfig()
    current = now or datetime.now(UTC)
    if current.tzinfo is None or current.utcoffset() is None:
        raise ValueError("now must be timezone-aware")
    materialized = list(candidates)
    ids = [candidate.content_id for candidate in materialized]
    if len(ids) != len(set(ids)):
        raise ValueError("content_id must be unique within a snapshot")

    raw = [_raw_score(candidate, current, config) for candidate in materialized]
    normalized_fresh = normalize_scores(item.fresh_engagement_score for item in raw)
    normalized_velocity = normalize_scores(item.view_velocity for item in raw)
    results: list[ScoreResult] = []

    for candidate, item, norm_fresh, norm_velocity in zip(
        materialized, raw, normalized_fresh, normalized_velocity, strict=True
    ):
        weights = config.weights
        base = (
            weights.fresh_engagement * norm_fresh
            + weights.view_velocity * norm_velocity
            + weights.comment_signal * item.comment_signal
            + weights.topic_relevance * item.topic_relevance_score
            + weights.tutorial_quality * item.tutorial_quality_score
            + weights.channel_trust * item.channel_trust_score
        )
        signals = candidate.channel_signals
        # The admin-configured trust weight scales the flat recommendation boost.
        trust_scale = (
            min(1.0, max(0.0, signals.trust_weight)) if signals.trust_weight is not None else 1.0
        )
        boost = config.recommended_boost * trust_scale if signals.is_recommended else 0.0
        blacklist = config.blacklist_penalty if signals.is_blacklisted else 0.0
        below_guardrail = (
            item.view_velocity < config.min_views_per_day
            or item.engagement_score < config.min_engagement_score
        )
        growth_penalty = (
            config.growth_guardrail_penalty
            if config.growth_guardrail_enabled and below_guardrail
            else 0.0
        )
        results.append(
            replace(
                item,
                normalized_fresh_engagement_score=norm_fresh,
                normalized_view_velocity=norm_velocity,
                radar_score=max(0.0, base + boost - blacklist - growth_penalty),
                recommended_boost_applied=boost,
                blacklist_penalty_applied=blacklist,
                growth_guardrail_penalty_applied=growth_penalty,
            )
        )
    return results


def rank_snapshot(
    scores: Iterable[ScoreResult],
    *,
    top_n: int | None = None,
    method: RankingMethod = RankingMethod.FRESH_ENGAGEMENT,
    include_excluded: bool = False,
) -> list[ScoreResult]:
    """Return a deterministic snapshot ranking without mutating score records."""

    if top_n is not None and top_n < 0:
        raise ValueError("top_n cannot be negative")
    candidates = [item for item in scores if include_excluded or not item.excluded]
    key_by_method = {
        RankingMethod.FRESH_ENGAGEMENT: lambda item: item.fresh_engagement_score,
        RankingMethod.RADAR: lambda item: item.radar_score,
        RankingMethod.VIEW_COUNT: lambda item: item.view_count,
        RankingMethod.LATEST: lambda item: item.published_at.timestamp(),
    }
    try:
        score_key = key_by_method[method]
    except KeyError as error:
        raise ValueError(f"unsupported ranking method: {method}") from error
    ranked = sorted(candidates, key=lambda item: (-score_key(item), item.content_id))
    return ranked if top_n is None else ranked[:top_n]
