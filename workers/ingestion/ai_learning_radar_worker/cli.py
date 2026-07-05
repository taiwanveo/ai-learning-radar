"""Command-line entry point for the ingestion worker."""

from __future__ import annotations

import argparse
import json
import os
import sys
from collections.abc import Mapping, Sequence
from typing import Any
from urllib.parse import parse_qs, urlparse
from uuid import UUID

from .llm.providers import (
    AnthropicProvider,
    GeminiProvider,
    OpenAIProvider,
    OpenRouterProvider,
)
from .llm.tasks import LLMTaskRunner
from .pipelines import DailyDigestPipeline
from .repositories import PostgresRepository
from .sources.youtube import SearchResult, VideoMetadata, YouTubeAdapter
from .transcripts import YouTubeTranscriptAdapter

PROVIDER_KEYS = {
    "openai": "OPENAI_API_KEY",
    "gemini": "GEMINI_API_KEY",
    "anthropic": "ANTHROPIC_API_KEY",
    "openrouter": "OPENROUTER_API_KEY",
}
TRANSCRIPT_MODES = {"disabled", "required"}


def _enabled(environment: Mapping[str, str], name: str, *, default: bool) -> bool:
    value = environment.get(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="ai-learning-radar-worker")
    subparsers = parser.add_subparsers(dest="command", required=True)

    daily = subparsers.add_parser("daily", help="Run the daily ingestion pipeline")
    daily.add_argument("--topic-id")
    daily.add_argument("--dry-run", action="store_true")
    daily.add_argument(
        "--run-id",
        help="Claim an existing queued agent_runs row (manual trigger from the admin console)",
    )

    backfill = subparsers.add_parser("backfill", help="Backfill a historical date range")
    backfill.add_argument("--days", type=int, required=True)

    subparsers.add_parser("validate-config", help="Validate worker configuration")

    test_video = subparsers.add_parser("test-video", help="Process one YouTube video")
    test_video.add_argument("--url", required=True)
    test_video.add_argument("--topic-id")
    return parser


def configuration_errors(environment: Mapping[str, str] | None = None) -> list[str]:
    env = environment or os.environ
    errors: list[str] = []
    for name in ("DATABASE_URL", "YOUTUBE_API_KEY", "LLM_MODEL"):
        if not env.get(name, "").strip():
            errors.append(f"missing {name}")
    provider = env.get("LLM_PROVIDER", "openai").strip().lower()
    key_name = PROVIDER_KEYS.get(provider)
    if key_name is None:
        errors.append(f"unsupported LLM_PROVIDER: {provider}")
    elif not env.get(key_name, "").strip():
        errors.append(f"missing {key_name} for {provider}")
    transcript_mode = env.get("TRANSCRIPT_MODE", "disabled").strip().lower()
    if transcript_mode not in TRANSCRIPT_MODES:
        errors.append(f"unsupported TRANSCRIPT_MODE: {transcript_mode}")
    quiz_enabled = _enabled(env, "QUIZ_ENABLED", default=False)
    if quiz_enabled and transcript_mode != "required":
        errors.append("QUIZ_ENABLED requires TRANSCRIPT_MODE=required")
    return errors


def build_llm_runner(environment: Mapping[str, str] | None = None) -> LLMTaskRunner:
    env = environment or os.environ
    provider_name = env.get("LLM_PROVIDER", "openai").strip().lower()
    key_name = PROVIDER_KEYS[provider_name]
    api_key = env[key_name]
    providers = {
        "openai": OpenAIProvider,
        "gemini": GeminiProvider,
        "anthropic": AnthropicProvider,
        "openrouter": OpenRouterProvider,
    }
    return LLMTaskRunner(providers[provider_name](api_key), model=env["LLM_MODEL"])


def build_transcript_adapter(
    environment: Mapping[str, str] | None = None,
) -> YouTubeTranscriptAdapter | None:
    env = environment or os.environ
    return (
        YouTubeTranscriptAdapter()
        if env.get("TRANSCRIPT_MODE", "disabled").strip().lower() == "required"
        else None
    )


def _run_daily(args: argparse.Namespace) -> int:
    errors = configuration_errors()
    if errors:
        if args.dry_run:
            print("Dry-run not executed; " + "; ".join(errors))
            return 0
        print("Invalid configuration: " + "; ".join(errors), file=sys.stderr)
        return 2

    import psycopg

    # autocommit avoids idle-in-transaction timeouts while long LLM calls run
    # between statements; multi-statement writes still use explicit transactions.
    with psycopg.connect(os.environ["DATABASE_URL"], autocommit=True) as connection:
        repository = PostgresRepository(connection)
        topic_id = UUID(args.topic_id) if args.topic_id else None
        run_id = UUID(args.run_id) if args.run_id else None
        topics = repository.load_active_topics(topic_id)
        if not topics:
            if run_id is not None and not args.dry_run:
                repository.finish_run(run_id, "failed", {}, "no active topics matched the request")
            print("No active topics matched the request", file=sys.stderr)
            return 2
        pipeline = DailyDigestPipeline(
            youtube=YouTubeAdapter(os.environ["YOUTUBE_API_KEY"]),
            transcripts=build_transcript_adapter(),
            llm=build_llm_runner(),
            repository=repository,
            quiz_enabled=_enabled(os.environ, "QUIZ_ENABLED", default=False),
        )
        report = pipeline.run(
            topics,
            dry_run=args.dry_run,
            trigger="manual" if run_id is not None else "scheduled",
            run_id=run_id,
        )
    print(json.dumps(report.as_dict(), ensure_ascii=False, default=str))
    return 0 if report.status == "succeeded" or report.analyzed > 0 else 1


class _SingleVideoAdapter:
    def __init__(self, adapter: YouTubeAdapter, metadata: VideoMetadata) -> None:
        self.adapter = adapter
        self.metadata = metadata

    def search(self, *args: Any, **kwargs: Any) -> list[SearchResult]:
        del args, kwargs
        item = self.metadata
        return [
            SearchResult(
                item.video_id,
                item.title,
                item.description,
                item.channel_id,
                item.channel_title,
                item.published_at,
                item.thumbnail_url,
            )
        ]

    def fetch_video_metadata(self, video_ids: Sequence[str]) -> list[VideoMetadata]:
        return [self.metadata] if self.metadata.video_id in video_ids else []

    def fetch_channel_metadata(self, channel_ids: Sequence[str]) -> Any:
        return self.adapter.fetch_channel_metadata(channel_ids)


def extract_youtube_video_id(url: str) -> str:
    parsed = urlparse(url)
    host = parsed.hostname.lower() if parsed.hostname else ""
    if host in {"youtu.be", "www.youtu.be"}:
        video_id = parsed.path.strip("/").split("/")[0]
    elif host in {"youtube.com", "www.youtube.com", "m.youtube.com"}:
        if parsed.path == "/watch":
            video_id = parse_qs(parsed.query).get("v", [""])[0]
        elif parsed.path.startswith(("/shorts/", "/embed/")):
            video_id = parsed.path.strip("/").split("/")[1]
        else:
            video_id = ""
    else:
        video_id = ""
    valid_characters = all(char.isalnum() or char in "_-" for char in video_id)
    if not video_id or len(video_id) > 64 or not valid_characters:
        raise ValueError("unsupported or invalid YouTube URL")
    return video_id


def _run_test_video(args: argparse.Namespace) -> int:
    errors = configuration_errors()
    if errors:
        print("Invalid configuration: " + "; ".join(errors), file=sys.stderr)
        return 2
    try:
        video_id = extract_youtube_video_id(args.url)
    except ValueError as exc:
        print(str(exc), file=sys.stderr)
        return 2

    import psycopg

    youtube = YouTubeAdapter(os.environ["YOUTUBE_API_KEY"])
    metadata = youtube.fetch_video_metadata([video_id])
    if not metadata:
        print("YouTube video was not found", file=sys.stderr)
        return 1
    with psycopg.connect(os.environ["DATABASE_URL"], autocommit=True) as connection:
        repository = PostgresRepository(connection)
        topic_id = UUID(args.topic_id) if args.topic_id else None
        topics = repository.load_active_topics(topic_id)
        if not topics:
            print("No active topic matched the request", file=sys.stderr)
            return 2
        pipeline = DailyDigestPipeline(
            youtube=_SingleVideoAdapter(youtube, metadata[0]),  # type: ignore[arg-type]
            transcripts=build_transcript_adapter(),
            llm=build_llm_runner(),
            repository=repository,
            quiz_enabled=_enabled(os.environ, "QUIZ_ENABLED", default=False),
        )
        report = pipeline.run([topics[0]], trigger="test")
    print(json.dumps(report.as_dict(), ensure_ascii=False, default=str))
    return 0 if report.status == "succeeded" or report.analyzed > 0 else 1


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)

    if args.command == "daily":
        return _run_daily(args)
    if args.command == "test-video":
        return _run_test_video(args)
    if args.command == "validate-config":
        errors = configuration_errors()
        if errors:
            print("Invalid configuration: " + "; ".join(errors), file=sys.stderr)
            return 2
        print("Configuration is valid")
        return 0

    print(f"Backfill pipeline is not implemented yet (days={args.days})", file=sys.stderr)
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
