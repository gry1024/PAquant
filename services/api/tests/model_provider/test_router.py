import pytest
from paquant.model_provider.base import ModelProviderError, ModelRequest, ModelResponse, ModelUsage
from paquant.model_provider.router import FallbackModelProvider


class FailingProvider:
    def generate(self, request: ModelRequest) -> ModelResponse:
        raise ModelProviderError("provider failed with hidden-redact-value")


class PassingProvider:
    def generate(self, request: ModelRequest) -> ModelResponse:
        return ModelResponse(
            text="ok",
            structured={"schema": request.schema_name},
            usage=ModelUsage(
                provider="backup",
                model="backup-model",
                input_tokens=10,
                output_tokens=5,
                estimated_cost_usd=0.001,
            ),
        )


def test_fallback_provider_uses_backup_and_records_sanitized_failure():
    router = FallbackModelProvider(
        providers=[FailingProvider(), PassingProvider()],
        known_secrets=["hidden-redact-value"],
    )

    response = router.generate(ModelRequest(prompt="Analyze", schema_name="TraderDecision"))

    assert response.usage.provider == "backup"
    assert router.failures == ["provider failed with [REDACTED]"]


def test_fallback_provider_raises_sanitized_error_when_all_fail():
    router = FallbackModelProvider(
        providers=[FailingProvider()],
        known_secrets=["hidden-redact-value"],
    )

    with pytest.raises(ModelProviderError) as exc_info:
        router.generate(ModelRequest(prompt="Analyze", schema_name="TraderDecision"))

    assert "hidden-redact-value" not in str(exc_info.value)
    assert "[REDACTED]" in str(exc_info.value)
