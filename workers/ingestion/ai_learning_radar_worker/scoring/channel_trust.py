"""Channel trust scoring from optional, independently configurable signals."""

from __future__ import annotations

import math
from dataclasses import dataclass


def _unit(value: float) -> float:
    if not math.isfinite(value):
        raise ValueError("channel trust signals must be finite")
    return min(1.0, max(0.0, value))


@dataclass(frozen=True)
class ChannelTrustWeights:
    recommended: float = 0.40
    subscribers: float = 0.15
    retention_rate: float = 0.25
    average_engagement: float = 0.20

    def __post_init__(self) -> None:
        values = (
            self.recommended,
            self.subscribers,
            self.retention_rate,
            self.average_engagement,
        )
        if any(not math.isfinite(value) or value < 0 for value in values):
            raise ValueError("channel trust weights must be finite and non-negative")
        if sum(values) <= 0:
            raise ValueError("at least one channel trust weight must be positive")


@dataclass(frozen=True)
class ChannelTrustSignals:
    is_recommended: bool = False
    is_blacklisted: bool = False
    subscriber_count: int | None = None
    historical_retention_rate: float | None = None
    historical_average_engagement: float | None = None

    def __post_init__(self) -> None:
        if self.subscriber_count is not None and self.subscriber_count < 0:
            raise ValueError("subscriber_count cannot be negative")


def channel_trust_score(
    signals: ChannelTrustSignals,
    weights: ChannelTrustWeights | None = None,
    *,
    subscriber_cap: int = 1_000_000,
    engagement_reference: float = 0.10,
) -> float:
    """Return a 0..1 trust score, reweighting around unavailable API/history data.

    Blacklisting is authoritative and returns zero. Subscriber influence is logarithmic,
    so very large channels cannot dominate the score.
    """

    weights = weights or ChannelTrustWeights()
    if subscriber_cap <= 0 or engagement_reference <= 0:
        raise ValueError("normalization references must be positive")
    if signals.is_blacklisted:
        return 0.0

    components: list[tuple[float, float]] = [
        (1.0 if signals.is_recommended else 0.0, weights.recommended)
    ]
    if signals.subscriber_count is not None:
        subscriber_signal = math.log1p(min(signals.subscriber_count, subscriber_cap)) / math.log1p(
            subscriber_cap
        )
        components.append((subscriber_signal, weights.subscribers))
    if signals.historical_retention_rate is not None:
        components.append((_unit(signals.historical_retention_rate), weights.retention_rate))
    if signals.historical_average_engagement is not None:
        engagement = _unit(signals.historical_average_engagement / engagement_reference)
        components.append((engagement, weights.average_engagement))

    available_weight = sum(weight for _, weight in components)
    if available_weight == 0:
        return 0.0
    return sum(value * weight for value, weight in components) / available_weight
