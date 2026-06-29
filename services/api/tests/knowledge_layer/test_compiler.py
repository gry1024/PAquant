from paquant.knowledge_layer.compiler import compile_core_knowledge, load_committed_artifact


def test_core_knowledge_contains_brooks_taste():
    artifact = compile_core_knowledge()
    keys = {concept.key for concept in artifact.concepts}

    assert {"context", "always_in", "three_push", "traders_equation"} <= keys
    assert all(source.title and source.source_type == "local_pdf" for source in artifact.sources)
    assert all(source.chapter_refs for source in artifact.sources)
    assert all("raw_text" not in concept.model_fields_set for concept in artifact.concepts)
    three_push = next(concept for concept in artifact.concepts if concept.key == "three_push")
    assert "spacing" in three_push.summary
    assert "momentum" in three_push.summary


def test_committed_artifact_loads_and_has_setup_dossiers():
    artifact = load_committed_artifact()

    assert artifact.version == "2026-06-30.phase-one"
    assert {dossier.key for dossier in artifact.setup_dossiers} >= {
        "wedge_reversal",
        "failed_breakout",
    }


def test_core_knowledge_contains_case_cards_and_playbooks():
    artifact = compile_core_knowledge()

    assert {case.key for case in artifact.case_cards} >= {
        "three_push_channel_overshoot",
        "failed_breakout_range_reentry",
    }
    case = next(case for case in artifact.case_cards if case.key == "three_push_channel_overshoot")
    assert case.source_refs == ["brooks-reversals"]
    assert case.failure_scenario
    assert "expected correction" in case.expected_follow_through

    playbook = next(
        playbook for playbook in artifact.reasoning_playbooks if playbook.key == "trade_or_no_trade"
    )
    assert "What is the current market state?" in playbook.questions
    assert any(
        "Raw hidden chain-of-thought" in guardrail
        for guardrail in playbook.display_guardrails
    )


def test_setup_dossiers_preserve_trade_management_detail():
    artifact = compile_core_knowledge()
    dossier = next(
        dossier for dossier in artifact.setup_dossiers if dossier.key == "wedge_reversal"
    )

    assert dossier.measurements
    assert dossier.stop_logic
    assert dossier.targets
    assert dossier.management
    assert "failed_breakout" in dossier.nearby_setups
