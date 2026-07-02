from __future__ import annotations

from datetime import UTC, datetime

import pytest

from ai_learning_radar_worker.sources.youtube import (
    QuotaEvent,
    YouTubeAdapter,
    YouTubeQuotaExceededError,
    parse_iso8601_duration,
)


class Response:
    def __init__(self, status_code, payload):
        self.status_code = status_code
        self._payload = payload

    def json(self):
        return self._payload


class FakeClient:
    def __init__(self, responses):
        self.responses = iter(responses)
        self.calls = []

    def get(self, url, *, params, timeout):
        self.calls.append((url, params, timeout))
        response = next(self.responses)
        if isinstance(response, Exception):
            raise response
        return response


def test_search_uses_required_filters_and_records_quota():
    client = FakeClient(
        [
            Response(
                200,
                {
                    "items": [
                        {
                            "id": {"videoId": "abc"},
                            "snippet": {
                                "title": "RAG 教學",
                                "description": "desc",
                                "channelId": "channel",
                                "channelTitle": "Teacher",
                                "publishedAt": "2026-06-01T10:00:00Z",
                                "thumbnails": {"high": {"url": "https://thumb"}},
                            },
                        }
                    ]
                },
            )
        ]
    )
    events: list[QuotaEvent] = []
    adapter = YouTubeAdapter("secret", client=client, quota_recorder=events.append)

    result = adapter.search("RAG", now=datetime(2026, 7, 2, tzinfo=UTC))

    assert [item.video_id for item in result] == ["abc"]
    params = client.calls[0][1]
    assert params["type"] == "video"
    assert params["videoCaption"] == "closedCaption"
    assert params["regionCode"] == "TW"
    assert params["publishedAfter"] == "2026-04-03T00:00:00Z"
    assert events == [QuotaEvent("search", 100, 1, True)]


def test_video_and_channel_metadata_are_batched_and_parsed():
    video_item = {
        "id": "v1",
        "snippet": {
            "title": "title",
            "channelId": "c1",
            "channelTitle": "channel",
            "publishedAt": "2026-07-01T00:00:00Z",
            "defaultAudioLanguage": "zh-TW",
        },
        "statistics": {"viewCount": "100", "likeCount": "5"},
        "contentDetails": {"duration": "PT1H2M3S", "caption": "true"},
    }
    channel_item = {
        "id": "c1",
        "snippet": {"title": "channel", "customUrl": "@channel"},
        "statistics": {
            "subscriberCount": "99",
            "videoCount": "10",
            "viewCount": "1000",
        },
    }
    client = FakeClient(
        [
            Response(200, {"items": [video_item]}),
            Response(200, {"items": []}),
            Response(200, {"items": [channel_item]}),
        ]
    )
    adapter = YouTubeAdapter("secret", client=client)

    videos = adapter.fetch_video_metadata(["v1"] + [f"v{i}" for i in range(2, 52)])
    channels = adapter.fetch_channel_metadata(["c1", "c1"])

    assert len([call for call in client.calls if call[0].endswith("/videos")]) == 2
    assert videos[0].duration_seconds == 3723
    assert videos[0].comment_count == 0
    assert videos[0].caption_available is True
    assert channels[0].subscriber_count == 99
    assert parse_iso8601_duration("PT5M") == 300


def test_transient_error_retries_but_quota_error_does_not():
    sleeps = []
    client = FakeClient(
        [
            Response(500, {"error": {"message": "server"}}),
            Response(200, {"items": []}),
        ]
    )
    adapter = YouTubeAdapter("secret", client=client, sleeper=sleeps.append)
    assert adapter.search("AI") == []
    assert sleeps == [0.5]

    quota_client = FakeClient(
        [
            Response(
                403,
                {
                    "error": {
                        "message": "quota",
                        "errors": [{"reason": "quotaExceeded"}],
                    }
                },
            )
        ]
    )
    with pytest.raises(YouTubeQuotaExceededError) as error:
        YouTubeAdapter("secret", client=quota_client).search("AI")
    assert error.value.retryable is False
    assert len(quota_client.calls) == 1
