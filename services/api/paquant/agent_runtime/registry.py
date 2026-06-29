from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict


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


_TRADER_PROFILES = [
    TraderProfile(
        id="brooks-generalist",
        name="Brooks Generalist",
        persona="Balanced price-action simulator that checks context before setup labels.",
        status="active",
        symbol="XAUUSD",
        timeframe="5m",
        preferred_setups=[
            "always-in pullback",
            "second entry",
            "failed breakout",
            "three pushes",
        ],
        risk_style="moderate; one unit risk after context and trader equation checks",
        tool_permissions=_COMMON_TOOLS,
        knowledge_policy="retrieve concept graph, setup dossiers, and similar failure cases",
        recent_action="Reviewed XAU 5m pullback thesis and submitted a simulated limit order.",
        performance=TraderPerformance(
            equity=10_020.0,
            win_rate=1.0,
            max_drawdown=0.0,
            trades=1,
            average_r=2.0,
        ),
    ),
    TraderProfile(
        id="always-in-trend",
        name="Always-In Trend Trader",
        persona="Tracks always-in direction, urgency, pullback quality, and trend resumption.",
        status="standby",
        symbol="XAUUSD",
        timeframe="5m",
        preferred_setups=["always-in pullback", "micro channel", "trend resumption"],
        risk_style="trend-following; wider stops only after strong context confirmation",
        tool_permissions=_COMMON_TOOLS,
        knowledge_policy="prefer trend, channel, always-in, and strong trend playbooks",
        recent_action="Waiting for a clean always-in long or short transition.",
        performance=TraderPerformance(
            equity=10_000.0,
            win_rate=0.0,
            max_drawdown=0.0,
            trades=0,
            average_r=0.0,
        ),
    ),
    TraderProfile(
        id="best-trades-only",
        name="Best-Trades-Only Conservative Trader",
        persona="Filters aggressively and accepts no-trade decisions when trader equation is thin.",
        status="standby",
        symbol="XAUUSD",
        timeframe="5m",
        preferred_setups=["high 2 pullback", "low 2 pullback", "major trend reversal"],
        risk_style="conservative; small position unless probability and reward are clear",
        tool_permissions=_COMMON_TOOLS,
        knowledge_policy="retrieve trader equation, signal bar quality, and failure mode cases",
        recent_action="Rejected marginal pullback because signal quality was mixed.",
        performance=TraderPerformance(
            equity=10_000.0,
            win_rate=0.0,
            max_drawdown=0.0,
            trades=0,
            average_r=0.0,
        ),
    ),
    TraderProfile(
        id="trading-range-scalper",
        name="Trading Range Scalper",
        persona="Treats ranges as uncertainty and favors buy-low/sell-high tests.",
        status="standby",
        symbol="XAUUSD",
        timeframe="5m",
        preferred_setups=["range fade", "failed breakout", "micro double top or bottom"],
        risk_style="scalping; fast exits and reduced size near range midline",
        tool_permissions=_COMMON_TOOLS,
        knowledge_policy="prefer trading range, failed breakout, and support/resistance cases",
        recent_action="Monitoring whether the current channel becomes a mature trading range.",
        performance=TraderPerformance(
            equity=10_000.0,
            win_rate=0.0,
            max_drawdown=0.0,
            trades=0,
            average_r=0.0,
        ),
    ),
    TraderProfile(
        id="wedge-reversal",
        name="Wedge/Reversal Specialist",
        persona="Studies three pushes, overshoots, undershoots, momentum loss, and reversal risk.",
        status="research",
        symbol="XAUUSD",
        timeframe="5m",
        preferred_setups=["wedge reversal", "three pushes", "final flag"],
        risk_style="reversal; requires clear invalidation and confirmation after exhaustion",
        tool_permissions=_COMMON_TOOLS,
        knowledge_policy="prefer wedge, three-push, final flag, and momentum-change cases",
        recent_action="Tagging three-push candidates but waiting for clearer signal bars.",
        performance=TraderPerformance(
            equity=10_000.0,
            win_rate=0.0,
            max_drawdown=0.0,
            trades=0,
            average_r=0.0,
        ),
    ),
    TraderProfile(
        id="breakout-failure",
        name="Breakout and Failed Breakout Trader",
        persona=(
            "Evaluates breakout strength, follow-through, trapped traders, "
            "and failure entries."
        ),
        status="research",
        symbol="XAUUSD",
        timeframe="5m",
        preferred_setups=["breakout pullback", "failed breakout", "measured move"],
        risk_style="event-driven; size depends on breakout follow-through and stop distance",
        tool_permissions=_COMMON_TOOLS,
        knowledge_policy="prefer breakout, failure, measured move, and trader trap cases",
        recent_action="Comparing breakout follow-through against measured move targets.",
        performance=TraderPerformance(
            equity=10_000.0,
            win_rate=0.0,
            max_drawdown=0.0,
            trades=0,
            average_r=0.0,
        ),
    ),
]


def list_trader_profiles() -> list[TraderProfile]:
    return list(_TRADER_PROFILES)


def get_trader_profile(trader_id: str) -> TraderProfile:
    for profile in _TRADER_PROFILES:
        if profile.id == trader_id:
            return profile
    raise KeyError(trader_id)
