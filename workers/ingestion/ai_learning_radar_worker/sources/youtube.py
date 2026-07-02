"""Typed, instrumented adapter for the YouTube Data API v3."""

from __future__ import annotations

import re
import time
from collections.abc import Callable, Iterable, Mapping, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any, Protocol

API_URL = "https://www.googleapis.com/youtube/v3"
_BATCH_SIZE = 50
_DURATION_RE = re.compile(
    r"^P(?:(?P<days>\d+)D)?(?:T(?:(?P<hours>\d+)H)?(?:(?P<minutes>\d+)M)?"
    r"(?:(?P<seconds>\d+)S)?)?$"
)


class HttpResponse(Protocol):
    status_code: int

    def json(self) -> Any: ...


class HttpClient(Protocol):
    def get(self, url: str, *, params: Mapping[str, Any], timeout: float) -> HttpResponse: ...


@dataclass(frozen=True, slots=True)
class QuotaEvent:
    endpoint: str
    units: int
    attempt: int
    succeeded: bool


@dataclass(frozen=True, slots=True)
class SearchResult:
    video_id: str
    title: str
    description: str
    channel_id: str
    channel_title: str
    published_at: datetime | None
    thumbnail_url: str | None


@dataclass(frozen=True, slots=True)
class VideoMetadata:
    video_id: str
    title: str
    description: str
    channel_id: str
    channel_title: str
    published_at: datetime | None
    thumbnail_url: str | None
    duration_seconds: int
    view_count: int
    like_count: int
    comment_count: int
    default_language: str | None
    caption_available: bool
    raw: Mapping[str, Any]


@dataclass(frozen=True, slots=True)
class ChannelMetadata:
    channel_id: str
    title: str
    description: str
    handle: str | None
    thumbnail_url: str | None
    subscriber_count: int | None
    video_count: int
    view_count: int
    raw: Mapping[str, Any]


class YouTubeApiError(RuntimeError):
    """Base error with retry metadata suitable for a run event."""

    def __init__(
        self,
        message: str,
        *,
        status_code: int | None = None,
        reason: str | None = None,
        retryable: bool = False,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.reason = reason
        self.retryable = retryable


class YouTubeTransientError(YouTubeApiError):
    """A network or server error that can be retried."""


class YouTubeAuthenticationError(YouTubeApiError):
    """The configured API key is missing or invalid."""


class YouTubeQuotaExceededError(YouTubeApiError):
    """The project quota is exhausted; retrying immediately will not help."""


class YouTubeResponseError(YouTubeApiError):
    """A non-retryable API response."""


QuotaRecorder = Callable[[QuotaEvent], None]


class YouTubeAdapter:
    """Small Data API client whose transports, retry waits and metrics are injectable."""

    def __init__(
        self,
        api_key: str,
        *,
        client: HttpClient | None = None,
        quota_recorder: QuotaRecorder | None = None,
        timeout: float = 20.0,
        max_attempts: int = 3,
        backoff_seconds: float = 0.5,
        sleeper: Callable[[float], None] = time.sleep,
    ) -> None:
        if not api_key.strip():
            raise ValueError("YouTube API key must not be empty")
        if max_attempts < 1:
            raise ValueError("max_attempts must be at least 1")
        if client is None:
            try:
                import httpx
            except ImportError as exc:  # pragma: no cover - exercised by deployment setup
                raise RuntimeError(
                    "The default YouTube transport requires the 'httpx' package"
                ) from exc
            client = httpx.Client()
        self._api_key = api_key
        self._client = client
        self._quota_recorder = quota_recorder
        self._timeout = timeout
        self._max_attempts = max_attempts
        self._backoff_seconds = backoff_seconds
        self._sleep = sleeper

    def search(
        self,
        query: str,
        *,
        freshness_days: int = 90,
        max_results: int = 50,
        order: str = "relevance",
        region_code: str = "TW",
        relevance_language: str = "zh-Hant",
        now: datetime | None = None,
    ) -> list[SearchResult]:
        if not query.strip():
            raise ValueError("query must not be empty")
        if not 1 <= max_results <= 50:
            raise ValueError("max_results must be between 1 and 50")
        if freshness_days < 1:
            raise ValueError("freshness_days must be at least 1")
        current = now or datetime.now(UTC)
        if current.tzinfo is None:
            current = current.replace(tzinfo=UTC)
        published_after = (
            (current.astimezone(UTC) - timedelta(days=freshness_days))
            .isoformat(timespec="seconds")
            .replace("+00:00", "Z")
        )
        payload = self._request(
            "search",
            quota_units=100,
            params={
                "part": "snippet",
                "q": query.strip(),
                "type": "video",
                "order": order,
                "publishedAfter": published_after,
                "maxResults": max_results,
                "regionCode": region_code,
                "relevanceLanguage": relevance_language,
                "videoCaption": "closedCaption",
                "safeSearch": "moderate",
            },
        )
        results: list[SearchResult] = []
        for item in payload.get("items", []):
            video_id = item.get("id", {}).get("videoId")
            if not video_id:
                continue
            snippet = item.get("snippet", {})
            results.append(
                SearchResult(
                    video_id=video_id,
                    title=str(snippet.get("title", "")),
                    description=str(snippet.get("description", "")),
                    channel_id=str(snippet.get("channelId", "")),
                    channel_title=str(snippet.get("channelTitle", "")),
                    published_at=_parse_datetime(snippet.get("publishedAt")),
                    thumbnail_url=_best_thumbnail(snippet.get("thumbnails", {})),
                )
            )
        return results

    def fetch_video_metadata(self, video_ids: Iterable[str]) -> list[VideoMetadata]:
        ids = _unique_nonempty(video_ids)
        output: list[VideoMetadata] = []
        for batch in _batches(ids, _BATCH_SIZE):
            payload = self._request(
                "videos",
                quota_units=1,
                params={
                    "part": "snippet,statistics,contentDetails",
                    "id": ",".join(batch),
                },
            )
            for item in payload.get("items", []):
                snippet = item.get("snippet", {})
                statistics = item.get("statistics", {})
                details = item.get("contentDetails", {})
                output.append(
                    VideoMetadata(
                        video_id=str(item.get("id", "")),
                        title=str(snippet.get("title", "")),
                        description=str(snippet.get("description", "")),
                        channel_id=str(snippet.get("channelId", "")),
                        channel_title=str(snippet.get("channelTitle", "")),
                        published_at=_parse_datetime(snippet.get("publishedAt")),
                        thumbnail_url=_best_thumbnail(snippet.get("thumbnails", {})),
                        duration_seconds=parse_iso8601_duration(str(details.get("duration", ""))),
                        view_count=_as_int(statistics.get("viewCount")),
                        like_count=_as_int(statistics.get("likeCount")),
                        comment_count=_as_int(statistics.get("commentCount")),
                        default_language=snippet.get("defaultAudioLanguage")
                        or snippet.get("defaultLanguage"),
                        caption_available=details.get("caption") == "true",
                        raw=item,
                    )
                )
        return output

    def fetch_channel_metadata(self, channel_ids: Iterable[str]) -> list[ChannelMetadata]:
        ids = _unique_nonempty(channel_ids)
        output: list[ChannelMetadata] = []
        for batch in _batches(ids, _BATCH_SIZE):
            payload = self._request(
                "channels",
                quota_units=1,
                params={"part": "snippet,statistics", "id": ",".join(batch)},
            )
            for item in payload.get("items", []):
                snippet = item.get("snippet", {})
                statistics = item.get("statistics", {})
                output.append(
                    ChannelMetadata(
                        channel_id=str(item.get("id", "")),
                        title=str(snippet.get("title", "")),
                        description=str(snippet.get("description", "")),
                        handle=snippet.get("customUrl"),
                        thumbnail_url=_best_thumbnail(snippet.get("thumbnails", {})),
                        subscriber_count=(
                            None
                            if statistics.get("hiddenSubscriberCount")
                            else _as_int(statistics.get("subscriberCount"))
                        ),
                        video_count=_as_int(statistics.get("videoCount")),
                        view_count=_as_int(statistics.get("viewCount")),
                        raw=item,
                    )
                )
        return output

    # Concise aliases make the adapter convenient for pipeline code.
    videos = fetch_video_metadata
    channels = fetch_channel_metadata

    def _request(
        self, endpoint: str, *, quota_units: int, params: dict[str, Any]
    ) -> dict[str, Any]:
        request_params = {**params, "key": self._api_key}
        last_error: YouTubeApiError | None = None
        for attempt in range(1, self._max_attempts + 1):
            try:
                response = self._client.get(
                    f"{API_URL}/{endpoint}", params=request_params, timeout=self._timeout
                )
                payload = response.json()
                if 200 <= response.status_code < 300:
                    if not isinstance(payload, dict):
                        raise YouTubeResponseError("YouTube API returned a non-object response")
                    self._record_quota(endpoint, quota_units, attempt, True)
                    return payload
                error = _response_error(response.status_code, payload)
            except YouTubeApiError as exc:
                error = exc
            except Exception as exc:
                error = YouTubeTransientError(
                    f"YouTube {endpoint}.list request failed: {exc}", retryable=True
                )
            self._record_quota(endpoint, quota_units, attempt, False)
            last_error = error
            if not error.retryable or attempt == self._max_attempts:
                raise error
            self._sleep(self._backoff_seconds * (2 ** (attempt - 1)))
        assert last_error is not None  # pragma: no cover
        raise last_error

    def _record_quota(self, endpoint: str, units: int, attempt: int, succeeded: bool) -> None:
        if self._quota_recorder is not None:
            self._quota_recorder(QuotaEvent(endpoint, units, attempt, succeeded))


def parse_iso8601_duration(value: str) -> int:
    """Parse the day/time subset returned by YouTube contentDetails."""
    match = _DURATION_RE.fullmatch(value)
    if not match:
        return 0
    parts = {name: int(number or 0) for name, number in match.groupdict().items()}
    return parts["days"] * 86400 + parts["hours"] * 3600 + parts["minutes"] * 60 + parts["seconds"]


def _response_error(status: int, payload: Any) -> YouTubeApiError:
    error_body = payload.get("error", {}) if isinstance(payload, dict) else {}
    message = str(error_body.get("message") or f"YouTube API returned HTTP {status}")
    errors = error_body.get("errors") or []
    reason = str(errors[0].get("reason")) if errors and isinstance(errors[0], dict) else None
    if reason in {"quotaExceeded", "dailyLimitExceeded", "rateLimitExceeded"}:
        return YouTubeQuotaExceededError(message, status_code=status, reason=reason)
    if status in {401, 403} and reason in {
        "keyInvalid",
        "accessNotConfigured",
        "forbidden",
        "ipRefererBlocked",
    }:
        return YouTubeAuthenticationError(message, status_code=status, reason=reason)
    if status == 429 or status >= 500:
        return YouTubeTransientError(message, status_code=status, reason=reason, retryable=True)
    return YouTubeResponseError(message, status_code=status, reason=reason)


def _unique_nonempty(values: Iterable[str]) -> list[str]:
    return list(dict.fromkeys(value.strip() for value in values if value and value.strip()))


def _batches(values: Sequence[str], size: int) -> Iterable[Sequence[str]]:
    for index in range(0, len(values), size):
        yield values[index : index + size]


def _as_int(value: Any) -> int:
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0


def _parse_datetime(value: Any) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None


def _best_thumbnail(thumbnails: Mapping[str, Any]) -> str | None:
    for size in ("maxres", "standard", "high", "medium", "default"):
        item = thumbnails.get(size)
        if isinstance(item, Mapping) and item.get("url"):
            return str(item["url"])
    return None
