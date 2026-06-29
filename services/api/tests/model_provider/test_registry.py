from paquant.model_provider.registry import build_default_provider_registry


def test_default_registry_contains_phase_one_provider_metadata():
    registry = build_default_provider_registry()

    assert {"deepseek", "qwen", "minimax", "kimi"} <= set(registry)
    assert registry["deepseek"].api_key_env == "DEEPSEEK_API_KEY"
    assert registry["qwen"].base_url.endswith("/compatible-mode/v1")
    assert registry["kimi"].capabilities.context_window >= 128_000
    assert registry["minimax"].capabilities.text is True
    assert all(config.input_cost_per_million >= 0 for config in registry.values())
