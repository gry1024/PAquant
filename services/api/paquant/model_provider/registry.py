from __future__ import annotations

from paquant.model_provider.base import ModelCapability, ProviderConfig


def build_default_provider_registry() -> dict[str, ProviderConfig]:
    return {
        "deepseek": ProviderConfig(
            provider="deepseek",
            model="deepseek-chat",
            base_url="https://api.deepseek.com/v1",
            api_key_env="DEEPSEEK_API_KEY",
            capabilities=ModelCapability(
                text=True,
                structured_output=True,
                tool_calling=True,
                context_window=64_000,
            ),
            input_cost_per_million=0.27,
            output_cost_per_million=1.10,
        ),
        "qwen": ProviderConfig(
            provider="qwen",
            model="qwen-plus",
            base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
            api_key_env="DASHSCOPE_API_KEY",
            capabilities=ModelCapability(
                text=True,
                vision=True,
                structured_output=True,
                tool_calling=True,
                context_window=128_000,
            ),
            input_cost_per_million=0.40,
            output_cost_per_million=1.20,
        ),
        "minimax": ProviderConfig(
            provider="minimax",
            model="MiniMax-M1",
            base_url="https://api.minimax.io/v1",
            api_key_env="MINIMAX_API_KEY",
            capabilities=ModelCapability(
                text=True,
                structured_output=True,
                tool_calling=True,
                context_window=80_000,
            ),
            input_cost_per_million=0.30,
            output_cost_per_million=1.20,
        ),
        "kimi": ProviderConfig(
            provider="kimi",
            model="moonshot-v1-128k",
            base_url="https://api.moonshot.cn/v1",
            api_key_env="MOONSHOT_API_KEY",
            capabilities=ModelCapability(
                text=True,
                structured_output=True,
                tool_calling=True,
                context_window=128_000,
            ),
            input_cost_per_million=1.80,
            output_cost_per_million=1.80,
        ),
    }
