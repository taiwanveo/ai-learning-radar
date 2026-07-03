"""Pydantic contracts for structured LLM output.

These models intentionally reject unknown fields so prompt drift fails at the
worker boundary instead of silently entering persistence code.
"""

from __future__ import annotations

from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

Score = Annotated[float, Field(ge=0.0, le=1.0)]
NonEmptyText = Annotated[str, Field(min_length=1)]


class ContractModel(BaseModel):
    """Base configuration shared by JSON contracts."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class ClassificationResult(ContractModel):
    """Classifier output from PromptTemplates section 2.4."""

    is_tutorial: bool
    tutorial_confidence: Score
    content_type: Literal[
        "tutorial", "news", "opinion", "product_demo", "marketing", "interview", "other"
    ]
    difficulty: Literal["beginner", "normal"]
    difficulty_confidence: Score
    topic_relevance_score: Score
    tutorial_quality_score: Score
    reason: NonEmptyText
    difficulty_reason: NonEmptyText
    signals: list[NonEmptyText]


class SummaryResult(ContractModel):
    """Summary output from PromptTemplates section 3.4."""

    suitable_for: NonEmptyText
    short_summary: Annotated[str, Field(min_length=100, max_length=200)]
    full_summary: Annotated[str, Field(min_length=200, max_length=800)]
    transcript_summary: Annotated[str, Field(min_length=300, max_length=500)] | None
    learning_objectives: Annotated[list[NonEmptyText], Field(min_length=3, max_length=5)]
    key_concepts: Annotated[list[NonEmptyText], Field(min_length=3, max_length=8)]
    limitations_or_cautions: str


class QuizOptions(ContractModel):
    """The four explicitly named options required by the quiz contract."""

    A: NonEmptyText
    B: NonEmptyText
    C: NonEmptyText
    D: NonEmptyText


class QuizQuestion(ContractModel):
    question_type: Literal["comprehension", "application", "concept"]
    question_text: NonEmptyText
    options: QuizOptions
    correct_option_key: Literal["A", "B", "C", "D"]
    explanation: NonEmptyText
    evidence_text: Annotated[str, Field(min_length=1, max_length=80)]


class QuizResult(ContractModel):
    """Exactly one question of each required type, in prompt-defined order."""

    questions: Annotated[list[QuizQuestion], Field(min_length=3, max_length=3)]

    @model_validator(mode="after")
    def validate_question_types(self) -> QuizResult:
        expected = ["comprehension", "application", "concept"]
        actual = [question.question_type for question in self.questions]
        if actual != expected:
            raise ValueError(f"question types must be in this order: {expected}")
        return self


class LearningPathRecommendation(ContractModel):
    content_item_id: UUID
    rank: Annotated[int, Field(ge=1)]
    reason: NonEmptyText
    learning_role: NonEmptyText


class WatchLaterRecommendation(ContractModel):
    content_item_id: UUID
    reason: NonEmptyText


class LearningPathResult(ContractModel):
    """Learning-path output from PromptTemplates section 5.4."""

    guidance: NonEmptyText
    recommended_order: Annotated[
        list[LearningPathRecommendation], Field(min_length=3, max_length=7)
    ]
    watch_later: list[WatchLaterRecommendation]
    next_steps: Annotated[list[NonEmptyText], Field(min_length=1)]

    @model_validator(mode="after")
    def validate_recommendations(self) -> LearningPathResult:
        ranks = [item.rank for item in self.recommended_order]
        if ranks != list(range(1, len(ranks) + 1)):
            raise ValueError("recommended_order ranks must be contiguous and start at 1")

        recommended_ids = [item.content_item_id for item in self.recommended_order]
        watch_later_ids = [item.content_item_id for item in self.watch_later]
        all_ids = recommended_ids + watch_later_ids
        if len(all_ids) != len(set(all_ids)):
            raise ValueError("content_item_id must not be recommended more than once")
        return self


class ContentAnalysis(ContractModel):
    """Validated data handed between the LLM and persistence pipeline stages."""

    classification: ClassificationResult
    summary: SummaryResult
    quiz: QuizResult
