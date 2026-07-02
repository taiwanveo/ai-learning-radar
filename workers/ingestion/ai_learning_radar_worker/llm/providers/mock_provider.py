"""Deterministic provider for unit tests and pipeline dry-runs."""

from __future__ import annotations

import json
from collections import deque
from collections.abc import Iterable
from typing import Any

from .base import GenerationResult, ProviderError


class MockProvider:
    name = "mock"

    def __init__(
        self,
        responses: Iterable[str | dict[str, Any]],
        *,
        models: Iterable[str] = ("mock-model",),
        valid_key: bool = True,
    ) -> None:
        self.responses = deque(
            json.dumps(item, ensure_ascii=False) if isinstance(item, dict) else item
            for item in responses
        )
        self.models = list(models)
        self.valid_key = valid_key
        self.calls: list[dict[str, Any]] = []

    def validate_key(self) -> bool:
        return self.valid_key

    def list_models(self) -> list[str]:
        return self.models.copy()

    def generate_json(
        self,
        *,
        model: str,
        prompt: str,
        schema: dict[str, Any] | None = None,
        temperature: float = 0.0,
    ) -> GenerationResult:
        self.calls.append(
            {"model": model, "prompt": prompt, "schema": schema, "temperature": temperature}
        )
        if not self.responses:
            raise ProviderError("mock response queue is empty")
        return GenerationResult(text=self.responses.popleft(), provider=self.name, model=model)
