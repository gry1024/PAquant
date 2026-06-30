import pytest
from paquant.model_provider.base import ModelProviderError, ModelRequest, ProviderConfig
from paquant.model_provider.openai_compatible import OpenAICompatibleProvider, redact_secrets
from paquant.model_provider.registry import build_default_provider_registry


class FakeTransport:
    def __init__(self) -> None:
        self.calls: list[dict] = []

    def post_json(
        self,
        *,
        url: str,
        headers: dict[str, str],
        payload: dict,
        timeout: float,
    ) -> dict:
        self.calls.append(
            {"url": url, "headers": headers, "payload": payload, "timeout": timeout}
        )
        return {
            "choices": [
                {
                    "message": {
                        "content": '{"bias":"long","confidence":0.72}',
                    }
                }
            ],
            "usage": {"prompt_tokens": 120, "completion_tokens": 40},
        }


def test_openai_compatible_provider_builds_payload_and_usage(monkeypatch):
    config = build_default_provider_registry()["deepseek"]
    transport = FakeTransport()
    monkeypatch.setenv(config.api_key_env, "redact-me-value")
    provider = OpenAICompatibleProvider(config=config, transport=transport)

    response = provider.generate(
        ModelRequest(
            prompt="Analyze XAU",
            schema_name="TraderDecision",
            schema_version="trader-decision.v2",
        )
    )

    call = transport.calls[0]
    assert call["url"] == "https://api.deepseek.com/v1/chat/completions"
    assert call["headers"]["Authorization"] == "Bearer redact-me-value"
    assert call["payload"]["model"] == config.model
    assert "trader-decision.v2" in call["payload"]["messages"][0]["content"]
    assert response.structured == {"bias": "long", "confidence": 0.72}
    assert response.usage.input_tokens == 120
    assert response.usage.output_tokens == 40
    assert response.usage.estimated_cost_usd > 0


def test_openai_compatible_provider_honors_tool_choice_metadata(monkeypatch):
    config = build_default_provider_registry()["deepseek"]
    transport = FakeTransport()
    monkeypatch.setenv(config.api_key_env, "redact-me-value")
    provider = OpenAICompatibleProvider(config=config, transport=transport)

    provider.generate(
        ModelRequest(
            prompt="Draw a trend line",
            schema_name="TraderDecision",
            tools=[
                {
                    "type": "function",
                    "function": {
                        "name": "draw_trendline",
                        "parameters": {"type": "object", "properties": {}},
                    },
                }
            ],
            metadata={
                "tool_choice": {
                    "type": "function",
                    "function": {"name": "draw_trendline"},
                }
            },
        )
    )

    assert transport.calls[0]["payload"]["tool_choice"] == {
        "type": "function",
        "function": {"name": "draw_trendline"},
    }


def test_redaction_removes_credentials_from_errors(monkeypatch):
    config = ProviderConfig(
        provider="test",
        model="test-model",
        base_url="https://example.test/v1",
        api_key_env="TEST_MODEL_KEY",
        input_cost_per_million=1,
        output_cost_per_million=1,
    )
    monkeypatch.setenv("TEST_MODEL_KEY", "visible-redact-value")

    assert redact_secrets("failed with visible-redact-value", ["visible-redact-value"]) == (
        "failed with [REDACTED]"
    )

    class FailingTransport:
        def post_json(
            self, *, url: str, headers: dict[str, str], payload: dict, timeout: float
        ) -> dict:
            raise RuntimeError(f"bad key {headers['Authorization']}")

    provider = OpenAICompatibleProvider(config=config, transport=FailingTransport())

    with pytest.raises(ModelProviderError) as exc_info:
        provider.generate(ModelRequest(prompt="Analyze", schema_name="TraderDecision"))

    assert "visible-redact-value" not in str(exc_info.value)
    assert "[REDACTED]" in str(exc_info.value)
