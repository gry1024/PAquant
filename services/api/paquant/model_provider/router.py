from __future__ import annotations

from paquant.model_provider.base import (
    ModelProvider,
    ModelProviderError,
    ModelRequest,
    ModelResponse,
)
from paquant.model_provider.openai_compatible import redact_secrets


class FallbackModelProvider:
    def __init__(
        self,
        *,
        providers: list[ModelProvider],
        known_secrets: list[str] | None = None,
    ) -> None:
        if not providers:
            raise ValueError("at least one model provider is required")
        self.providers = providers
        self.known_secrets = known_secrets or []
        self.failures: list[str] = []

    def generate(self, request: ModelRequest) -> ModelResponse:
        self.failures = []
        for provider in self.providers:
            try:
                return provider.generate(request)
            except Exception as exc:
                self.failures.append(redact_secrets(str(exc), self.known_secrets))
        raise ModelProviderError(
            "all model providers failed: " + " | ".join(self.failures)
        )
