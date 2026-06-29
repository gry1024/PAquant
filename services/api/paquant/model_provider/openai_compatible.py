from __future__ import annotations

import json
import os
import urllib.request
from typing import Protocol

from paquant.model_provider.base import (
    ModelProviderError,
    ModelRequest,
    ModelResponse,
    ModelToolCall,
    ModelUsage,
    ProviderConfig,
)


class JsonTransport(Protocol):
    def post_json(
        self,
        *,
        url: str,
        headers: dict[str, str],
        payload: dict,
        timeout: float,
    ) -> dict: ...


class UrllibJsonTransport:
    def post_json(
        self,
        *,
        url: str,
        headers: dict[str, str],
        payload: dict,
        timeout: float,
    ) -> dict:
        data = json.dumps(payload).encode("utf-8")
        request = urllib.request.Request(
            url,
            data=data,
            headers=headers,
            method="POST",
        )
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))


class OpenAICompatibleProvider:
    def __init__(
        self,
        *,
        config: ProviderConfig,
        transport: JsonTransport | None = None,
    ) -> None:
        self.config = config
        self.transport = transport or UrllibJsonTransport()

    def generate(self, request: ModelRequest) -> ModelResponse:
        credential = os.environ.get(self.config.api_key_env)
        if not credential:
            raise ModelProviderError(
                f"missing model provider credential env {self.config.api_key_env}"
            )

        payload = {
            "model": self.config.model,
            "messages": [
                {
                    "role": "user",
                    "content": _versioned_prompt(request),
                }
            ],
            "temperature": 0.2,
        }
        if request.tools:
            payload["tools"] = request.tools
            payload["tool_choice"] = "auto"
        headers = {
            "Authorization": f"Bearer {credential}",
            "Content-Type": "application/json",
        }
        try:
            raw = self.transport.post_json(
                url=f"{self.config.base_url.rstrip('/')}/chat/completions",
                headers=headers,
                payload=payload,
                timeout=self.config.timeout_seconds,
            )
        except Exception as exc:
            raise ModelProviderError(
                redact_secrets(str(exc), [credential])
            ) from exc

        text = _extract_text(raw)
        input_tokens = int(raw.get("usage", {}).get("prompt_tokens", 0))
        output_tokens = int(raw.get("usage", {}).get("completion_tokens", 0))
        return ModelResponse(
            text=text,
            structured=_parse_structured(text),
            tool_calls=_extract_tool_calls(raw),
            usage=ModelUsage(
                provider=self.config.provider,
                model=self.config.model,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                estimated_cost_usd=_estimate_cost(
                    config=self.config,
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                ),
            ),
        )


def redact_secrets(text: str, secrets: list[str]) -> str:
    redacted = text
    for secret in secrets:
        if secret:
            redacted = redacted.replace(secret, "[REDACTED]")
    return redacted


def _versioned_prompt(request: ModelRequest) -> str:
    return (
        f"Output schema: {request.schema_name}\n"
        f"Schema version: {request.schema_version}\n\n"
        f"{request.prompt}"
    )


def _extract_text(raw: dict) -> str:
    choices = raw.get("choices") or []
    if not choices:
        raise ModelProviderError("model response missing choices")
    message = choices[0].get("message") or {}
    content = message.get("content")
    if content is None and message.get("tool_calls"):
        return ""
    if not isinstance(content, str):
        raise ModelProviderError("model response missing text content")
    return content


def _extract_tool_calls(raw: dict) -> list[ModelToolCall]:
    choices = raw.get("choices") or []
    if not choices:
        return []
    message = choices[0].get("message") or {}
    tool_calls = message.get("tool_calls") or []
    parsed: list[ModelToolCall] = []
    for index, call in enumerate(tool_calls, start=1):
        function = call.get("function") or {}
        raw_arguments = function.get("arguments") or "{}"
        try:
            arguments = json.loads(raw_arguments)
        except json.JSONDecodeError:
            arguments = {}
        if not isinstance(arguments, dict):
            arguments = {}
        name = function.get("name")
        if isinstance(name, str):
            parsed.append(
                ModelToolCall(
                    id=str(call.get("id") or f"tool-call-{index}"),
                    name=name,
                    arguments=arguments,
                )
            )
    return parsed


def _parse_structured(text: str) -> dict:
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _estimate_cost(
    *,
    config: ProviderConfig,
    input_tokens: int,
    output_tokens: int,
) -> float:
    return round(
        (input_tokens / 1_000_000 * config.input_cost_per_million)
        + (output_tokens / 1_000_000 * config.output_cost_per_million),
        8,
    )
