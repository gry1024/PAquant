from __future__ import annotations

from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict

REPO_ROOT = Path(__file__).resolve().parents[4]
DEFAULT_AGENTS_DIR = REPO_ROOT / ".agents"


class TraderPerformance(BaseModel):
    model_config = ConfigDict(frozen=True)

    equity: float
    win_rate: float
    max_drawdown: float
    trades: int
    average_r: float


class TraderProfile(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: str
    name: str
    persona: str
    status: Literal["active", "standby", "research"]
    symbol: Literal["XAUUSD"]
    timeframe: Literal["5m"]
    preferred_setups: list[str]
    risk_style: str
    tool_permissions: list[str]
    knowledge_policy: str
    agent_file: str
    shared_knowledge_files: list[str]
    shared_knowledge_summary: str
    recent_action: str
    performance: TraderPerformance


_COMMON_TOOLS = [
    "find_swings",
    "draw_trendline",
    "draw_channel",
    "draw_box",
    "draw_fibonacci",
    "measure_leg",
    "compare_legs",
    "count_bars",
    "project_line",
    "measure_deviation",
    "snap_to_swing",
]


_PROFILE_ORDER = [
    "brooks-generalist",
    "always-in-trend",
    "second-entry",
    "best-trades-only",
    "trading-range-scalper",
    "breakout-pullback",
    "wedge-reversal",
    "breakout-failure",
    "major-reversal",
    "final-flag",
]

_PROFILE_RUNTIME = {
    "brooks-generalist": {
        "status": "active",
        "recent_action": "Reviewed XAU 5m signal-bar plan and submitted a simulated stop order.",
        "performance": TraderPerformance(
            equity=10_020.0,
            win_rate=1.0,
            max_drawdown=0.0,
            trades=1,
            average_r=2.0,
        ),
    },
    "always-in-trend": {
        "status": "standby",
        "recent_action": "Waiting for a clean always-in long or short transition.",
    },
    "second-entry": {
        "status": "standby",
        "recent_action": "Waiting for a clear H2/L2 signal after the first attempt fails.",
    },
    "best-trades-only": {
        "status": "standby",
        "recent_action": "Rejected marginal pullback because signal quality was mixed.",
    },
    "trading-range-scalper": {
        "status": "standby",
        "recent_action": "Monitoring whether the current channel becomes a mature trading range.",
    },
    "breakout-pullback": {
        "status": "standby",
        "recent_action": "Waiting for breakout follow-through before accepting a retest entry.",
    },
    "wedge-reversal": {
        "status": "research",
        "recent_action": "Tagging three-push candidates but waiting for clearer signal bars.",
    },
    "breakout-failure": {
        "status": "research",
        "recent_action": "Comparing breakout follow-through against measured move targets.",
    },
    "major-reversal": {
        "status": "research",
        "recent_action": "Checking whether trend-line break plus failed extreme test is complete.",
    },
    "final-flag": {
        "status": "research",
        "recent_action": "Watching mature-trend continuation attempts for final-flag failure.",
    },
}


def list_trader_profiles(agents_dir: Path | None = None) -> list[TraderProfile]:
    agents_root = agents_dir or DEFAULT_AGENTS_DIR
    profiles = [
        _parse_trader_profile(path, agents_root)
        for path in sorted((agents_root / "traders").glob("*.md"))
    ]
    ordered = {profile.id: profile for profile in profiles}
    known = [ordered[profile_id] for profile_id in _PROFILE_ORDER if profile_id in ordered]
    extras = [profile for profile in profiles if profile.id not in _PROFILE_ORDER]
    return [*known, *extras]


def get_trader_profile(trader_id: str) -> TraderProfile:
    for profile in list_trader_profiles():
        if profile.id == trader_id:
            return profile
    raise KeyError(trader_id)


def _parse_trader_profile(path: Path, agents_root: Path) -> TraderProfile:
    text = path.read_text(encoding="utf-8")
    trader_id = path.stem
    strategy_lines = _section_lines(text, "Strategy")
    runtime = _PROFILE_RUNTIME.get(trader_id, {})
    return TraderProfile(
        id=trader_id,
        name=_markdown_title(text),
        persona=_first_paragraph(_section_lines(text, "Persona")),
        status=runtime.get("status", "research"),
        symbol="XAUUSD",
        timeframe="5m",
        preferred_setups=_bullet_items(strategy_lines),
        risk_style=_prefixed_value(strategy_lines, "Risk style:"),
        tool_permissions=_COMMON_TOOLS,
        knowledge_policy=_prefixed_value(strategy_lines, "Knowledge policy:"),
        agent_file=_agent_relative_path(path, agents_root),
        shared_knowledge_files=[
            _agent_relative_path(common_path, agents_root)
            for common_path in _common_knowledge_files(agents_root)
        ],
        shared_knowledge_summary=_shared_knowledge_summary(agents_root),
        recent_action=runtime.get(
            "recent_action",
            "Waiting for a validated setup from agent file.",
        ),
        performance=runtime.get("performance", _empty_performance()),
    )


def _common_knowledge_files(agents_root: Path) -> list[Path]:
    return sorted((agents_root / "common").glob("*.md"))


def _shared_knowledge_summary(agents_root: Path) -> str:
    summaries = []
    for path in _common_knowledge_files(agents_root):
        text = path.read_text(encoding="utf-8")
        summaries.append(_markdown_title(text))
    return " / ".join(summaries)


def _empty_performance() -> TraderPerformance:
    return TraderPerformance(
        equity=10_000.0,
        win_rate=0.0,
        max_drawdown=0.0,
        trades=0,
        average_r=0.0,
    )


def _agent_relative_path(path: Path, agents_root: Path) -> str:
    return str(Path(".agents") / path.relative_to(agents_root)).replace("\\", "/")


def _markdown_title(text: str) -> str:
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("# "):
            return stripped.removeprefix("# ").strip()
    raise ValueError("agent file is missing a level-one title")


def _section_lines(text: str, heading: str) -> list[str]:
    lines: list[str] = []
    in_section = False
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("## "):
            if in_section:
                break
            in_section = stripped.removeprefix("## ").strip().lower() == heading.lower()
            continue
        if in_section:
            lines.append(line)
    return lines


def _first_paragraph(lines: list[str]) -> str:
    paragraph = [line.strip() for line in lines if line.strip()]
    return paragraph[0] if paragraph else ""


def _bullet_items(lines: list[str]) -> list[str]:
    return [
        stripped.removeprefix("- ").strip()
        for line in lines
        if (stripped := line.strip()).startswith("- ")
    ]


def _prefixed_value(lines: list[str], prefix: str) -> str:
    for line in lines:
        stripped = line.strip()
        if stripped.lower().startswith(prefix.lower()):
            return stripped[len(prefix) :].strip()
    return ""
