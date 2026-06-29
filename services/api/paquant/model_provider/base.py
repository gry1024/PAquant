from __future__ import annotations

from typing import Any, Protocol

from pydantic import BaseModel, ConfigDict, Field


class ModelRequest(BaseModel):
    model_config = ConfigDict(frozen=True)

    prompt: str
    schema_name: str
    schema_version: str = "v1"
    metadata: dict[str, Any] = Field(default_factory=dict)


class ModelUsage(BaseModel):
    model_config = ConfigDict(frozen=True)

    provider: str
    model: str
    input_tokens: int
    output_tokens: int
    estimated_cost_usd: float


class ModelResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    text: str
    structured: dict[str, Any]
    usage: ModelUsage


class ModelCapability(BaseModel):
    model_config = ConfigDict(frozen=True)

    text: bool = True
    vision: bool = False
    structured_output: bool = True
    tool_calling: bool = False
    context_window: int = 16_000


class ProviderConfig(BaseModel):
    model_config = ConfigDict(frozen=True)

    provider: str
    model: str
    base_url: str
    api_key_env: str
    capabilities: ModelCapability = Field(default_factory=ModelCapability)
    input_cost_per_million: float = Field(ge=0)
    output_cost_per_million: float = Field(ge=0)
    timeout_seconds: float = Field(default=30, gt=0)


class ModelProviderError(RuntimeError):
    """Raised when a model provider fails with a sanitized message."""


class ModelProvider(Protocol):
    def generate(self, request: ModelRequest) -> ModelResponse:
        """Generate a response for a typed model request."""
