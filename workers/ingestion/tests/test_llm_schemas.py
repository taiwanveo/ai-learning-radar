from __future__ import annotations

from copy import deepcopy

import pytest
from pydantic import ValidationError

from ai_learning_radar_worker.llm.schemas import (
    ClassificationResult,
    ContentAnalysis,
    LearningPathResult,
    QuizResult,
    SummaryResult,
)


def classification_data() -> dict[str, object]:
    return {
        "is_tutorial": True,
        "tutorial_confidence": 0.92,
        "content_type": "tutorial",
        "difficulty": "beginner",
        "difficulty_confidence": 0.8,
        "topic_relevance_score": 0.95,
        "tutorial_quality_score": 0.85,
        "reason": "影片以步驟與範例解釋核心概念。",
        "difficulty_reason": "不要求程式或數學基礎。",
        "signals": ["解釋名詞", "包含操作範例"],
    }


def summary_data() -> dict[str, object]:
    return {
        "suitable_for": "適合剛開始接觸生成式 AI 的學員。",
        "short_summary": "短" * 100,
        "full_summary": "完" * 500,
        "transcript_summary": "逐" * 300,
        "learning_objectives": ["理解 LLM", "辨識提示詞結構", "完成基礎練習"],
        "key_concepts": ["LLM", "Prompt Engineering", "RAG"],
        "limitations_or_cautions": "",
    }


def quiz_data() -> dict[str, object]:
    def question(question_type: str, answer: str) -> dict[str, object]:
        return {
            "question_type": question_type,
            "question_text": "影片所說的正確做法為何？",
            "options": {"A": "做法甲", "B": "做法乙", "C": "做法丙", "D": "做法丁"},
            "correct_option_key": answer,
            "explanation": "影片以範例說明這個做法。",
            "evidence_text": "先建立清楚的目標，再逐步調整提示詞。",
        }

    return {
        "questions": [
            question("comprehension", "A"),
            question("application", "B"),
            question("concept", "C"),
        ]
    }


def learning_path_data() -> dict[str, object]:
    ids = [f"00000000-0000-4000-8000-{index:012d}" for index in range(1, 5)]
    return {
        "guidance": "先建立基本概念，再進行工具操作。完成後可嘗試小型專案。",
        "recommended_order": [
            {
                "content_item_id": content_id,
                "rank": rank,
                "reason": "依賴較少，適合先學。",
                "learning_role": "建立基本觀念",
            }
            for rank, content_id in enumerate(ids[:3], start=1)
        ],
        "watch_later": [{"content_item_id": ids[3], "reason": "需要先備知識。"}],
        "next_steps": ["以範例建立一個小型專案"],
    }


def test_all_prompt_contracts_and_pipeline_model_validate() -> None:
    classification = ClassificationResult.model_validate(classification_data())
    summary = SummaryResult.model_validate(summary_data())
    quiz = QuizResult.model_validate(quiz_data())
    path = LearningPathResult.model_validate(learning_path_data())

    analysis = ContentAnalysis(classification=classification, summary=summary, quiz=quiz)

    assert analysis.classification.content_type == "tutorial"
    assert analysis.quiz.questions[1].question_type == "application"
    assert path.recommended_order[2].rank == 3


@pytest.mark.parametrize(
    ("model", "data"),
    [
        (ClassificationResult, {**classification_data(), "tutorial_confidence": 1.1}),
        (SummaryResult, {**summary_data(), "short_summary": "太短"}),
        (QuizResult, {"questions": quiz_data()["questions"][:2]}),
        (
            LearningPathResult,
            {
                **learning_path_data(),
                "recommended_order": learning_path_data()["recommended_order"][:2],
            },
        ),
    ],
)
def test_invalid_contract_values_are_rejected(model: object, data: dict[str, object]) -> None:
    with pytest.raises(ValidationError):
        model.model_validate(data)  # type: ignore[attr-defined]


def test_quiz_rejects_missing_option_and_wrong_question_order() -> None:
    missing_option = deepcopy(quiz_data())
    del missing_option["questions"][0]["options"]["D"]  # type: ignore[index]
    with pytest.raises(ValidationError):
        QuizResult.model_validate(missing_option)

    wrong_order = deepcopy(quiz_data())
    wrong_order["questions"][0], wrong_order["questions"][1] = (  # type: ignore[index]
        wrong_order["questions"][1],
        wrong_order["questions"][0],
    )
    with pytest.raises(ValidationError, match="question types must be in this order"):
        QuizResult.model_validate(wrong_order)


def test_learning_path_rejects_duplicate_content_and_noncontiguous_ranks() -> None:
    duplicate = deepcopy(learning_path_data())
    duplicate["watch_later"][0]["content_item_id"] = duplicate["recommended_order"][0][  # type: ignore[index]
        "content_item_id"
    ]
    with pytest.raises(ValidationError, match="must not be recommended more than once"):
        LearningPathResult.model_validate(duplicate)

    invalid_ranks = deepcopy(learning_path_data())
    invalid_ranks["recommended_order"][1]["rank"] = 3  # type: ignore[index]
    with pytest.raises(ValidationError, match="ranks must be contiguous"):
        LearningPathResult.model_validate(invalid_ranks)


def test_contracts_reject_unknown_fields() -> None:
    data = classification_data()
    data["unexpected"] = "prompt drift"

    with pytest.raises(ValidationError, match="Extra inputs are not permitted"):
        ClassificationResult.model_validate(data)
