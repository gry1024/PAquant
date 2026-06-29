from paquant.model_provider.base import ModelRequest
from paquant.model_provider.mock import MockModelProvider


def test_mock_provider_returns_usage_without_secret_logging():
    provider = MockModelProvider()

    response = provider.generate(ModelRequest(prompt="Analyze XAU", schema_name="TraderDecision"))

    assert response.usage.provider == "mock"
    assert response.usage.estimated_cost_usd == 0
    assert "api" not in response.text.lower()
