"""BYOK support: decrypt admin-managed provider keys and build per-task runners.

The admin console stores provider API keys (AES-256-GCM, key material from
APP_SECRET_KEY) in llm_api_keys and per-task fallback chains in
llm_model_settings. This module turns those rows into LLMTaskRunner instances
so the pipeline honours what admins configure instead of environment variables.
"""

from __future__ import annotations

import base64
from collections.abc import Mapping, Sequence
from typing import Any

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from .providers import (
    AnthropicProvider,
    FallbackProvider,
    GeminiProvider,
    OpenAIProvider,
    OpenRouterProvider,
    ProviderTarget,
)
from .tasks import LLMTaskRunner

PROVIDER_FACTORIES: dict[str, Any] = {
    "openai": OpenAIProvider,
    "gemini": GeminiProvider,
    "anthropic": AnthropicProvider,
    "openrouter": OpenRouterProvider,
}
PIPELINE_TASKS = ("classify", "summarize", "quiz", "learning_path", "repair_json")


def decrypt_secret(envelope: Mapping[str, str], app_secret_key: str) -> str:
    """Decrypt one llm_api_keys envelope written by the web console."""
    key = base64.b64decode(app_secret_key)
    if len(key) != 32:
        raise ValueError("APP_SECRET_KEY must be a base64-encoded 32-byte key")
    nonce = base64.b64decode(envelope["encryption_iv"])
    ciphertext = base64.b64decode(envelope["encrypted_key"])
    tag = base64.b64decode(envelope["encryption_tag"])
    return AESGCM(key).decrypt(nonce, ciphertext + tag, None).decode("utf-8")


class TaskRoutedLLM:
    """Route each pipeline task to the runner built from its fallback chain."""

    def __init__(self, runners: Mapping[str, LLMTaskRunner]) -> None:
        if not runners:
            raise ValueError("at least one task runner is required")
        self._runners = dict(runners)

    def _runner(self, task: str) -> LLMTaskRunner:
        runner = self._runners.get(task)
        if runner is None:
            raise KeyError(f"no LLM runner configured for task {task}")
        return runner

    def classify(self, **inputs: Any) -> Any:
        return self._runner("classify").classify(**inputs)

    def summarize(self, **inputs: Any) -> Any:
        return self._runner("summarize").summarize(**inputs)

    def quiz(self, **inputs: Any) -> Any:
        return self._runner("quiz").quiz(**inputs)

    def learning_path(self, **inputs: Any) -> Any:
        return self._runner("learning_path").learning_path(**inputs)


def build_byok_llm(
    keys: Mapping[str, Mapping[str, str]],
    chains: Mapping[str, Sequence[tuple[str, str]]],
    app_secret_key: str,
    *,
    factories: Mapping[str, Any] = PROVIDER_FACTORIES,
) -> TaskRoutedLLM | None:
    """Build task-routed runners from DB rows; None when nothing is usable."""
    providers: dict[str, Any] = {}
    for provider_name, envelope in keys.items():
        factory = factories.get(provider_name)
        if factory is None:
            continue
        providers[provider_name] = factory(decrypt_secret(envelope, app_secret_key))

    runners: dict[str, LLMTaskRunner] = {}
    for task, targets in chains.items():
        resolved = [
            ProviderTarget(providers[provider_name], model_id)
            for provider_name, model_id in targets
            if provider_name in providers
        ]
        if resolved:
            fallback = FallbackProvider(resolved)
            runners[task] = LLMTaskRunner(fallback, model=resolved[0].model)
    if not runners:
        return None
    # Tasks without their own chain reuse the classify chain (or the first one),
    # so a partially configured console still runs the whole pipeline.
    default = runners.get("classify") or next(iter(runners.values()))
    for task in PIPELINE_TASKS:
        runners.setdefault(task, default)
    return TaskRoutedLLM(runners)
