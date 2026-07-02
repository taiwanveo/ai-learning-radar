from datetime import UTC, datetime, timedelta

import pytest

from ai_learning_radar_worker.scoring import (
    ChannelTrustSignals,
    RadarWeights,
    RankingMethod,
    ScoringCandidate,
    ScoringConfig,
    age_days,
    calculate_snapshot_scores,
    channel_trust_score,
    comment_signal,
    engagement_score,
    normalize_scores,
    rank_snapshot,
)

NOW = datetime(2026, 7, 2, 12, tzinfo=UTC)


def candidate(content_id: str, **overrides: object) -> ScoringCandidate:
    values: dict[str, object] = {
        "content_id": content_id,
        "published_at": NOW - timedelta(days=2),
        "view_count": 1_000,
        "like_count": 100,
        "comment_count": 30,
        "topic_relevance_score": 0.8,
        "tutorial_quality_score": 0.7,
    }
    values.update(overrides)
    return ScoringCandidate(**values)  # type: ignore[arg-type]


def test_age_days_ceil_minimum_and_future_timestamp() -> None:
    assert age_days(NOW - timedelta(hours=25), NOW) == 2
    assert age_days(NOW - timedelta(minutes=2), NOW) == 1
    assert age_days(NOW + timedelta(days=10), NOW) == 1


def test_zero_views_never_divides_by_zero() -> None:
    assert engagement_score(4, 0) == 4
    result = calculate_snapshot_scores(
        [candidate("zero", view_count=0, like_count=4, comment_count=2)], now=NOW
    )[0]
    assert result.engagement_score == 4
    assert result.view_velocity == 0
    assert result.comment_signal == 1


def test_comment_signal_is_capped() -> None:
    assert comment_signal(1, 1_000) == pytest.approx(1 / 30)
    assert comment_signal(300, 1_000) == 1


def test_channel_trust_uses_available_signals_and_blacklist_wins() -> None:
    recommended = channel_trust_score(ChannelTrustSignals(is_recommended=True))
    unknown = channel_trust_score(ChannelTrustSignals())
    blacklisted = channel_trust_score(
        ChannelTrustSignals(is_recommended=True, is_blacklisted=True, subscriber_count=1_000_000)
    )
    assert recommended == 1
    assert unknown == 0
    assert blacklisted == 0


def test_normalization_handles_empty_constant_and_range() -> None:
    assert normalize_scores([]) == []
    assert normalize_scores([0, 0]) == [0, 0]
    assert normalize_scores([2, 2]) == [1, 1]
    assert normalize_scores([2, 4, 6]) == [0, 0.5, 1]


def test_radar_score_uses_injected_weights_and_recommended_boost() -> None:
    config = ScoringConfig(
        weights=RadarWeights(
            fresh_engagement=1,
            view_velocity=0,
            comment_signal=0,
            topic_relevance=0,
            tutorial_quality=0,
            channel_trust=0,
        ),
        recommended_boost=0.2,
    )
    regular, recommended = calculate_snapshot_scores(
        [
            candidate("regular", like_count=10),
            candidate(
                "recommended",
                like_count=100,
                channel_signals=ChannelTrustSignals(is_recommended=True),
            ),
        ],
        now=NOW,
        config=config,
    )
    assert regular.radar_score == 0
    assert recommended.radar_score == pytest.approx(1.2)
    assert recommended.recommended_boost_applied == 0.2


def test_blacklist_penalty_and_exclusion_are_both_recorded() -> None:
    result = calculate_snapshot_scores(
        [candidate("blocked", channel_signals=ChannelTrustSignals(is_blacklisted=True))],
        now=NOW,
        config=ScoringConfig(blacklist_penalty=0.4),
    )[0]
    assert result.excluded is True
    assert result.exclusion_reason == "blacklisted_channel"
    assert result.blacklist_penalty_applied == 0.4
    assert rank_snapshot([result]) == []
    assert rank_snapshot([result], include_excluded=True) == [result]


def test_growth_guardrail_penalizes_without_excluding() -> None:
    config = ScoringConfig(
        growth_guardrail_enabled=True,
        min_views_per_day=1_000,
        min_engagement_score=0.2,
        growth_guardrail_penalty=0.3,
    )
    result = calculate_snapshot_scores([candidate("slow")], now=NOW, config=config)[0]
    assert result.excluded is False
    assert result.growth_guardrail_penalty_applied == 0.3


def test_snapshot_ranking_defaults_to_fresh_engagement_and_is_stable() -> None:
    scores = calculate_snapshot_scores(
        [
            candidate("older", published_at=NOW - timedelta(days=10), like_count=100),
            candidate("newer-z", published_at=NOW - timedelta(days=1), like_count=100),
            candidate("newer-a", published_at=NOW - timedelta(days=1), like_count=100),
            candidate(
                "blocked",
                like_count=999,
                channel_signals=ChannelTrustSignals(is_blacklisted=True),
            ),
        ],
        now=NOW,
    )
    ranked = rank_snapshot(scores, top_n=2)
    assert [item.content_id for item in ranked] == ["newer-a", "newer-z"]


def test_snapshot_can_rank_by_composite_score() -> None:
    scores = calculate_snapshot_scores(
        [candidate("a", like_count=20), candidate("b", like_count=100)], now=NOW
    )
    assert rank_snapshot(scores, method=RankingMethod.RADAR)[0].content_id == "b"


def test_invalid_and_duplicate_inputs_fail_early() -> None:
    with pytest.raises(ValueError, match="timezone-aware"):
        candidate("naive", published_at=datetime(2026, 1, 1))
    with pytest.raises(ValueError, match="unique"):
        calculate_snapshot_scores([candidate("same"), candidate("same")], now=NOW)
    with pytest.raises(ValueError, match="comment_rate_cap"):
        ScoringConfig(comment_rate_cap=0)
