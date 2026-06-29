import pytest
from paquant.agent_runtime.registry import get_trader_profile, list_trader_profiles


def test_trader_registry_contains_required_personas():
    profiles = list_trader_profiles()

    assert [profile.id for profile in profiles] == [
        "brooks-generalist",
        "always-in-trend",
        "best-trades-only",
        "trading-range-scalper",
        "wedge-reversal",
        "breakout-failure",
    ]
    assert profiles[0].status == "active"
    assert all(profile.symbol == "XAUUSD" for profile in profiles)
    assert all(profile.timeframe == "5m" for profile in profiles)
    assert all(profile.preferred_setups for profile in profiles)


def test_trader_profiles_expose_tools_and_performance_defaults():
    profiles = list_trader_profiles()

    required_tools = {"find_swings", "draw_trendline", "measure_leg", "count_bars"}
    for profile in profiles:
        assert required_tools <= set(profile.tool_permissions)
        assert profile.performance.equity >= 10_000
        assert 0 <= profile.performance.win_rate <= 1
        assert profile.performance.max_drawdown <= 0
        assert profile.recent_action


def test_get_trader_profile_returns_stable_profile_and_rejects_unknown_id():
    profile = get_trader_profile("wedge-reversal")

    assert profile.name == "Wedge/Reversal Specialist"
    assert "three pushes" in profile.preferred_setups

    with pytest.raises(KeyError):
        get_trader_profile("unknown-trader")
