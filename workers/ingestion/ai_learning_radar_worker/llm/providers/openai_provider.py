"""OpenAI structured-output adapter."""

from __future__ import annotations

from typing import Any

from .base import GenerationResult, HTTPClient, UrllibHTTPClient, checked_body


class OpenAIProvider:
    name = "openai"

    def __init__(
        self,
        api_key: str,
        *,
        client: HTTPClient | None = None,
        base_url: str = "https://api.openai.com/v1",
    ) -> None:
        self.api_key = api_key
        self.client = client or UrllibHTTPClient()
        self.base_url = base_url.rstrip("/")

    @property
    def _headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.api_key}"}

    def validate_key(self) -> bool:
        try:
            self.list_models()
        except Exception:  # Provider validation is intentionally a boolean boundary.
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
        response_format: dict[str, Any] = {"type": "json_object"}
        if schema is not None:
            response_format = {
                "type": "json_schema",
                "json_schema": {"name": "response", "strict": True, "schema": schema},
            }
        body = checked_body(
            self.client.request(
                "POST",
                f"{self.base_url}/chat/completions",
                headers=self._headers,
                json_body={
                    "model": model,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": temperature,
                    "response_format": response_format,
                },
            )
        )
        usage = body.get("usage", {})
        text = body["choices"][0]["message"]["content"]
        return GenerationResult(
            text=text,
            provider=self.name,
            model=model,
            prompt_tokens=int(usage.get("prompt_tokens", 0)),
            completion_tokens=int(usage.get("completion_tokens", 0)),
        )
