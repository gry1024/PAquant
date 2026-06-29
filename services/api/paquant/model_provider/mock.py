from __future__ import annotations

from paquant.model_provider.base import ModelRequest, ModelResponse, ModelToolCall, ModelUsage


class MockModelProvider:
    provider = "mock"
    model = "mock-brooks"

    def generate(self, request: ModelRequest) -> ModelResponse:
        input_tokens = max(1, len(request.prompt.split()))
        structured = {
            "schema": request.schema_name,
            "summary": "Structured Brooks decision based on context, levels, and risk.",
        }
        tool_calls = [
            ModelToolCall(
                id=f"mock-tool-call-{index}",
                name=str(command["tool"]),
                arguments=dict(command.get("arguments", {})),
            )
            for index, command in enumerate(
                request.metadata.get("tool_commands", []),
                start=1,
            )
        ]
        return ModelResponse(
            text="Structured Brooks decision based on context, levels, and risk.",
            structured=structured,
            tool_calls=tool_calls,
            usage=ModelUsage(
                provider=self.provider,
                model=self.model,
                input_tokens=input_tokens,
                output_tokens=12,
                estimated_cost_usd=0,
            ),
        )
