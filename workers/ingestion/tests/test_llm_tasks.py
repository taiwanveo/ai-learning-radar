from __future__ import annotations

from uuid import UUID

import pytest

from ai_learning_radar_worker.llm.prompts import (
    CLASSIFIER_PROMPT_VERSION,
    LEARNING_PATH_PROMPT_VERSION,
    QUIZ_PROMPT_VERSION,
    REPAIR_PROMPT_VERSION,
    SUMMARY_PROMPT_VERSION,
)
from ai_learning_radar_worker.llm.providers import MockProvider
from ai_learning_radar_worker.llm.tasks import LLMTaskError, LLMTaskRunner


def classification_payload():
    return {
        "is_tutorial": True,
        "tutorial_confidence": 0.9,
        "content_type": "tutorial",
        "difficulty": "beginner",
        "difficulty_confidence": 0.8,
        "topic_relevance_score": 0.95,
        "tutorial_quality_score": 0.85,
        "reason": "有明確步驟與範例",
        "difficulty_reason": "從基本名詞開始",
        "signals": ["逐步操作"],
    }


def summary_payload():
    return {
        "suitable_for": "適合剛接觸生成式 AI 的企業學員。",
        "short_summary": "短" * 100,
        "full_summary": "完整" * 250,
        "transcript_summary": "逐字" * 150,
        "learning_objectives": ["理解概念", "完成操作", "辨識限制"],
        "key_concepts": ["LLM", "RAG", "Prompt Engineering"],
        "limitations_or_cautions": "",
    }


def quiz_payload():
    kinds = ["comprehension", "application", "concept"]
    return {
        "questions": [
            {
                "question_type": kind,
                "question_text": f"第 {index} 題",
                "options": {"A": "甲", "B": "乙", "C": "丙", "D": "丁"},
                "correct_option_key": "A",
                "explanation": "影片說明甲為正確做法。",
                "evidence_text": "先建立基本概念",
            }
            for index, kind in enumerate(kinds, 1)
        ]
    }


def learning_path_payload():
    ids = [
        "11111111-1111-4111-8111-111111111111",
        "22222222-2222-4222-8222-222222222222",
        "33333333-3333-4333-8333-333333333333",
    ]
    return {
        "guidance": "先建立概念，再進行實作。",
        "recommended_order": [
            {
                "content_item_id": item_id,
                "rank": rank,
                "reason": "由淺入深",
                "learning_role": "建立觀念",
            }
            for rank, item_id in enumerate(ids, 1)
        ],
        "watch_later": [],
        "next_steps": ["完成小型練習"],
    }


def runner_with(payload):
    return LLMTaskRunner(MockProvider([payload]), model="mock-model")


def test_classify_validates_and_records_prompt_version() -> None:
    provider = MockProvider([classification_payload()])
    result = LLMTaskRunner(provider, model="mock-model").classify(
        title="RAG 入門",
        description="示範流程",
        channel_title="教學頻道",
        duration_minutes=20,
        published_at="2026-07-02",
        topic_name="人工智慧",
        topic_keywords=["RAG"],
        rule_signals={"has_steps": True},
        transcript_excerpt="先介紹 RAG，再逐步操作。",
    )
    assert result.value.is_tutorial
    assert result.prompt_version == CLASSIFIER_PROMPT_VERSION
    assert "RAG 入門" in provider.calls[0]["prompt"]


def test_summarize_validates_output() -> None:
    result = runner_with(summary_payload()).summarize(
        title="RAG",
        description="",
        channel_title="頻道",
        topic_name="AI",
        difficulty="beginner",
        transcript_text="逐字稿",
    )
    assert result.prompt_version == SUMMARY_PROMPT_VERSION
    assert len(result.value.learning_objectives) == 3


def test_quiz_validates_question_order() -> None:
    result = runner_with(quiz_payload()).quiz(
        title="RAG",
        short_summary="摘要",
        learning_objectives=["理解 RAG"],
        transcript_text="先建立基本概念",
    )
    assert result.prompt_version == QUIZ_PROMPT_VERSION
    assert result.value.questions[1].question_type == "application"


def test_learning_path_validates_uuid_and_rank() -> None:
    result = runner_with(learning_path_payload()).learning_path(
        query="RAG", search_results=[{"id": "result"}] * 30
    )
    assert result.prompt_version == LEARNING_PATH_PROMPT_VERSION
    assert isinstance(result.value.recommended_order[0].content_item_id, UUID)
    assert len(result.value.recommended_order) == 3


def test_invalid_output_is_repaired_exactly_once() -> None:
    provider = MockProvider(["not json", classification_payload()])
    result = LLMTaskRunner(provider, model="mock-model").classify(
        title="RAG",
        description="",
        channel_title="頻道",
        duration_minutes=10,
        published_at="2026-07-02",
        topic_name="AI",
        topic_keywords=["RAG"],
        rule_signals={},
        transcript_excerpt="教學",
    )
    assert result.repaired
    assert result.repair_prompt_version == REPAIR_PROMPT_VERSION
    assert len(provider.calls) == 2
    assert "not json" in provider.calls[1]["prompt"]


def test_second_invalid_output_raises_without_third_call() -> None:
    provider = MockProvider(["bad", "still bad", classification_payload()])
    runner = LLMTaskRunner(provider, model="mock-model")
    with pytest.raises(LLMTaskError):
        runner.classify(
            title="RAG",
            description="",
            channel_title="頻道",
            duration_minutes=10,
            published_at="2026-07-02",
            topic_name="AI",
            topic_keywords=["RAG"],
            rule_signals={},
            transcript_excerpt="教學",
        )
    assert len(provider.calls) == 2
