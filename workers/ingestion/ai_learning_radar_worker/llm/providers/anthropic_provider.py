"""Anthropic Messages API adapter."""

from __future__ import annotations

import json
from typing import Any

from .base import GenerationResult, HTTPClient, UrllibHTTPClient, checked_body


class AnthropicProvider:
    name = "anthropic"

    def __init__(
        self,
        api_key: str,
        *,
        client: HTTPClient | None = None,
        base_url: str = "https://api.anthropic.com/v1",
    ) -> None:
        self.api_key = api_key
        self.client = client or UrllibHTTPClient()
        self.base_url = base_url.rstrip("/")

    @property
    def _headers(self) -> dict[str, str]:
        return {"x-api-key": self.api_key, "anthropic-version": "2023-06-01"}

    def validate_key(self) -> bool:
        try:
            self.list_models()
        except Exception:
            return False
        return True

    def list_models(self) -> list[str]:
        body = checked_body(
            self.client.request("GET", f"{self.base_url}/models", headers=self._headers)
        )
        return [
            item["id"] for item in body.get("data", []) if isinstance(item, dict) and item.get("id")
        ]

    def generate_json(
        self,
        *,
        model: str,
        prompt: str,
        schema: dict[str, Any] | None = None,
        temperature: float = 0.0,
    ) -> GenerationResult:
        instruction = prompt
        if schema is not None:
            instruction += "\nJSON Schema:\n" + json.dumps(schema, ensure_ascii=False)
        body = checked_body(
            self.client.request(
                "POST",
                f"{self.base_url}/messages",
                headers=self._headers,
                json_body={
                    "model": model,
                    "max_tokens": 4096,
                    "temperature": temperature,
                    "messages": [{"role": "user", "content": instruction}],
                },
            )
        )
        usage = body.get("usage", {})
        text = next(block["text"] for block in body["content"] if block.get("type") == "text")
        return GenerationResult(
            text=text,
            provider=self.name,
            model=model,
            prompt_tokens=int(usage.get("input_tokens", 0)),
            completion_tokens=int(usage.get("output_tokens", 0)),
        )
