import json

from paquant.knowledge_layer.source_catalog import (
    catalog_local_pdfs,
    expected_brooks_sources,
    extract_chapter_refs,
)


def test_expected_brooks_sources_match_compiled_source_ids():
    sources = expected_brooks_sources()

    assert [source.id for source in sources] == [
        "brooks-trends",
        "brooks-trading-ranges",
        "brooks-reversals",
    ]
    assert all(source.source_type == "local_pdf" for source in sources)
    assert all(source.raw_pdf_commit_policy == "local_only_ignored" for source in sources)


def test_extract_chapter_refs_from_fake_pdf_text():
    refs = extract_chapter_refs(
        source_id="brooks-trends",
        text="""
        Chapter 1: Price Action Fundamentals
        This paragraph must not be copied into the catalog.
        CHAPTER 2 Trend from the Open
        Chapter 3 - Channels and Broad Channels
        """,
    )

    assert [ref.title for ref in refs] == [
        "Price Action Fundamentals",
        "Trend from the Open",
        "Channels and Broad Channels",
    ]
    assert refs[0].chapter_number == 1
    assert refs[2].source_id == "brooks-trends"


def test_catalog_local_pdfs_keeps_metadata_without_raw_text(tmp_path):
    pdf_path = tmp_path / "Trading Price Action Trends.pdf"
    pdf_path.write_bytes(b"%PDF fake brooks trends")

    def fake_extractor(path):
        assert path == pdf_path
        return """
        Chapter 1: Price Action Fundamentals
        Raw hidden book paragraph that should never be serialized.
        Chapter 2: Trend from the Open
        """

    catalog = catalog_local_pdfs(
        [pdf_path],
        expected_sources=expected_brooks_sources()[:1],
        extract_text=fake_extractor,
    )
    payload = catalog.model_dump(mode="json")
    serialized = json.dumps(payload)

    assert payload["sources"][0]["id"] == "brooks-trends"
    assert payload["sources"][0]["sha256"]
    assert [chapter["title"] for chapter in payload["chapter_refs"]] == [
        "Price Action Fundamentals",
        "Trend from the Open",
    ]
    assert "Raw hidden book paragraph" not in serialized
