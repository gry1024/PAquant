from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

from paquant.agent_runtime.brooks_generalist import (
    BrooksGeneralistTrader,
)
from paquant.data_layer.sample_data import load_sample_candles
from paquant.data_layer.schemas import Candle
from paquant.data_layer.timeframes import build_higher_timeframe_context
from paquant.drawing_engine.schemas import (
    AnchorPoint,
    MeasuredMove,
    ThreePush,
    TradeMarker,
    serialize_chart_object,
)
from paquant.drawing_engine.tools import AgentAction
from paquant.knowledge_layer.compiler import compile_core_knowledge
from paquant.model_provider.base import ModelProvider
from paquant.simulation_engine.engine import SimulationEngine
from paquant.simulation_engine.orders import OrderSide, OrderType, SimulatedOrder


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
        "positionSizeSuggestion": decision.position_size_suggestion,
        "noTradeReason": decision.no_trade_reason,
        "confidence": decision.confidence,
        "reasoningSummary": decision.reasoning_summary,
        "knowledgeRefs": [
            {
                "artifactType": reference.artifact_type,
                "key": reference.key,
                "title": reference.title,
                "summary": reference.summary,
                "sourceRefs": reference.source_refs,
                "score": reference.score,
            }
            for reference in decision.knowledge_refs
        ],
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
    risk_points = abs(order.entry - order.stop)
    reward_points = abs(order.target - order.entry)
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
                f"{order.order_type.value} {order.side.value} plan used {risk_points:.2f} points "
                f"of risk and a {reward_points / risk_points:.1f}R target while "
                "waiting for the signal bar trigger instead of filling before confirmation."
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
            "narrative": "Simulated stop order filled only after the signal bar trigger fired.",
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


def _open_order_replay_payload(
    candles, order: SimulatedOrder, signal_bar_index: int
) -> list[dict[str, Any]]:
    bar_index = min(signal_bar_index, len(candles) - 1)
    return [
        {
            "stage": "plan",
            "snapshotId": _snapshot_id("plan"),
            "title": "Plan",
            "time": candles[bar_index].timestamp.isoformat(),
            "barIndex": bar_index,
            "chartObjectIds": ["entry-marker", "stop-marker", "target-marker"],
            "orderId": order.id,
            "outcome": "submitted",
            "narrative": order.reason,
        }
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
        "chapterMap": [
            {
                "sourceId": chapter.source_id,
                "part": chapter.part,
                "title": chapter.title,
                "summary": chapter.summary,
                "conceptKeys": chapter.concept_keys,
            }
            for chapter in knowledge.chapter_map
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
        "conceptEdges": [
            {
                "source": edge.source,
                "target": edge.target,
                "relation": edge.relation,
            }
            for edge in knowledge.concept_edges
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
                "diagram": case.diagram.model_dump(mode="json"),
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
        "glossary": [
            {
                "english": term.english,
                "chinese": term.chinese,
                "abbreviation": term.abbreviation,
                "definition": term.definition,
                "sourceRefs": term.source_refs,
            }
            for term in knowledge.glossary
        ],
    }


def _journal_payload(
    candles: list[Candle], order: SimulatedOrder, trade, signal_bar_index: int
) -> list[dict[str, Any]]:
    signal_bar_index = min(signal_bar_index, len(candles) - 1)
    entries = [
        {
            "time": candles[0].timestamp.isoformat(),
            "event": "计划已生成",
            "text": (
                "布鲁克斯通用交易员生成了信号 K 线 stop order 计划，"
                f"订单类型 {order.order_type.value}，入场 {order.entry:.2f}。"
            ),
        }
    ]
    if trade is None:
        entries.append(
            {
                "time": candles[signal_bar_index].timestamp.isoformat(),
                "event": "订单已提交",
                "text": "模拟订单等待信号 K 线触发，尚未假定未来成交结果。",
            }
        )
        return entries

    entries.append(
        {
            "time": candles[-1].timestamp.isoformat(),
            "event": "止盈达成" if trade.outcome == "target" else "交易结束",
            "text": f"模拟交易结果为 {trade.r_multiple:.1f}R。",
        }
    )
    return entries


def build_demo_fixture(
    model_provider: ModelProvider | None = None,
    candles: list[Candle] | None = None,
) -> dict[str, Any]:
    source_candles = candles or load_sample_candles()
    analysis_candles = source_candles[:18] if candles is None else source_candles
    knowledge = compile_core_knowledge()
    decision = BrooksGeneralistTrader(provider=model_provider).analyze(
        candles=analysis_candles, knowledge=knowledge, chart_objects=[]
    )
    if decision.proposed_order is None:
        raise ValueError("demo fixture expects a tradable Brooks setup")
    proposed_order = decision.proposed_order
    trade_reason = (
        f"{proposed_order.execution_plan.trigger_condition}；交易员方程给出 "
        f"{abs(proposed_order.entry - proposed_order.stop):.2f} 点风险，"
        f"{abs(proposed_order.target - proposed_order.entry):.2f} 点目标回报。"
    )
    signal_bar_index = proposed_order.execution_plan.signal_bar_index
    marker_end_index = min(len(source_candles) - 1, signal_bar_index + 5)
    chart_objects = [
        *decision.chart_objects,
        MeasuredMove(
            id="mm-target",
            label="等距测量目标",
            start=AnchorPoint(time_index=4, price=proposed_order.entry),
            end=AnchorPoint(time_index=18, price=proposed_order.target),
            projected_from=AnchorPoint(
                time_index=20,
                price=round((proposed_order.entry + proposed_order.target) / 2, 2),
            ),
            target_price=round(
                proposed_order.target + abs(proposed_order.target - proposed_order.entry) / 2,
                2,
            ),
            reason=(
                "等距测量从入场腿投射到目标区域，范围只覆盖本次信号后的观察窗口。"
            ),
        ),
        ThreePush(
            id="three-push",
            label="通道内三推",
            pushes=[
                AnchorPoint(
                    time_index=8,
                    price=source_candles[min(8, len(source_candles) - 1)].high,
                ),
                AnchorPoint(
                    time_index=17,
                    price=source_candles[min(17, len(source_candles) - 1)].high,
                ),
                AnchorPoint(
                    time_index=29,
                    price=source_candles[min(29, len(source_candles) - 1)].high,
                ),
            ],
            reason="三推示例只连接三次实际推动锚点，用来观察通道末端动能是否衰竭。",
        ),
        TradeMarker(
            id="entry-marker",
            label=f"入场 {proposed_order.entry:.2f} | 仓位 {proposed_order.quantity:g}",
            time_index=signal_bar_index,
            start_index=signal_bar_index,
            end_index=marker_end_index,
            price=proposed_order.entry,
            marker_type="entry",
            quantity=proposed_order.quantity,
            reason=(
                f"订单类型 {proposed_order.order_type}；{trade_reason}"
                f" 信号K线为第 {signal_bar_index + 1} 根，触发价 {proposed_order.entry:.2f}。"
            ),
        ),
        TradeMarker(
            id="stop-marker",
            label=f"止损 {proposed_order.stop:.2f} | 仓位 {proposed_order.quantity:g}",
            time_index=signal_bar_index,
            start_index=signal_bar_index,
            end_index=marker_end_index,
            price=proposed_order.stop,
            marker_type="stop",
            quantity=proposed_order.quantity,
            reason=(
                f"止损 {proposed_order.stop:.2f} 位于信号 K 线另一侧，"
                "代表本笔 stop order 的失效价。"
            ),
        ),
        TradeMarker(
            id="target-marker",
            label=f"止盈 {proposed_order.target:.2f} | 仓位 {proposed_order.quantity:g}",
            time_index=marker_end_index,
            start_index=signal_bar_index,
            end_index=marker_end_index,
            price=proposed_order.target,
            marker_type="target",
            quantity=proposed_order.quantity,
            reason="止盈标记表示从信号 K 线 stop 入场价测算出的 2R 目标。",
        ),
    ]
    order = SimulatedOrder(
        id=f"sim-XAUUSD-5m-{proposed_order.setup_name}",
        symbol="XAUUSD",
        timeframe="5m",
        side=OrderSide(proposed_order.side),
        order_type=OrderType(proposed_order.order_type),
        activation_price=proposed_order.activation_price,
        entry=proposed_order.entry,
        stop=proposed_order.stop,
        target=proposed_order.target,
        quantity=proposed_order.quantity,
        setup_name=proposed_order.setup_name,
        reason=trade_reason,
    )
    engine = SimulationEngine(starting_equity=10_000)
    engine.submit_order(order)
    for candle in source_candles[signal_bar_index:]:
        engine.on_candle(candle)
    trade = engine.trades[0] if engine.trades else None

    chart_object_payloads = [serialize_chart_object(obj) for obj in chart_objects]
    replay_steps = (
        _trade_replay_payload(source_candles, order, trade)
        if trade is not None
        else _open_order_replay_payload(source_candles, order, signal_bar_index)
    )
    order_payload = order.model_dump(mode="json")
    order_payload["execution_plan"] = proposed_order.execution_plan.model_dump(mode="json")

    return {
        "candles": [candle.model_dump(mode="json") for candle in source_candles],
        "higherTimeframeContext": [
            context.model_dump(mode="json")
            for context in build_higher_timeframe_context(source_candles)
        ],
        "agentActions": [_action_payload(action) for action in decision.action_stream],
        "chartObjects": chart_object_payloads,
        "analysis": _analysis_payload(decision),
        "orders": [order_payload],
        "trades": [closed_trade.model_dump(mode="json") for closed_trade in engine.trades],
        "tradeSnapshots": (
            _trade_snapshots_payload(source_candles, chart_object_payloads, replay_steps, order)
            if trade is not None
            else []
        ),
        "tradeReplay": replay_steps,
        "equityCurve": engine.equity_curve,
        "performanceSummary": engine.performance_summary().model_dump(mode="json"),
        "journal": _journal_payload(source_candles, order, trade, signal_bar_index),
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
