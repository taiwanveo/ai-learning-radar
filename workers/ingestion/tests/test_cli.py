import pytest

from ai_learning_radar_worker.cli import (
    PROVIDER_KEYS,
    configuration_errors,
    extract_youtube_video_id,
    main,
)


def clear_worker_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    names = (
        "DATABASE_URL",
        "YOUTUBE_API_KEY",
        "LLM_MODEL",
        "LLM_PROVIDER",
        "TRANSCRIPT_MODE",
        "QUIZ_ENABLED",
        *PROVIDER_KEYS.values(),
    )
    for name in names:
        monkeypatch.delenv(name, raising=False)


def test_daily_dry_run(capsys, monkeypatch):
    clear_worker_environment(monkeypatch)
    assert main(["daily", "--dry-run"]) == 0
    assert "Dry-run not executed" in capsys.readouterr().out


def test_validate_config_reports_missing_values(capsys, monkeypatch):
    clear_worker_environment(monkeypatch)
    assert main(["validate-config"]) == 2
    assert "missing DATABASE_URL" in capsys.readouterr().err


def test_configuration_and_youtube_url_parsing():
    environment = {
        "DATABASE_URL": "postgresql://example",
        "YOUTUBE_API_KEY": "youtube-key",
        "LLM_PROVIDER": "gemini",
        "LLM_MODEL": "gemini-model",
        "GEMINI_API_KEY": "gemini-key",
    }
    assert configuration_errors(environment) == []
    assert extract_youtube_video_id("https://www.youtube.com/watch?v=abc_123-xyz") == "abc_123-xyz"
    assert extract_youtube_video_id("https://youtu.be/abc123") == "abc123"


def test_quiz_requires_transcripts() -> None:
    environment = {
        "DATABASE_URL": "postgresql://example",
        "YOUTUBE_API_KEY": "youtube-key",
        "LLM_PROVIDER": "openrouter",
        "LLM_MODEL": "openai/gpt-4o-mini",
        "OPENROUTER_API_KEY": "router-key",
        "TRANSCRIPT_MODE": "disabled",
        "QUIZ_ENABLED": "true",
    }
    assert configuration_errors(environment) == [
        "QUIZ_ENABLED requires TRANSCRIPT_MODE=required"
    ]
