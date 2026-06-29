from paquant.knowledge_layer.compiler import compile_core_knowledge, load_committed_artifact


def test_core_knowledge_contains_brooks_taste():
    artifact = compile_core_knowledge()
    keys = {concept.key for concept in artifact.concepts}

    assert {"context", "always_in", "three_push", "traders_equation"} <= keys
    assert all(source.title and source.source_type == "local_pdf" for source in artifact.sources)
    assert all("raw_text" not in concept.model_fields_set for concept in artifact.concepts)


def test_committed_artifact_loads_and_has_setup_dossiers():
    artifact = load_committed_artifact()

    assert artifact.version == "2026-06-30.phase-one"
    assert {dossier.key for dossier in artifact.setup_dossiers} >= {
        "wedge_reversal",
        "failed_breakout",
    }
