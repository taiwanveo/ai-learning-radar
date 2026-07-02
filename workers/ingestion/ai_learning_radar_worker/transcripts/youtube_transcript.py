"""Replaceable adapter around youtube-transcript-api."""

from __future__ import annotations

import hashlib
import html
import time
from collections.abc import Callable, Iterable, Mapping, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any, Protocol

DEFAULT_LANGUAGE_PRIORITY = ("zh-Hant", "zh-TW", "zh", "zh-Hans", "zh-CN")


class TranscriptClient(Protocol):
    def list(self, video_id: str) -> Any: ...


@dataclass(frozen=True, slots=True)
class TranscriptResult:
    video_id: str
    text: str
    language: str
    transcript_hash: str
    source: str
    retrieved_at: datetime


class TranscriptError(RuntimeError):
    def __init__(self, message: str, *, video_id: str, retryable: bool) -> None:
        super().__init__(message)
        self.video_id = video_id
        self.retryable = retryable


class TranscriptUnavailableError(TranscriptError):
    """No transcript in an accepted language exists for this video."""

    def __init__(self, video_id: str, message: str | None = None) -> None:
        super().__init__(
            message or f"No supported transcript is available for video {video_id}",
            video_id=video_id,
            retryable=False,
        )


class TranscriptFetchError(TranscriptError):
    """A transient transcript provider failure."""

    def __init__(self, video_id: str, message: str) -> None:
        super().__init__(message, video_id=video_id, retryable=True)


class YouTubeTranscriptAdapter:
    def __init__(
        self,
        *,
        client: TranscriptClient | Any | None = None,
        max_attempts: int = 2,
        backoff_seconds: float = 0.5,
        sleeper: Callable[[float], None] = time.sleep,
    ) -> None:
        if max_attempts < 1:
            raise ValueError("max_attempts must be at least 1")
        if client is None:
            try:
                from youtube_transcript_api import YouTubeTranscriptApi
            except ImportError as exc:  # pragma: no cover - deployment setup
                raise RuntimeError(
                    "The default transcript client requires the 'youtube-transcript-api' package"
                ) from exc
            client = YouTubeTranscriptApi()
        self._client = client
        self._max_attempts = max_attempts
        self._backoff_seconds = backoff_seconds
        self._sleep = sleeper

    def fetch(
        self,
        video_id: str,
        *,
        languages: Sequence[str] = DEFAULT_LANGUAGE_PRIORITY,
    ) -> TranscriptResult:
        if not video_id.strip():
            raise ValueError("video_id must not be empty")
        if not languages:
            raise ValueError("languages must not be empty")
        last_error: Exception | None = None
        for attempt in range(1, self._max_attempts + 1):
            try:
                entries, language = self._fetch_entries(video_id, tuple(languages))
                text = normalize_transcript(entries)
                if not text:
                    raise TranscriptUnavailableError(
                        video_id, "Transcript is empty after normalization"
                    )
                return TranscriptResult(
                    video_id=video_id,
                    text=text,
                    language=language,
                    transcript_hash=hash_transcript(text),
                    source="youtube_transcript_api",
                    retrieved_at=datetime.now(UTC),
                )
            except TranscriptUnavailableError:
                raise
            except Exception as exc:
                if _is_unavailable_error(exc):
                    raise TranscriptUnavailableError(video_id, str(exc)) from exc
                last_error = exc
                if attempt == self._max_attempts:
                    raise TranscriptFetchError(video_id, str(exc)) from exc
                self._sleep(self._backoff_seconds * (2 ** (attempt - 1)))
        raise TranscriptFetchError(video_id, str(last_error))  # pragma: no cover

    def _fetch_entries(
        self, video_id: str, languages: tuple[str, ...]
    ) -> tuple[Iterable[Any], str]:
        # Modern youtube-transcript-api: list() then explicitly select in our priority order.
        if hasattr(self._client, "list"):
            transcript_list = self._client.list(video_id)
            available = list(transcript_list)
            for language in languages:
                selected = next(
                    (
                        item
                        for item in available
                        if getattr(item, "language_code", None) == language
                    ),
                    None,
                )
                if selected is not None:
                    return selected.fetch(), language
            raise TranscriptUnavailableError(video_id)

        # Older/static or deliberately simple injected clients.
        getter = getattr(self._client, "get_transcript", None)
        if getter is None:
            raise TypeError("transcript client must provide list() or get_transcript()")
        entries = getter(video_id, languages=list(languages))
        language = _language_from_entries(entries) or languages[0]
        return entries, language


def normalize_transcript(entries: Iterable[Any] | str) -> str:
    """Produce stable plain text for persistence and content-addressed caching."""
    if isinstance(entries, str):
        parts = [entries]
    else:
        parts = []
        for entry in entries:
            if isinstance(entry, Mapping):
                value = entry.get("text", "")
            else:
                value = getattr(entry, "text", "")
            if value:
                parts.append(str(value))
    return " ".join(html.unescape(" ".join(parts)).replace("\u200b", "").split())


def hash_transcript(normalized_text: str) -> str:
    return hashlib.sha256(normalized_text.encode("utf-8")).hexdigest()


def _language_from_entries(entries: Any) -> str | None:
    return getattr(entries, "language_code", None)


def _is_unavailable_error(error: Exception) -> bool:
    # Avoid importing provider exception classes so injected clients stay lightweight.
    return type(error).__name__ in {
        "CouldNotRetrieveTranscript",
        "NoTranscriptFound",
        "TranscriptsDisabled",
        "VideoUnavailable",
        "NoTranscriptAvailable",
    }
