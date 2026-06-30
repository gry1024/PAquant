from pathlib import Path

from paquant.agent_runtime.registry import list_trader_profiles

REPO_ROOT = Path(__file__).resolve().parents[4]
AGENTS_DIR = REPO_ROOT / ".agents"


def test_agents_directory_contains_common_knowledge_files():
    common_dir = AGENTS_DIR / "common"

    price_action = (common_dir / "price-action-core.md").read_text(encoding="utf-8")
    risk_control = (common_dir / "risk-control.md").read_text(encoding="utf-8")

    assert "Trading Price Action - Trends" in price_action
    assert "Trading Price Action - Trading Ranges" in price_action
    assert "Trading Price Action - Reversals" in price_action
    assert "always-in" in price_action.lower()
    assert "stop" in risk_control.lower()
    assert "target" in risk_control.lower()
    assert "position size" in risk_control.lower()


def test_each_registered_trader_has_strategy_file():
    trader_dir = AGENTS_DIR / "traders"

    for profile in list_trader_profiles():
        strategy_file = trader_dir / f"{profile.id}.md"
        content = strategy_file.read_text(encoding="utf-8")

        assert profile.name in content
        assert "## Persona" in content
        assert "## Strategy" in content
        assert "## Shared Knowledge" in content
        for setup in profile.preferred_setups:
            assert setup in content


def test_trader_profiles_are_parsed_from_agent_files(tmp_path):
    agents_dir = tmp_path / ".agents"
    common_dir = agents_dir / "common"
    trader_dir = agents_dir / "traders"
    common_dir.mkdir(parents=True)
    trader_dir.mkdir(parents=True)
    (common_dir / "price-action-core.md").write_text(
        "# Shared Price Action Core\n\n## Common Concepts\n\n- context before setup\n",
        encoding="utf-8",
    )
    (common_dir / "risk-control.md").write_text(
        "# Shared Risk Control\n\n## Position Rules\n\n- position size first\n",
        encoding="utf-8",
    )
    (trader_dir / "test-specialist.md").write_text(
        "\n".join(
            [
                "# Test Specialist",
                "",
                "## Persona",
                "",
                "Reads only the best reversal context before trading.",
                "",
                "## Strategy",
                "",
                "- wedge reversal",
                "- failed breakout",
                "",
                "Risk style: conservative; one unit only after confirmation.",
                "",
                "Knowledge policy: retrieve wedge and failure cases first.",
                "",
                "## Shared Knowledge",
                "",
                "Uses `.agents/common/price-action-core.md` and `.agents/common/risk-control.md`.",
            ]
        ),
        encoding="utf-8",
    )

    profiles = list_trader_profiles(agents_dir=agents_dir)
    profile = next(profile for profile in profiles if profile.id == "test-specialist")

    assert profile.name == "Test Specialist"
    assert profile.persona == "Reads only the best reversal context before trading."
    assert profile.preferred_setups == ["wedge reversal", "failed breakout"]
    assert profile.risk_style == "conservative; one unit only after confirmation."
    assert profile.knowledge_policy == "retrieve wedge and failure cases first."
    assert profile.agent_file == ".agents/traders/test-specialist.md"
    assert profile.shared_knowledge_files == [
        ".agents/common/price-action-core.md",
        ".agents/common/risk-control.md",
    ]
    assert "Shared Price Action Core" in profile.shared_knowledge_summary
    assert "Shared Risk Control" in profile.shared_knowledge_summary
