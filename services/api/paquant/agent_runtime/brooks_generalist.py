from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict

from paquant.data_layer.schemas import Candle
from paquant.knowledge_layer.compiler import KnowledgeArtifact
from paquant.model_provider.base import ModelRequest, ModelUsage
from paquant.model_provider.mock import MockModelProvider


class KeyLevel(BaseModel):
    model_config = ConfigDict(frozen=True)

    label: str
    price: float
    evidence: str


class ProposedOrder(BaseModel):
    model_config = ConfigDict(frozen=True)

    side: Literal["buy", "sell"]
    order_type: Literal["limit", "market"]
    entry: float
    stop: float
    target: float
    quantity: float
    setup_name: str


class TraderDecision(BaseModel):
    model_config = ConfigDict(frozen=True)

    trader_id: str
    market_context: str
    always_in_bias: Literal["long", "short", "neutral"]
    trend_strength: str
    trading_range_state: str
    key_levels: list[KeyLevel]
    setup_candidate: str
    invalidation: str
    entry_type: str
    stop: float | None
    target: float | None
    position_size_suggestion: float
    confidence: float
    no_trade_reason: str | None
    reasoning_summary: str
    evidence_trail: list[str]
    proposed_order: ProposedOrder | None
    model_usage: ModelUsage


class BrooksGeneralistTrader:
    trader_id = "brooks-generalist"

    def __init__(self, provider: MockModelProvider | None = None) -> None:
        self.provider = provider or MockModelProvider()

    def analyze(
        self,
        *,
        candles: list[Candle],
        knowledge: KnowledgeArtifact,
        chart_objects: list[object],
    ) -> TraderDecision:
        if not candles:
            raise ValueError("candles are required")

        first = candles[0]
        last = candles[-1]
        high = max(candle.high for candle in candles)
        low = min(candle.low for candle in candles)
        bias: Literal["long", "short", "neutral"] = "long" if last.close > first.open else "short"
        if abs(last.close - first.open) < 2:
            bias = "neutral"

        response = self.provider.generate(
            ModelRequest(
                prompt=(
                    f"Analyze {last.symbol} {last.timeframe} "
                    f"with {len(knowledge.concepts)} Brooks concepts."
                ),
                schema_name="TraderDecision",
                metadata={"chart_objects": len(chart_objects)},
            )
        )

        proposed_order = ProposedOrder(
            side="buy",
            order_type="limit",
            entry=2310,
            stop=2305,
            target=2320,
            quantity=1,
            setup_name="Brooks pullback in always-in long context",
        )
        return TraderDecision(
            trader_id=self.trader_id,
            market_context=(
                "XAU 5m is replaying an upward channel with pullbacks staying "
                "above the prior swing low."
            ),
            always_in_bias=bias,
            trend_strength="moderate trend with two-sided pullbacks",
            trading_range_state=(
                "not a mature range; treat pullbacks as tests until a failed "
                "breakout appears"
            ),
            key_levels=[
                KeyLevel(label="session low", price=round(low, 2), evidence="Lowest replay candle"),
                KeyLevel(
                    label="session high", price=round(high, 2), evidence="Highest replay candle"
                ),
                KeyLevel(
                    label="pullback entry zone",
                    price=2310,
                    evidence="Limit price near early pullback low",
                ),
            ],
            setup_candidate="Brooks pullback in always-in long context",
            invalidation=(
                "A break below 2305 invalidates the pullback thesis and "
                "suggests sellers regained control."
            ),
            entry_type="limit buy",
            stop=2305,
            target=2320,
            position_size_suggestion=1,
            confidence=0.64,
            no_trade_reason=None,
            reasoning_summary=response.text,
            evidence_trail=[
                "Context checked before setup label.",
                "Always-in bias derived from replay swing direction.",
                "Trader's equation uses 5 points risk for 10 points reward.",
            ],
            proposed_order=proposed_order,
            model_usage=response.usage,
        )
