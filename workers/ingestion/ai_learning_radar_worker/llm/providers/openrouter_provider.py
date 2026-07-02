"""OpenRouter's OpenAI-compatible adapter."""

from __future__ import annotations

from .base import HTTPClient
from .openai_provider import OpenAIProvider


class OpenRouterProvider(OpenAIProvider):
    name = "openrouter"

    def __init__(
        self,
        api_key: str,
        *,
        client: HTTPClient | None = None,
        base_url: str = "https://openrouter.ai/api/v1",
        site_url: str | None = None,
        app_name: str | None = None,
    ) -> None:
        super().__init__(api_key, client=client, base_url=base_url)
        self.site_url = site_url
        self.app_name = app_name

    @property
    def _headers(self) -> dict[str, str]:
        headers = super()._headers
        if self.site_url:
            headers["HTTP-Referer"] = self.site_url
        if self.app_name:
            headers["X-Title"] = self.app_name
        return headers
