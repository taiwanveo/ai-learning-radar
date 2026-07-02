"""Ordered provider fallback and usage/cost instrumentation."""

from __future__ import annotations

from dataclasses import dataclass, replace
from typing import Any, Protocol

from .base import GenerationResult, LLMProvider, ProviderError


@dataclass(frozen=True)
class ProviderTarget:
    provider: LLMProvider
    model: str


@dataclass(frozen=True)
class LLMCallRecord:
    provider: str
    model: str
    prompt_tokens: int
    completion_tokens: int
    estimated_cost_usd: float | None
    success: bool
    error: str | None = None


class UsageLogger(Protocol):
    def log(self, record: LLMCallRecord) -> None: ...


class NullUsageLogger:
    def log(self, record: LLMCallRecord) -> None:
        del record


class InMemoryUsageLogger:
    def __init__(self) -> None:
        self.records: list[LLMCallRecord] = []

    def log(self, record: LLMCallRecord) -> None:
        self.records.append(record)


@dataclass(frozen=True)
class TokenPricing:
    """USD prices per one million input and output tokens."""

    input_per_million: float
    output_per_million: float

    def estimate(self, prompt_tokens: int, completion_tokens: int) -> float:
        return (
            prompt_tokens * self.input_per_million + completion_tokens * self.output_per_million
        ) / 1_000_000


class FallbackProvider:
    """Try configured provider/model targets in order for each generation."""

    name = "fallback"

    def __init__(
        self,
        targets: list[ProviderTarget],
        *,
        usage_logger: UsageLogger | None = None,
        pricing: dict[tuple[str, str], TokenPricing] | None = None,
    ) -> None:
        if not targets:
            raise ValueError("fallback chain requires at least one target")
        self.targets = targets
        self.usage_logger = usage_logger or NullUsageLogger()
        self.pricing = pricing or {}

    def validate_key(self) -> bool:
        return any(target.provider.validate_key() for target in self.targets)

    def list_models(self) -> list[str]:
        models: list[str] = []
        for target in self.targets:
            models.extend(
                f"{target.provider.name}/{model}" for model in target.provider.list_models()
            )
        return models

    def generate_json(
        self,
        *,
        model: str = "",
        prompt: str,
        schema: dict[str, Any] | None = None,
        temperature: float = 0.0,
    ) -> GenerationResult:
        del model  # Each target carries its own model.
        failures: list[str] = []
        for target in self.targets:
            try:
                result = target.provider.generate_json(
                    model=target.model,
                    prompt=prompt,
                    schema=schema,
                    temperature=temperature,
                )
                price = self.pricing.get((result.provider, result.model))
                cost = (
                    price.estimate(result.prompt_tokens, result.completion_tokens)
                    if price
                    else result.estimated_cost_usd
                )
                result = replace(result, estimated_cost_usd=cost)
                self.usage_logger.log(
                    LLMCallRecord(
                        provider=result.provider,
                        model=result.model,
                        prompt_tokens=result.prompt_tokens,
                        completion_tokens=result.completion_tokens,
                        estimated_cost_usd=cost,
                        success=True,
                    )
                )
                return result
            except Exception as exc:
                error = f"{type(exc).__name__}: {exc}"
                failures.append(f"{target.provider.name}/{target.model}: {error}")
                self.usage_logger.log(
                    LLMCallRecord(
                        provider=target.provider.name,
                        model=target.model,
                        prompt_tokens=0,
                        completion_tokens=0,
                        estimated_cost_usd=None,
                        success=False,
                        error=error,
                    )
                )
        raise ProviderError("all LLM providers failed: " + "; ".join(failures))
