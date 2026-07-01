from paquant.knowledge_layer.compiler import compile_core_knowledge, load_committed_artifact


def test_core_knowledge_contains_brooks_taste():
    artifact = compile_core_knowledge()
    keys = {concept.key for concept in artifact.concepts}

    assert {
        "context",
        "always_in",
        "signal_bar",
        "entry_bar",
        "three_push",
        "traders_equation",
    } <= keys
    source_types = {source.source_type for source in artifact.sources}
    assert {"local_pdf", "official_web"} <= source_types
    assert all(source.title for source in artifact.sources)
    assert all(source.chapter_refs for source in artifact.sources)
    assert all("raw_text" not in concept.model_fields_set for concept in artifact.concepts)
    three_push = next(concept for concept in artifact.concepts if concept.key == "three_push")
    assert "间距" in three_push.summary
    assert "动能" in three_push.summary
    assert artifact.chapter_map
    assert artifact.concept_edges


def test_committed_artifact_loads_and_has_setup_dossiers():
    artifact = load_committed_artifact()

    assert artifact.version == "2026-06-30.phase-one"
    assert {dossier.key for dossier in artifact.setup_dossiers} >= {
        "always_in_pullback",
        "second_entry",
        "breakout_pullback",
        "trading_range_scalp",
        "wedge_reversal",
        "failed_breakout",
        "major_trend_reversal",
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
    assert "预期修正" in case.expected_follow_through

    playbook = next(
        playbook for playbook in artifact.reasoning_playbooks if playbook.key == "trade_or_no_trade"
    )
    assert "当前市场状态是什么？" in playbook.questions
    assert any("chain-of-thought" in guardrail for guardrail in playbook.display_guardrails)


def test_case_cards_include_structured_visual_diagrams():
    artifact = compile_core_knowledge()

    for case in artifact.case_cards:
        assert case.diagram.kind in {"wedge", "failed_breakout"}
        assert case.diagram.caption
        assert len(case.diagram.points) >= 4
        assert case.diagram.levels
        assert all(point.label for point in case.diagram.points)
        assert all(0 <= point.x <= 100 for point in case.diagram.points)
        assert all(0 <= point.y <= 100 for point in case.diagram.points)


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


def test_glossary_preserves_checked_chinese_terms():
    artifact = compile_core_knowledge()
    terms = {term.english: term for term in artifact.glossary}

    assert terms["Signal Bar"].chinese == "信号K线"
    assert terms["Entry Bar"].chinese == "入场K线"
    assert terms["Trading Range"].abbreviation == "TR"
    assert terms["Failed Breakout"].abbreviation == "FBO"
    assert "brooks-official" in " ".join(terms["Signal Bar"].source_refs)
    assert any(source.id == "brooks-official-glossary" for source in artifact.sources)
    assert any(source.id == "brooks-official-abbreviations" for source in artifact.sources)
