from paquant.knowledge_layer.compiler import compile_core_knowledge
from paquant.knowledge_layer.retrieval import retrieve_relevant_knowledge


def test_retrieval_returns_ranked_source_linked_references():
    artifact = compile_core_knowledge()

    references = retrieve_relevant_knowledge(
        artifact,
        query="three push wedge 楔形 三推 channel overshoot trader equation",
        limit=4,
    )

    assert references
    assert len(references) <= 4
    assert references[0].score >= references[-1].score
    assert all(reference.source_refs for reference in references)
    assert {reference.artifact_type for reference in references} & {
        "concept",
        "setup_dossier",
        "case_card",
    }
    assert any(
        reference.key in {"wedge", "wedge_reversal", "three_push_channel_overshoot"}
        or "楔形" in reference.title
        for reference in references
    )


def test_retrieval_supports_chinese_price_action_terms():
    artifact = compile_core_knowledge()

    references = retrieve_relevant_knowledge(
        artifact,
        query="楔形 三推 过冲 交易员方程",
        limit=5,
    )

    assert references
    assert any(reference.key in {"wedge", "wedge_reversal"} for reference in references)
    assert any("三推" in reference.title or "三推" in reference.summary for reference in references)
