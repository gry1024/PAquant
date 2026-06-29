from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

from paquant.agent_runtime.brooks_generalist import (
    BrooksGeneralistTrader,
    build_brooks_generalist_drawing_commands,
)
from paquant.data_layer.sample_data import load_sample_candles
from paquant.drawing_engine.schemas import (
    AnchorPoint,
    MeasuredMove,
    ThreePush,
    TradeMarker,
    serialize_chart_object,
)
from paquant.drawing_engine.tools import AgentAction, execute_drawing_plan
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


def _action_payload(action: AgentAction) -> dict[str, Any]:
    return {
        "sequence": action.sequence,
        "tool": action.tool,
        "status": action.status,
        "observation": action.observation,
        "arguments": action.arguments,
        "output": action.output,
        "chartObjectId": action.chart_object_id,
    }


def _snapshot_id(stage: str) -> str:
    return f"snapshot-{stage.replace(' ', '-')}"


def _trade_replay_payload(candles, order: SimulatedOrder, trade) -> list[dict[str, Any]]:
    return [
        {
            "stage": "pre-entry",
            "snapshotId": _snapshot_id("pre-entry"),
            "title": "Pre-entry",
            "time": candles[8].timestamp.isoformat(),
            "barIndex": 8,
            "chartObjectIds": ["tl-primary", "channel-primary", "box-pullback"],
            "orderId": None,
            "outcome": "observing",
            "narrative": (
                "AI marked the always-in trend line, channel projection, and early "
                "pullback box before committing to a trade."
            ),
        },
        {
            "stage": "plan",
            "snapshotId": _snapshot_id("plan"),
            "title": "Plan",
            "time": candles[10].timestamp.isoformat(),
            "barIndex": 10,
            "chartObjectIds": ["fib-swing", "tl-primary"],
            "orderId": order.id,
            "outcome": "pending",
            "narrative": (
                "Limit buy plan used 5 points of risk and a 2R target while the "
                "pullback held above the invalidation price."
            ),
        },
        {
            "stage": "execution",
            "snapshotId": _snapshot_id("execution"),
            "title": "Execution",
            "time": candles[12].timestamp.isoformat(),
            "barIndex": 12,
            "chartObjectIds": ["entry-marker"],
            "orderId": order.id,
            "outcome": "filled",
            "narrative": "Simulated limit order filled inside the pullback zone.",
        },
        {
            "stage": "outcome",
            "snapshotId": _snapshot_id("outcome"),
            "title": "Outcome",
            "time": candles[17].timestamp.isoformat(),
            "barIndex": 17,
            "chartObjectIds": ["target-marker", "mm-target"],
            "orderId": order.id,
            "outcome": trade.outcome,
            "narrative": (
                f"Trade reached target for {trade.r_multiple:.1f}R with "
                f"{trade.mfe_points:.2f} points MFE."
            ),
        },
        {
            "stage": "post-trade review",
            "snapshotId": _snapshot_id("post-trade review"),
            "title": "Post-trade review",
            "time": candles[18].timestamp.isoformat(),
            "barIndex": 18,
            "chartObjectIds": ["three-push", "channel-primary"],
            "orderId": order.id,
            "outcome": trade.outcome,
            "narrative": (
                "Review notes that the channel context and measured target were "
                "aligned; future invalidation remains a break below the prior swing."
            ),
        },
    ]


def _trade_snapshots_payload(
    candles,
    chart_objects: list[dict[str, Any]],
    replay_steps: list[dict[str, Any]],
    order: SimulatedOrder,
) -> list[dict[str, Any]]:
    objects_by_id = {chart_object["id"]: chart_object for chart_object in chart_objects}
    snapshots: list[dict[str, Any]] = []
    for step in replay_steps:
        start_index = max(0, step["barIndex"] - 8)
        end_index = min(len(candles) - 1, step["barIndex"] + 4)
        window_candles = candles[start_index : end_index + 1]
        snapshot_objects = [
            objects_by_id[object_id]
            for object_id in step["chartObjectIds"]
            if object_id in objects_by_id
        ]
        snapshots.append(
            {
                "id": step["snapshotId"],
                "tradeOrderId": order.id,
                "stage": step["stage"],
                "capturedAt": step["time"],
                "candleWindow": {
                    "startIndex": start_index,
                    "endIndex": end_index,
                    "symbol": "XAUUSD",
                    "timeframe": "5m",
                },
                "candles": [candle.model_dump(mode="json") for candle in window_candles],
                "chartObjectIds": step["chartObjectIds"],
                "chartObjects": snapshot_objects,
                "analysisSummary": step["narrative"],
            }
        )
    return snapshots


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
    drawing_result = execute_drawing_plan(candles, build_brooks_generalist_drawing_commands())
    chart_objects = [
        *drawing_result.chart_objects,
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
    trade = engine.trades[0]

    chart_object_payloads = [serialize_chart_object(obj) for obj in chart_objects]
    replay_steps = _trade_replay_payload(candles, order, trade)

    return {
        "candles": [candle.model_dump(mode="json") for candle in candles],
        "agentActions": [_action_payload(action) for action in decision.action_stream],
        "chartObjects": chart_object_payloads,
        "analysis": _analysis_payload(decision),
        "orders": [order.model_dump(mode="json")],
        "trades": [trade.model_dump(mode="json") for trade in engine.trades],
        "tradeSnapshots": _trade_snapshots_payload(
            candles, chart_object_payloads, replay_steps, order
        ),
        "tradeReplay": replay_steps,
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
