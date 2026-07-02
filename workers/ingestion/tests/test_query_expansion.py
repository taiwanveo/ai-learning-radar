import pytest

from ai_learning_radar_worker.sources.query_expansion import TopicKeyword, expand_queries

AI_KEYWORDS = [
    TopicKeyword("人工智慧", "positive", weight=10),
    TopicKeyword("人工智能", "cn_term", weight=9),
    TopicKeyword("AI", "english", weight=8),
    TopicKeyword("生成式 AI", "tw_term", weight=7),
    TopicKeyword("Generative AI", "synonym", weight=6),
    TopicKeyword("投資", "negative"),
]


def test_expands_all_keyword_types_in_weight_order_with_exclusions():
    queries = expand_queries(AI_KEYWORDS)

    assert queries == [
        "人工智慧 中文 入門 教學 -投資",
        "人工智能 入门 教程 -投資",
        "AI 中文 入門 教學 -投資",
        "生成式 AI 入門 教學 -投資",
        "Generative AI 中文 入門 教學 -投資",
    ]


def test_cap_deduplication_and_inactive_keywords():
    keywords = [
        {"keyword": "LLM", "keyword_type": "english", "weight": 5},
        {"keyword": "llm", "keyword_type": "english", "weight": 4},
        {"keyword": "大型語言模型", "keyword_type": "tw_term", "weight": 3},
        {"keyword": "停用", "keyword_type": "positive", "is_active": False},
    ]
    assert expand_queries(keywords, max_queries=2) == [
        "LLM 中文 入門 教學",
        "大型語言模型 入門 教學",
    ]


def test_invalid_type_and_cap_fail_early():
    with pytest.raises(ValueError, match="unsupported keyword type"):
        expand_queries([TopicKeyword("AI", "mystery")])
    with pytest.raises(ValueError, match="max_queries"):
        expand_queries([], max_queries=0)
