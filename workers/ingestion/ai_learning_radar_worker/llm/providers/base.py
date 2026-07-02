"""Provider-neutral structured generation contracts."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any, Protocol
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


class ProviderError(RuntimeError):
    """An LLM provider request failed or returned an unusable response."""


@dataclass(frozen=True)
class GenerationResult:
    """Raw structured response plus portable usage information."""

    text: str
    provider: str
    model: str
    prompt_tokens: int = 0
    completion_tokens: int = 0
    estimated_cost_usd: float | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

    def json(self) -> Any:
        return json.loads(self.text)


@dataclass(frozen=True)
class HTTPResponse:
    status_code: int
    body: Any


class HTTPClient(Protocol):
    def request(
        self,
        method: str,
        url: str,
        *,
        headers: dict[str, str] | None = None,
        json_body: dict[str, Any] | None = None,
    ) -> HTTPResponse: ...


class UrllibHTTPClient:
    """Small production HTTP client, avoiding a mandatory SDK dependency."""

    def __init__(self, timeout: float = 30.0) -> None:
        self.timeout = timeout

    def request(
        self,
        method: str,
        url: str,
        *,
        headers: dict[str, str] | None = None,
        json_body: dict[str, Any] | None = None,
    ) -> HTTPResponse:
        payload = json.dumps(json_body).encode() if json_body is not None else None
        request_headers = {"Accept": "application/json", **(headers or {})}
        if payload is not None:
            request_headers["Content-Type"] = "application/json"
        request = Request(url, data=payload, headers=request_headers, method=method)
        try:
            with urlopen(request, timeout=self.timeout) as response:  # noqa: S310
                body = json.loads(response.read().decode("utf-8"))
                return HTTPResponse(response.status, body)
        except HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise ProviderError(f"HTTP {exc.code}: {detail}") from exc
        except (URLError, TimeoutError, json.JSONDecodeError) as exc:
            raise ProviderError(f"provider request failed: {exc}") from exc


class LLMProvider(Protocol):
    name: str

    def validate_key(self) -> bool: ...

    def list_models(self) -> list[str]: ...

    def generate_json(
        self,
        *,
        model: str,
        prompt: str,
        schema: dict[str, Any] | None = None,
        temperature: float = 0.0,
    ) -> GenerationResult: ...


def checked_body(response: HTTPResponse) -> dict[str, Any]:
    if not 200 <= response.status_code < 300:
        raise ProviderError(f"HTTP {response.status_code}: {response.body}")
    if not isinstance(response.body, dict):
        raise ProviderError("provider returned a non-object response")
    return response.body
