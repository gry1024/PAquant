from __future__ import annotations

import hashlib
import re
from collections.abc import Callable, Iterable
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict


class BrooksSourceSpec(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: str
    title: str
    source_type: Literal["local_pdf"] = "local_pdf"
    filename_hint: str
    themes: list[str]
    raw_pdf_commit_policy: Literal["local_only_ignored"] = "local_only_ignored"


class CatalogedSource(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: str
    title: str
    source_type: Literal["local_pdf"]
    filename: str
    sha256: str
    byte_size: int
    themes: list[str]
    raw_pdf_commit_policy: Literal["local_only_ignored"]


class ChapterRef(BaseModel):
    model_config = ConfigDict(frozen=True)

    source_id: str
    chapter_number: int
    title: str


class SourceCatalog(BaseModel):
    model_config = ConfigDict(frozen=True)

    sources: list[CatalogedSource]
    chapter_refs: list[ChapterRef]


PdfTextExtractor = Callable[[Path], str]

_CHAPTER_PATTERN = re.compile(
    r"^\s*chapter\s+(?P<number>\d+)\s*(?::|-)?\s*(?P<title>.+?)\s*$",
    re.IGNORECASE,
)


def expected_brooks_sources() -> list[BrooksSourceSpec]:
    return [
        BrooksSourceSpec(
            id="brooks-trends",
            title="Trading Price Action - Trends",
            filename_hint="trends",
            themes=["trend", "channel", "always-in", "pullback quality"],
        ),
        BrooksSourceSpec(
            id="brooks-trading-ranges",
            title="Trading Price Action - Trading Ranges",
            filename_hint="range",
            themes=["trading range", "failed breakout", "support resistance"],
        ),
        BrooksSourceSpec(
            id="brooks-reversals",
            title="Trading Price Action - Reversals",
            filename_hint="reversal",
            themes=["wedge", "three pushes", "exhaustion", "final flag"],
        ),
    ]


def extract_chapter_refs(*, source_id: str, text: str) -> list[ChapterRef]:
    refs: list[ChapterRef] = []
    seen: set[tuple[int, str]] = set()
    for line in text.splitlines():
        match = _CHAPTER_PATTERN.match(line)
        if not match:
            continue
        chapter_number = int(match.group("number"))
        title = _clean_title(match.group("title"))
        key = (chapter_number, title)
        if key in seen:
            continue
        seen.add(key)
        refs.append(
            ChapterRef(
                source_id=source_id,
                chapter_number=chapter_number,
                title=title,
            )
        )
    return refs


def catalog_local_pdfs(
    pdf_paths: Iterable[Path],
    *,
    expected_sources: list[BrooksSourceSpec] | None = None,
    extract_text: PdfTextExtractor,
) -> SourceCatalog:
    specs = expected_sources or expected_brooks_sources()
    sources: list[CatalogedSource] = []
    chapter_refs: list[ChapterRef] = []
    for spec in specs:
        path = _match_source_path(pdf_paths, spec)
        digest = _sha256(path)
        sources.append(
            CatalogedSource(
                id=spec.id,
                title=spec.title,
                source_type=spec.source_type,
                filename=path.name,
                sha256=digest,
                byte_size=path.stat().st_size,
                themes=spec.themes,
                raw_pdf_commit_policy=spec.raw_pdf_commit_policy,
            )
        )
        chapter_refs.extend(extract_chapter_refs(source_id=spec.id, text=extract_text(path)))
    return SourceCatalog(sources=sources, chapter_refs=chapter_refs)


def _match_source_path(pdf_paths: Iterable[Path], spec: BrooksSourceSpec) -> Path:
    normalized_hint = spec.filename_hint.lower()
    for path in pdf_paths:
        if normalized_hint in path.name.lower():
            return path
    raise ValueError(f"missing local Brooks PDF for source: {spec.id}")


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _clean_title(value: str) -> str:
    return " ".join(value.strip().strip(".").split())
