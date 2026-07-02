"""Google Gemini generateContent adapter."""

from __future__ import annotations

from typing import Any
from urllib.parse import quote

from .base import GenerationResult, HTTPClient, UrllibHTTPClient, checked_body


class GeminiProvider:
    name = "gemini"

    def __init__(
        self,
        api_key: str,
        *,
        client: HTTPClient | None = None,
        base_url: str = "https://generativelanguage.googleapis.com/v1beta",
    ) -> None:
        self.api_key = api_key
        self.client = client or UrllibHTTPClient()
        self.base_url = base_url.rstrip("/")

    def _url(self, path: str) -> str:
        return f"{self.base_url}/{path}?key={quote(self.api_key)}"

    def validate_key(self) -> bool:
        try:
            self.list_models()
        except Exception:
            return False
        return True

    def list_models(self) -> list[str]:
        body = checked_body(self.client.request("GET", self._url("models")))
        return [
            item["name"].removeprefix("models/")
            for item in body.get("models", [])
            if item.get("name")
        ]

    def generate_json(
        self,
        *,
        model: str,
        prompt: str,
        schema: dict[str, Any] | None = None,
        temperature: float = 0.0,
    ) -> GenerationResult:
        config: dict[str, Any] = {
            "temperature": temperature,
            "responseMimeType": "application/json",
        }
        if schema is not None:
            config["responseJsonSchema"] = schema
        body = checked_body(
            self.client.request(
                "POST",
                self._url(f"models/{quote(model)}:generateContent"),
                json_body={
                    "contents": [{"role": "user", "parts": [{"text": prompt}]}],
                    "generationConfig": config,
                },
            )
        )
        usage = body.get("usageMetadata", {})
        text = body["candidates"][0]["content"]["parts"][0]["text"]
        return GenerationResult(
            text=text,
            provider=self.name,
            model=model,
            prompt_tokens=int(usage.get("promptTokenCount", 0)),
            completion_tokens=int(usage.get("candidatesTokenCount", 0)),
        )
