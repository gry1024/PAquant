from __future__ import annotations

import json
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict

ARTIFACT_PATH = Path(__file__).with_name("artifacts") / "brooks_core.json"


class KnowledgeSource(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: str
    title: str
    source_type: Literal["local_pdf"]
    themes: list[str]
    chapter_refs: list[str]


class Concept(BaseModel):
    model_config = ConfigDict(frozen=True)

    key: str
    name: str
    summary: str
    source_refs: list[str]
    questions: list[str]


class SetupDossier(BaseModel):
    model_config = ConfigDict(frozen=True)

    key: str
    name: str
    context: str
    observations: list[str]
    measurements: list[str]
    entry_styles: list[str]
    stop_logic: list[str]
    targets: list[str]
    management: list[str]
    failure_modes: list[str]
    nearby_setups: list[str]
    source_refs: list[str]


class CaseCard(BaseModel):
    model_config = ConfigDict(frozen=True)

    key: str
    title: str
    source_refs: list[str]
    chart_context: str
    pattern_interpretation: str
    trader_thinking: str
    expected_follow_through: str
    failure_scenario: str


class ReasoningPlaybook(BaseModel):
    model_config = ConfigDict(frozen=True)

    key: str
    name: str
    questions: list[str]
    required_observations: list[str]
    invalidation_checks: list[str]
    display_guardrails: list[str]


class KnowledgeArtifact(BaseModel):
    model_config = ConfigDict(frozen=True)

    version: str
    sources: list[KnowledgeSource]
    concepts: list[Concept]
    setup_dossiers: list[SetupDossier]
    case_cards: list[CaseCard]
    reasoning_playbooks: list[ReasoningPlaybook]


def compile_core_knowledge() -> KnowledgeArtifact:
    sources = [
        KnowledgeSource(
            id="brooks-trends",
            title="Trading Price Action - Trends",
            source_type="local_pdf",
            themes=["trend", "channel", "always-in", "pullback quality"],
            chapter_refs=[
                "Trend from the open",
                "Channels and broad channels",
                "Pullbacks in strong trends",
            ],
        ),
        KnowledgeSource(
            id="brooks-trading-ranges",
            title="Trading Price Action - Trading Ranges",
            source_type="local_pdf",
            themes=["trading range", "failed breakout", "buy low sell high"],
            chapter_refs=[
                "Trading range behavior",
                "Breakouts and failed breakouts",
                "Support and resistance in ranges",
            ],
        ),
        KnowledgeSource(
            id="brooks-reversals",
            title="Trading Price Action - Reversals",
            source_type="local_pdf",
            themes=["wedge", "three pushes", "failed reversal", "exhaustion"],
            chapter_refs=[
                "Major trend reversals",
                "Wedges and three pushes",
                "Failed reversals and final flags",
            ],
        ),
    ]
    concepts = [
        Concept(
            key="context",
            name="Context Before Setup",
            summary=(
                "A pattern only has trading meaning after trend, channel, range, "
                "and recent urgency are understood."
            ),
            source_refs=["brooks-trends", "brooks-trading-ranges"],
            questions=[
                "Is the market trending, ranging, or transitioning?",
                "Who is trapped if this setup fails?",
            ],
        ),
        Concept(
            key="always_in",
            name="Always-In Direction",
            summary=(
                "The trader tracks which side a reasonable swing trader should "
                "currently favor until evidence flips it."
            ),
            source_refs=["brooks-trends"],
            questions=[
                "What would force a swing trader to exit?",
                "Are pullbacks being bought or sold aggressively?",
            ],
        ),
        Concept(
            key="trend_channel",
            name="Trend and Channel Spectrum",
            summary=(
                "Channels can behave as sloping trading ranges, so line breaks "
                "and overshoots need follow-through."
            ),
            source_refs=["brooks-trends"],
            questions=["Is the channel tight or broad?", "Did the overshoot reverse with urgency?"],
        ),
        Concept(
            key="trading_range",
            name="Trading Range State",
            summary=(
                "Ranges express uncertainty; many breakouts fail and probability "
                "often favors fading extremes."
            ),
            source_refs=["brooks-trading-ranges"],
            questions=[
                "Is price near the range high, low, or middle?",
                "Has a breakout shown follow-through?",
            ],
        ),
        Concept(
            key="three_push",
            name="Three Pushes",
            summary=(
                "Three pushes are repeated attempts that may show exhaustion, "
                "especially when spacing widens or momentum fades into the "
                "third push."
            ),
            source_refs=["brooks-reversals"],
            questions=[
                "Are pushes weakening?",
                "Is the third push overshooting or undershooting the channel?",
            ],
        ),
        Concept(
            key="wedge",
            name="Wedge Reversal",
            summary=(
                "A wedge is context plus repeated attempts, not geometry alone; "
                "the signal bar and follow-through decide quality."
            ),
            source_refs=["brooks-reversals"],
            questions=[
                "Is there a credible signal bar?",
                "What target is reasonable for the correction?",
            ],
        ),
        Concept(
            key="failed_breakout",
            name="Failed Breakout",
            summary=(
                "A failed breakout can create stronger opposite pressure when "
                "traders are trapped beyond a known level."
            ),
            source_refs=["brooks-trading-ranges", "brooks-reversals"],
            questions=[
                "Where are breakout traders trapped?",
                "Did price re-enter the range decisively?",
            ],
        ),
        Concept(
            key="traders_equation",
            name="Trader's Equation",
            summary=(
                "A trade requires the relationship between probability, risk, "
                "and reward to justify action."
            ),
            source_refs=["brooks-trends", "brooks-trading-ranges", "brooks-reversals"],
            questions=[
                "Is the reward at least enough for this probability?",
                "Where is the invalidation price?",
            ],
        ),
    ]
    dossiers = [
        SetupDossier(
            key="wedge_reversal",
            name="Wedge Reversal",
            context=(
                "Best near a channel extreme, after repeated attempts and "
                "visible momentum loss."
            ),
            observations=[
                "Three pushes are countable",
                "Signal bar closes strongly against the prior move",
            ],
            measurements=[
                "Count each push from swing extreme to swing extreme",
                "Compare leg size and spacing between pushes",
                "Check channel overshoot or undershoot on the third push",
            ],
            entry_styles=[
                "stop entry beyond signal bar",
                "limit entry on pullback after confirmation",
            ],
            stop_logic=[
                "Protect beyond the signal bar or final push extreme",
                "Reduce size if the protective stop is too wide for trader equation",
            ],
            targets=[
                "First target near the prior pullback low or moving-average test",
                "Second target near the start of the wedge when reversal is strong",
            ],
            management=[
                "Exit quickly if reversal follow-through is absent",
                "Hold runner only after a clear opposite always-in transition",
            ],
            failure_modes=[
                "Third push becomes a breakout with follow-through",
                "Signal bar is small in a strong trend",
            ],
            nearby_setups=["failed_breakout", "major_trend_reversal", "final_flag"],
            source_refs=["brooks-reversals"],
        ),
        SetupDossier(
            key="failed_breakout",
            name="Failed Breakout",
            context=(
                "Best at a prior range boundary when price breaks out then "
                "quickly returns inside."
            ),
            observations=["Breakout lacks follow-through", "Re-entry traps breakout traders"],
            measurements=[
                "Mark the prior range boundary",
                "Count bars outside the range before re-entry",
                "Compare breakout bar size with follow-through bars",
            ],
            entry_styles=["enter on re-entry close", "enter on pullback testing the broken level"],
            stop_logic=[
                "Protect beyond the failed breakout extreme",
                "Avoid full size if entry is near the range middle",
            ],
            targets=[
                "Range midpoint for conservative scalps",
                "Opposite range extreme if re-entry is strong",
            ],
            management=[
                "Take partial profits into range middle",
                "Exit if price breaks back outside with consecutive closes",
            ],
            failure_modes=[
                "Breakout resumes with strong consecutive closes",
                "Range was too weakly defined",
            ],
            nearby_setups=["trading_range_scalp", "breakout_pullback", "wedge_reversal"],
            source_refs=["brooks-trading-ranges"],
        ),
    ]
    case_cards = [
        CaseCard(
            key="three_push_channel_overshoot",
            title="Third push overshoots a broad channel",
            source_refs=["brooks-reversals"],
            chart_context=(
                "XAU 5m is climbing in a broad channel after a mature intraday move."
            ),
            pattern_interpretation=(
                "The third push tests above the channel but momentum is weaker "
                "than the prior leg."
            ),
            trader_thinking=(
                "Trend traders hesitate to buy high; countertrend traders wait "
                "for a signal bar and clear invalidation."
            ),
            expected_follow_through=(
                "expected correction toward the prior pullback or channel midline "
                "if sellers get follow-through."
            ),
            failure_scenario=(
                "A strong close above the channel followed by another bull bar "
                "turns the wedge read into a breakout."
            ),
        ),
        CaseCard(
            key="failed_breakout_range_reentry",
            title="Range breakout fails back inside",
            source_refs=["brooks-trading-ranges"],
            chart_context=(
                "A defined XAU 5m range breaks above resistance after several "
                "overlapping bars."
            ),
            pattern_interpretation=(
                "Failure to hold outside the range traps breakout buyers and "
                "can create a move back toward the range middle."
            ),
            trader_thinking=(
                "Scalpers fade the failed breakout; swing traders require enough "
                "reward to the opposite side of the range."
            ),
            expected_follow_through=(
                "A decisive re-entry should test the midpoint and may reach the "
                "opposite extreme."
            ),
            failure_scenario=(
                "If the breakout retests resistance and holds above it, the "
                "failed-breakout premise is invalid."
            ),
        ),
    ]
    playbooks = [
        ReasoningPlaybook(
            key="trade_or_no_trade",
            name="Trade or no-trade decision",
            questions=[
                "What is the current market state?",
                "Is the setup aligned with context or fighting a strong move?",
                "Where is invalidation?",
                "Does the trader's equation justify action?",
            ],
            required_observations=[
                "market state",
                "always-in bias",
                "key levels",
                "setup candidate",
                "failure scenario",
            ],
            invalidation_checks=[
                "price violates protective stop",
                "signal fails to get follow-through",
                "opposite side becomes always-in",
            ],
            display_guardrails=[
                "Show reasoning summary and evidence trail only",
                "Raw hidden chain-of-thought must not be displayed",
            ],
        ),
        ReasoningPlaybook(
            key="wedge_quality",
            name="Wedge quality review",
            questions=[
                "Are there exactly three credible pushes?",
                "Is momentum increasing or fading?",
                "Did the third push overshoot or undershoot a channel?",
                "Is the signal bar strong enough for the risk?",
            ],
            required_observations=[
                "push count",
                "leg comparison",
                "channel relation",
                "signal bar close position",
            ],
            invalidation_checks=[
                "breakout follow-through after third push",
                "weak signal bar in a strong trend",
                "stop distance too large for expected correction",
            ],
            display_guardrails=[
                "Show measurable wedge evidence",
                "Do not present geometry alone as trade justification",
            ],
        ),
    ]
    return KnowledgeArtifact(
        version="2026-06-30.phase-one",
        sources=sources,
        concepts=concepts,
        setup_dossiers=dossiers,
        case_cards=case_cards,
        reasoning_playbooks=playbooks,
    )


def load_committed_artifact() -> KnowledgeArtifact:
    return KnowledgeArtifact.model_validate_json(ARTIFACT_PATH.read_text(encoding="utf-8"))


def write_committed_artifact(path: Path = ARTIFACT_PATH) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = compile_core_knowledge().model_dump(mode="json")
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def main() -> None:
    write_committed_artifact()


if __name__ == "__main__":
    main()
