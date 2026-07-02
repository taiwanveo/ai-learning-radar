"""Validated LLM task runners with one automatic schema-repair attempt."""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Generic, TypeVar

from pydantic import BaseModel, ValidationError

from .prompts import (
    CLASSIFIER_PROMPT,
    CLASSIFIER_PROMPT_VERSION,
    COMMON,
    LEARNING_PATH_PROMPT,
    LEARNING_PATH_PROMPT_VERSION,
    QUIZ_PROMPT,
    QUIZ_PROMPT_VERSION,
    REPAIR_PROMPT,
    REPAIR_PROMPT_VERSION,
    SUMMARY_PROMPT,
    SUMMARY_PROMPT_VERSION,
)
from .providers import GenerationResult, LLMProvider
from .schemas import ClassificationResult, LearningPathResult, QuizResult, SummaryResult

ResultT = TypeVar("ResultT", bound=BaseModel)


class LLMTaskError(RuntimeError):
    """Generation remained invalid after the single repair attempt."""


@dataclass(frozen=True)
class TaskResult(Generic[ResultT]):
    value: ResultT
    prompt_version: str
    provider: str
    model: str
    repaired: bool = False
    repair_prompt_version: str | None = None
    generations: tuple[GenerationResult, ...] = ()


def _json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, default=str)


class LLMTaskRunner:
    def __init__(self, provider: LLMProvider, *, model: str, temperature: float = 0.0) -> None:
        self.provider = provider
        self.model = model
        self.temperature = temperature

    def _run(
        self,
        *,
        prompt: str,
        prompt_version: str,
        result_type: type[ResultT],
    ) -> TaskResult[ResultT]:
        schema = result_type.model_json_schema()
        first = self.provider.generate_json(
            model=self.model,
            prompt=prompt,
            schema=schema,
            temperature=self.temperature,
        )
        try:
            value = result_type.model_validate_json(first.text)
            return TaskResult(
                value=value,
                prompt_version=prompt_version,
                provider=first.provider,
                model=first.model,
                generations=(first,),
            )
        except (ValidationError, ValueError) as exc:
            repair_prompt = REPAIR_PROMPT.format(
                common=COMMON,
                schema_json=_json(schema),
                validation_error=str(exc),
                bad_output=first.text,
            )

        repaired = self.provider.generate_json(
            model=self.model,
            prompt=repair_prompt,
            schema=schema,
            temperature=0.0,
        )
        try:
            value = result_type.model_validate_json(repaired.text)
        except (ValidationError, ValueError) as exc:
            raise LLMTaskError(
                f"{result_type.__name__} output invalid after one repair: {exc}"
            ) from exc
        return TaskResult(
            value=value,
            prompt_version=prompt_version,
            provider=repaired.provider,
            model=repaired.model,
            repaired=True,
            repair_prompt_version=REPAIR_PROMPT_VERSION,
            generations=(first, repaired),
        )

    def classify(
        self,
        *,
        title: str,
        description: str,
        channel_title: str,
        duration_minutes: float,
        published_at: str,
        topic_name: str,
        topic_keywords: list[str],
        rule_signals: dict[str, Any],
        transcript_excerpt: str,
    ) -> TaskResult[ClassificationResult]:
        prompt = CLASSIFIER_PROMPT.format(
            common=COMMON,
            title=title,
            description=description,
            channel_title=channel_title,
            duration_minutes=duration_minutes,
            published_at=published_at,
            topic_name=topic_name,
            topic_keywords=_json(topic_keywords),
            rule_signals_json=_json(rule_signals),
            transcript_excerpt=transcript_excerpt,
        )
        return self._run(
            prompt=prompt,
            prompt_version=CLASSIFIER_PROMPT_VERSION,
            result_type=ClassificationResult,
        )

    def summarize(
        self,
        *,
        title: str,
        description: str,
        channel_title: str,
        topic_name: str,
        difficulty: str,
        transcript_text: str,
    ) -> TaskResult[SummaryResult]:
        prompt = SUMMARY_PROMPT.format(
            common=COMMON,
            title=title,
            description=description,
            channel_title=channel_title,
            topic_name=topic_name,
            difficulty=difficulty,
            transcript_text=transcript_text,
        )
        return self._run(
            prompt=prompt,
            prompt_version=SUMMARY_PROMPT_VERSION,
            result_type=SummaryResult,
        )

    def quiz(
        self,
        *,
        title: str,
        short_summary: str,
        learning_objectives: list[str],
        transcript_text: str,
    ) -> TaskResult[QuizResult]:
        prompt = QUIZ_PROMPT.format(
            common=COMMON,
            title=title,
            short_summary=short_summary,
            learning_objectives=_json(learning_objectives),
            transcript_text=transcript_text,
        )
        return self._run(
            prompt=prompt,
            prompt_version=QUIZ_PROMPT_VERSION,
            result_type=QuizResult,
        )

    def learning_path(
        self,
        *,
        query: str,
        search_results: list[dict[str, Any]],
        difficulty: str = "beginner",
    ) -> TaskResult[LearningPathResult]:
        prompt = LEARNING_PATH_PROMPT.format(
            common=COMMON,
            query=query,
            difficulty=difficulty,
            search_results_json=_json(search_results[:25]),
        )
        return self._run(
            prompt=prompt,
            prompt_version=LEARNING_PATH_PROMPT_VERSION,
            result_type=LearningPathResult,
        )


def classify(
    provider: LLMProvider, *, model: str, **inputs: Any
) -> TaskResult[ClassificationResult]:
    return LLMTaskRunner(provider, model=model).classify(**inputs)


def summarize(provider: LLMProvider, *, model: str, **inputs: Any) -> TaskResult[SummaryResult]:
    return LLMTaskRunner(provider, model=model).summarize(**inputs)


def generate_quiz(provider: LLMProvider, *, model: str, **inputs: Any) -> TaskResult[QuizResult]:
    return LLMTaskRunner(provider, model=model).quiz(**inputs)


def generate_learning_path(
    provider: LLMProvider, *, model: str, **inputs: Any
) -> TaskResult[LearningPathResult]:
    return LLMTaskRunner(provider, model=model).learning_path(**inputs)
