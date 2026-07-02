from __future__ import annotations

from dataclasses import dataclass

import pytest

from ai_learning_radar_worker.transcripts.youtube_transcript import (
    TranscriptFetchError,
    TranscriptUnavailableError,
    YouTubeTranscriptAdapter,
    hash_transcript,
    normalize_transcript,
)


@dataclass
class Entry:
    text: str


class Track:
    def __init__(self, language_code, entries):
        self.language_code = language_code
        self.entries = entries

    def fetch(self):
        return self.entries


class Client:
    def __init__(self, tracks):
        self.tracks = tracks
        self.calls = 0

    def list(self, video_id):
        self.calls += 1
        if isinstance(self.tracks, Exception):
            raise self.tracks
        return self.tracks


def test_language_priority_normalization_and_hash():
    client = Client(
        [
            Track("zh-CN", [Entry("簡體")]),
            Track("zh-TW", [Entry("  第一段\n"), Entry("第二段 &amp; 說明\u200b")]),
        ]
    )
    result = YouTubeTranscriptAdapter(client=client).fetch("video")

    assert result.language == "zh-TW"
    assert result.text == "第一段 第二段 & 說明"
    assert result.transcript_hash == hash_transcript(result.text)
    assert len(result.transcript_hash) == 64


def test_unavailable_is_typed_and_not_retried():
    client = Client([Track("en", [Entry("English")])])
    with pytest.raises(TranscriptUnavailableError) as error:
        YouTubeTranscriptAdapter(client=client).fetch("video")
    assert error.value.retryable is False
    assert client.calls == 1


def test_transient_error_retries_twice():
    class BrokenClient:
        def __init__(self):
            self.calls = 0

        def list(self, video_id):
            self.calls += 1
            raise ConnectionError("network")

    client = BrokenClient()
    sleeps = []
    with pytest.raises(TranscriptFetchError) as error:
        YouTubeTranscriptAdapter(client=client, sleeper=sleeps.append).fetch("video")
    assert error.value.retryable is True
    assert client.calls == 2
    assert sleeps == [0.5]


def test_normalize_accepts_mapping_entries():
    assert normalize_transcript([{"text": " a  b "}, {"text": "c"}]) == "a b c"
