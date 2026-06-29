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
    entry_styles: list[str]
    failure_modes: list[str]
    source_refs: list[str]


class KnowledgeArtifact(BaseModel):
    model_config = ConfigDict(frozen=True)

    version: str
    sources: list[KnowledgeSource]
    concepts: list[Concept]
    setup_dossiers: list[SetupDossier]


def compile_core_knowledge() -> KnowledgeArtifact:
    sources = [
        KnowledgeSource(
            id="brooks-trends",
            title="Trading Price Action - Trends",
            source_type="local_pdf",
            themes=["trend", "channel", "always-in", "pullback quality"],
        ),
        KnowledgeSource(
            id="brooks-trading-ranges",
            title="Trading Price Action - Trading Ranges",
            source_type="local_pdf",
            themes=["trading range", "failed breakout", "buy low sell high"],
        ),
        KnowledgeSource(
            id="brooks-reversals",
            title="Trading Price Action - Reversals",
            source_type="local_pdf",
            themes=["wedge", "three pushes", "failed reversal", "exhaustion"],
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
                "especially with spacing or momentum change."
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
            entry_styles=[
                "stop entry beyond signal bar",
                "limit entry on pullback after confirmation",
            ],
            failure_modes=[
                "Third push becomes a breakout with follow-through",
                "Signal bar is small in a strong trend",
            ],
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
            entry_styles=["enter on re-entry close", "enter on pullback testing the broken level"],
            failure_modes=[
                "Breakout resumes with strong consecutive closes",
                "Range was too weakly defined",
            ],
            source_refs=["brooks-trading-ranges"],
        ),
    ]
    return KnowledgeArtifact(
        version="2026-06-30.phase-one",
        sources=sources,
        concepts=concepts,
        setup_dossiers=dossiers,
    )


def load_committed_artifact() -> KnowledgeArtifact:
    return KnowledgeArtifact.model_validate_json(ARTIFACT_PATH.read_text(encoding="utf-8"))


def write_committed_artifact(path: Path = ARTIFACT_PATH) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = compile_core_knowledge().model_dump(mode="json")
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
