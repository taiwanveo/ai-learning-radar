"""Deterministic, quota-bounded expansion of topic keywords."""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from enum import StrEnum
from typing import Any


class KeywordType(StrEnum):
    POSITIVE = "positive"
    NEGATIVE = "negative"
    SYNONYM = "synonym"
    TW_TERM = "tw_term"
    CN_TERM = "cn_term"
    ENGLISH = "english"


@dataclass(frozen=True, slots=True)
class TopicKeyword:
    keyword: str
    keyword_type: KeywordType | str
    weight: float = 1.0
    is_active: bool = True


def expand_queries(
    keywords: Iterable[TopicKeyword | Mapping[str, Any] | Any], *, max_queries: int = 12
) -> list[str]:
    """Expand every active positive keyword type and append active exclusions.

    Inputs may be dataclasses, mappings, or ORM-like objects. Higher weights are
    emitted first so a low query cap still preserves administrator priorities.
    """
    if max_queries < 1:
        raise ValueError("max_queries must be at least 1")
    parsed = [_coerce_keyword(item, index) for index, item in enumerate(keywords)]
    active = [item for item in parsed if item[0].is_active and item[0].keyword.strip()]
    negatives = [item[0].keyword.strip() for item in active if item[0].keyword_type == "negative"]
    suffixes = {
        "positive": "中文 入門 教學",
        "synonym": "中文 入門 教學",
        "tw_term": "入門 教學",
        "cn_term": "入门 教程",
        "english": "中文 入門 教學",
    }
    roots = [item for item in active if str(item[0].keyword_type) in suffixes]
    roots.sort(key=lambda item: (-item[0].weight, item[1]))
    exclusions = " ".join(f'-"{term}"' if " " in term else f"-{term}" for term in negatives)

    output: list[str] = []
    seen: set[str] = set()
    for keyword, _index in roots:
        kind = str(keyword.keyword_type)
        query = f"{keyword.keyword.strip()} {suffixes[kind]}"
        if exclusions:
            query = f"{query} {exclusions}"
        canonical = " ".join(query.split()).casefold()
        if canonical in seen:
            continue
        seen.add(canonical)
        output.append(" ".join(query.split()))
        if len(output) == max_queries:
            break
    return output


def _coerce_keyword(
    value: TopicKeyword | Mapping[str, Any] | Any, index: int
) -> tuple[TopicKeyword, int]:
    if isinstance(value, TopicKeyword):
        keyword = value
    elif isinstance(value, Mapping):
        keyword = TopicKeyword(
            keyword=str(value.get("keyword", "")),
            keyword_type=value.get("keyword_type", "positive"),
            weight=float(value.get("weight", 1.0)),
            is_active=bool(value.get("is_active", True)),
        )
    else:
        keyword = TopicKeyword(
            keyword=str(getattr(value, "keyword", "")),
            keyword_type=getattr(value, "keyword_type", "positive"),
            weight=float(getattr(value, "weight", 1.0)),
            is_active=bool(getattr(value, "is_active", True)),
        )
    try:
        kind = KeywordType(str(keyword.keyword_type))
    except ValueError as exc:
        raise ValueError(f"unsupported keyword type: {keyword.keyword_type}") from exc
    return TopicKeyword(keyword.keyword, kind, keyword.weight, keyword.is_active), index
