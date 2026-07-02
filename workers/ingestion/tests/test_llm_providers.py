from __future__ import annotations

from collections import deque

from ai_learning_radar_worker.llm.providers import (
    AnthropicProvider,
    FallbackProvider,
    GeminiProvider,
    HTTPResponse,
    InMemoryUsageLogger,
    MockProvider,
    OpenAIProvider,
    OpenRouterProvider,
    ProviderTarget,
    TokenPricing,
)


class FakeHTTPClient:
    def __init__(self, responses: list[HTTPResponse]) -> None:
        self.responses = deque(responses)
        self.calls: list[tuple[str, str, dict]] = []

    def request(self, method, url, **kwargs):
        self.calls.append((method, url, kwargs))
        return self.responses.popleft()


def test_openai_adapter_lists_models_and_generates_json() -> None:
    client = FakeHTTPClient(
        [
            HTTPResponse(200, {"data": [{"id": "gpt-test"}]}),
            HTTPResponse(
                200,
                {
                    "choices": [{"message": {"content": '{"ok":true}'}}],
                    "usage": {"prompt_tokens": 10, "completion_tokens": 2},
                },
            ),
        ]
    )
    provider = OpenAIProvider("secret", client=client)
    assert provider.list_models() == ["gpt-test"]
    result = provider.generate_json(
        model="gpt-test", prompt="return json", schema={"type": "object"}
    )
    assert result.json() == {"ok": True}
    assert result.prompt_tokens == 10
    assert client.calls[1][2]["json_body"]["response_format"]["type"] == "json_schema"


def test_openrouter_uses_compatible_endpoint_and_attribution_headers() -> None:
    client = FakeHTTPClient([HTTPResponse(200, {"data": []})])
    provider = OpenRouterProvider(
        "secret", client=client, site_url="https://radar.example", app_name="Radar"
    )
    assert provider.validate_key()
    headers = client.calls[0][2]["headers"]
    assert headers["HTTP-Referer"] == "https://radar.example"
    assert headers["X-Title"] == "Radar"


def test_anthropic_adapter_extracts_text_and_usage() -> None:
    client = FakeHTTPClient(
        [
            HTTPResponse(200, {"data": [{"id": "claude-test"}]}),
            HTTPResponse(
                200,
                {
                    "content": [{"type": "text", "text": '{"ok":true}'}],
                    "usage": {"input_tokens": 4, "output_tokens": 3},
                },
            ),
        ]
    )
    provider = AnthropicProvider("secret", client=client)
    assert provider.list_models() == ["claude-test"]
    result = provider.generate_json(
        model="claude-test", prompt="return json", schema={"type": "object"}
    )
    assert result.completion_tokens == 3
    assert "JSON Schema" in client.calls[1][2]["json_body"]["messages"][0]["content"]


def test_gemini_adapter_uses_response_schema() -> None:
    client = FakeHTTPClient(
        [
            HTTPResponse(200, {"models": [{"name": "models/gemini-test"}]}),
            HTTPResponse(
                200,
                {
                    "candidates": [{"content": {"parts": [{"text": '{"ok":true}'}]}}],
                    "usageMetadata": {
                        "promptTokenCount": 8,
                        "candidatesTokenCount": 1,
                    },
                },
            ),
        ]
    )
    provider = GeminiProvider("secret", client=client)
    assert provider.list_models() == ["gemini-test"]
    result = provider.generate_json(
        model="gemini-test", prompt="return json", schema={"type": "object"}
    )
    assert result.json() == {"ok": True}
    config = client.calls[1][2]["json_body"]["generationConfig"]
    assert config["responseJsonSchema"] == {"type": "object"}


def test_fallback_chain_logs_failures_tokens_and_estimated_cost() -> None:
    failing = MockProvider([])
    working = MockProvider([{"ok": True}])
    logger = InMemoryUsageLogger()
    chain = FallbackProvider(
        [ProviderTarget(failing, "bad"), ProviderTarget(working, "good")],
        usage_logger=logger,
        pricing={("mock", "good"): TokenPricing(1.0, 2.0)},
    )
    result = chain.generate_json(prompt="hello")
    assert result.json() == {"ok": True}
    assert [record.success for record in logger.records] == [False, True]
    assert logger.records[0].error is not None


def test_validate_key_returns_false_on_http_failure() -> None:
    client = FakeHTTPClient([HTTPResponse(401, {"error": "invalid"})])
    assert not OpenAIProvider("bad", client=client).validate_key()
