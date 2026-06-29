from paquant.knowledge_layer.compiler import compile_core_knowledge
from paquant.knowledge_layer.retrieval import retrieve_relevant_knowledge


def test_retrieval_returns_ranked_source_linked_references():
    artifact = compile_core_knowledge()

    references = retrieve_relevant_knowledge(
        artifact,
        query="three push wedge channel overshoot trader equation",
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
    assert any("wedge" in reference.title.lower() for reference in references)
