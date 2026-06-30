from __future__ import annotations

import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from paquant.knowledge_layer.compiler import KnowledgeArtifact

_TOKEN_PATTERN = re.compile(r"[a-z0-9']+|[\u4e00-\u9fff]+")


class KnowledgeReference(BaseModel):
    model_config = ConfigDict(frozen=True)

    artifact_type: Literal["concept", "setup_dossier", "case_card", "reasoning_playbook"]
    key: str
    title: str
    summary: str
    source_refs: list[str]
    score: int = Field(ge=0)


def retrieve_relevant_knowledge(
    artifact: KnowledgeArtifact,
    *,
    query: str,
    limit: int = 5,
) -> list[KnowledgeReference]:
    query_tokens = _tokens(query)
    if not query_tokens or limit <= 0:
        return []

    references: list[KnowledgeReference] = []
    for concept in artifact.concepts:
        score = _score(
            query_tokens, " ".join([concept.key, concept.name, concept.summary, *concept.questions])
        )
        if score:
            references.append(
                KnowledgeReference(
                    artifact_type="concept",
                    key=concept.key,
                    title=concept.name,
                    summary=concept.summary,
                    source_refs=concept.source_refs,
                    score=score,
                )
            )

    for dossier in artifact.setup_dossiers:
        text = " ".join(
            [
                dossier.name,
                dossier.key,
                dossier.context,
                *dossier.observations,
                *dossier.measurements,
                *dossier.entry_styles,
                *dossier.stop_logic,
                *dossier.targets,
                *dossier.management,
                *dossier.failure_modes,
                *dossier.nearby_setups,
            ]
        )
        score = _score(query_tokens, text)
        if score:
            references.append(
                KnowledgeReference(
                    artifact_type="setup_dossier",
                    key=dossier.key,
                    title=dossier.name,
                    summary=dossier.context,
                    source_refs=dossier.source_refs,
                    score=score,
                )
            )

    for case in artifact.case_cards:
        text = " ".join(
            [
                case.title,
                case.key,
                case.diagram.kind,
                case.chart_context,
                case.pattern_interpretation,
                case.trader_thinking,
                case.expected_follow_through,
                case.failure_scenario,
            ]
        )
        score = _score(query_tokens, text)
        if score:
            references.append(
                KnowledgeReference(
                    artifact_type="case_card",
                    key=case.key,
                    title=case.title,
                    summary=case.pattern_interpretation,
                    source_refs=case.source_refs,
                    score=score,
                )
            )

    source_ids = [source.id for source in artifact.sources]
    for playbook in artifact.reasoning_playbooks:
        text = " ".join(
            [
                playbook.name,
                playbook.key,
                *playbook.questions,
                *playbook.required_observations,
                *playbook.invalidation_checks,
            ]
        )
        score = _score(query_tokens, text)
        if score:
            references.append(
                KnowledgeReference(
                    artifact_type="reasoning_playbook",
                    key=playbook.key,
                    title=playbook.name,
                    summary=playbook.questions[0],
                    source_refs=source_ids,
                    score=score,
                )
            )

    return sorted(
        references,
        key=lambda reference: (-reference.score, reference.artifact_type, reference.key),
    )[:limit]


def _tokens(text: str) -> set[str]:
    return set(_TOKEN_PATTERN.findall(text.lower()))


def _score(query_tokens: set[str], text: str) -> int:
    haystack = text.lower()
    return sum(1 for token in query_tokens if token in haystack)
