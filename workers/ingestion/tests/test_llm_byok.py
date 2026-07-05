from __future__ import annotations

import base64
import os

import pytest
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from ai_learning_radar_worker.llm.byok import (
    TaskRoutedLLM,
    build_byok_llm,
    decrypt_secret,
)
from ai_learning_radar_worker.llm.providers import MockProvider

APP_SECRET_KEY = base64.b64encode(b"0" * 32).decode()


def envelope(secret: str, app_secret_key: str = APP_SECRET_KEY) -> dict[str, str]:
    """Encrypt like the web console: AES-256-GCM with a detached auth tag."""
    key = base64.b64decode(app_secret_key)
    nonce = os.urandom(12)
    sealed = AESGCM(key).encrypt(nonce, secret.encode(), None)
    return {
        "encrypted_key": base64.b64encode(sealed[:-16]).decode(),
        "encryption_iv": base64.b64encode(nonce).decode(),
        "encryption_tag": base64.b64encode(sealed[-16:]).decode(),
    }


def test_decrypt_secret_round_trips_web_envelope() -> None:
    assert decrypt_secret(envelope("sk-test-123"), APP_SECRET_KEY) == "sk-test-123"


def test_decrypt_secret_rejects_bad_key_material() -> None:
    with pytest.raises(ValueError, match="32-byte"):
        decrypt_secret(envelope("sk"), base64.b64encode(b"short").decode())


class RecordingMockProvider(MockProvider):
    def __init__(self, api_key: str) -> None:
        super().__init__(responses=[])
        self.api_key = api_key


def test_build_byok_llm_builds_per_task_chains_and_default() -> None:
    factories = {"openai": RecordingMockProvider}
    llm = build_byok_llm(
        {"openai": envelope("sk-live"), "unknown": envelope("ignored")},
        {
            "classify": [("openai", "gpt-test"), ("missing-provider", "x")],
            "summarize": [("openai", "gpt-summary")],
        },
        APP_SECRET_KEY,
        factories=factories,
    )
    assert isinstance(llm, TaskRoutedLLM)
    classify_runner = llm._runner("classify")
    assert classify_runner.provider.targets[0].model == "gpt-test"
    assert classify_runner.provider.targets[0].provider.api_key == "sk-live"
    # quiz has no chain of its own and reuses the classify chain.
    assert llm._runner("quiz") is classify_runner
    assert llm._runner("summarize").provider.targets[0].model == "gpt-summary"


def test_build_byok_llm_returns_none_without_usable_chain() -> None:
    assert build_byok_llm({}, {}, APP_SECRET_KEY) is None
    assert (
        build_byok_llm(
            {},
            {"classify": [("openai", "gpt-test")]},
            APP_SECRET_KEY,
            factories={"openai": RecordingMockProvider},
        )
        is None
    )
