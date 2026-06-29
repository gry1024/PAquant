from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

from paquant.agent_runtime.brooks_generalist import BrooksGeneralistTrader
from paquant.data_layer.sample_data import load_sample_candles
from paquant.drawing_engine.geometry import build_fibonacci_levels
from paquant.drawing_engine.schemas import (
    AnchorPoint,
    Fibonacci,
    MeasuredMove,
    RangeBox,
    ThreePush,
    TradeMarker,
    TrendLine,
    serialize_chart_object,
)
from paquant.knowledge_layer.compiler import compile_core_knowledge
from paquant.simulation_engine.engine import SimulationEngine
from paquant.simulation_engine.orders import SimulatedOrder


def _analysis_payload(decision) -> dict[str, Any]:
    return {
        "traderId": decision.trader_id,
        "marketContext": decision.market_context,
        "alwaysInBias": decision.always_in_bias,
        "trendStrength": decision.trend_strength,
        "tradingRangeState": decision.trading_range_state,
        "keyLevels": [level.model_dump(mode="json") for level in decision.key_levels],
        "setupCandidate": decision.setup_candidate,
        "invalidation": decision.invalidation,
        "entryType": decision.entry_type,
        "stop": decision.stop,
        "target": decision.target,
        "confidence": decision.confidence,
        "reasoningSummary": decision.reasoning_summary,
        "evidenceTrail": decision.evidence_trail,
        "modelUsage": decision.model_usage.model_dump(mode="json"),
    }


def build_knowledge_browser_payload() -> dict[str, Any]:
    knowledge = compile_core_knowledge()
    return {
        "version": knowledge.version,
        "sources": [
            {
                "id": source.id,
                "title": source.title,
                "sourceType": source.source_type,
                "themes": source.themes,
                "chapterRefs": source.chapter_refs,
            }
            for source in knowledge.sources
        ],
        "concepts": [
            {
                "key": concept.key,
                "name": concept.name,
                "summary": concept.summary,
                "sourceRefs": concept.source_refs,
                "questions": concept.questions,
            }
            for concept in knowledge.concepts
        ],
        "setupDossiers": [
            {
                "key": dossier.key,
                "name": dossier.name,
                "context": dossier.context,
                "observations": dossier.observations,
                "measurements": dossier.measurements,
                "entryStyles": dossier.entry_styles,
                "stopLogic": dossier.stop_logic,
                "targets": dossier.targets,
                "management": dossier.management,
                "failureModes": dossier.failure_modes,
                "nearbySetups": dossier.nearby_setups,
                "sourceRefs": dossier.source_refs,
            }
            for dossier in knowledge.setup_dossiers
        ],
        "caseCards": [
            {
                "key": case.key,
                "title": case.title,
                "sourceRefs": case.source_refs,
                "chartContext": case.chart_context,
                "patternInterpretation": case.pattern_interpretation,
                "traderThinking": case.trader_thinking,
                "expectedFollowThrough": case.expected_follow_through,
                "failureScenario": case.failure_scenario,
            }
            for case in knowledge.case_cards
        ],
        "reasoningPlaybooks": [
            {
                "key": playbook.key,
                "name": playbook.name,
                "questions": playbook.questions,
                "requiredObservations": playbook.required_observations,
                "invalidationChecks": playbook.invalidation_checks,
                "displayGuardrails": playbook.display_guardrails,
            }
            for playbook in knowledge.reasoning_playbooks
        ],
    }


def build_demo_fixture() -> dict[str, Any]:
    candles = load_sample_candles()
    knowledge = compile_core_knowledge()
    fib_start = AnchorPoint(time_index=0, price=2306.5)
    fib_end = AnchorPoint(time_index=24, price=2325.2)
    chart_objects = [
        TrendLine(
            id="tl-primary",
            label="Always-in long trend line",
            anchors=[
                AnchorPoint(time_index=0, price=2306.5),
                AnchorPoint(time_index=40, price=2329.0),
            ],
        ),
        RangeBox(
            id="box-pullback",
            label="Early pullback box",
            start_index=0,
            end_index=12,
            high=2316,
            low=2306.5,
        ),
        Fibonacci(
            id="fib-swing",
            label="Swing retracement map",
            start=fib_start,
            end=fib_end,
            levels=build_fibonacci_levels(fib_start, fib_end),
        ),
        MeasuredMove(
            id="mm-target",
            label="Measured move target",
            start=AnchorPoint(time_index=4, price=2310),
            end=AnchorPoint(time_index=18, price=2320),
            projected_from=AnchorPoint(time_index=20, price=2315),
            target_price=2325,
        ),
        ThreePush(
            id="three-push",
            label="Three pushes within channel",
            pushes=[
                AnchorPoint(time_index=8, price=2314.1),
                AnchorPoint(time_index=17, price=2320.8),
                AnchorPoint(time_index=29, price=2326.9),
            ],
        ),
        TradeMarker(
            id="entry-marker", label="Sim entry", time_index=0, price=2310, marker_type="entry"
        ),
        TradeMarker(
            id="target-marker", label="2R target", time_index=17, price=2320, marker_type="target"
        ),
    ]
    decision = BrooksGeneralistTrader().analyze(
        candles=candles, knowledge=knowledge, chart_objects=chart_objects
    )
    order = SimulatedOrder.limit_buy(
        symbol="XAUUSD",
        timeframe="5m",
        entry=2310,
        stop=2305,
        target=2320,
        quantity=1,
        setup_name="Brooks pullback in always-in long context",
    )
    engine = SimulationEngine(starting_equity=10_000)
    engine.submit_order(order)
    for candle in candles:
        engine.on_candle(candle)

    return {
        "candles": [candle.model_dump(mode="json") for candle in candles],
        "chartObjects": [serialize_chart_object(obj) for obj in chart_objects],
        "analysis": _analysis_payload(decision),
        "orders": [order.model_dump(mode="json")],
        "trades": [trade.model_dump(mode="json") for trade in engine.trades],
        "equityCurve": engine.equity_curve,
        "performanceSummary": engine.performance_summary().model_dump(mode="json"),
        "journal": [
            {
                "time": candles[0].timestamp.isoformat(),
                "event": "Plan created",
                "text": "Brooks Generalist identified a pullback in an always-in long context.",
            },
            {
                "time": candles[17].timestamp.isoformat(),
                "event": "Target reached",
                "text": "Simulated target was reached for a 2R outcome.",
            },
        ],
        "knowledge": build_knowledge_browser_payload(),
    }


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: python -m paquant.export_fixture <output-json>")
    output_path = Path(sys.argv[1])
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(build_demo_fixture(), indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
