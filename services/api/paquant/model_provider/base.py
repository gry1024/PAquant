from __future__ import annotations

from typing import Any, Protocol

from pydantic import BaseModel, ConfigDict, Field


class ModelRequest(BaseModel):
    model_config = ConfigDict(frozen=True)

    prompt: str
    schema_name: str
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


class ModelProvider(Protocol):
    def generate(self, request: ModelRequest) -> ModelResponse:
        """Generate a response for a typed model request."""
