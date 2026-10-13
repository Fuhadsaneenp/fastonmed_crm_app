#!/usr/bin/env python3
"""Recover published Fastonmed page copy from a WordPress SQL backup."""

from __future__ import annotations

import argparse
import html
import importlib.util
import json
import re
from html.parser import HTMLParser
from pathlib import Path


class ContentParser(HTMLParser):
    wanted = {"h1", "h2", "h3", "p", "li"}

    def __init__(self) -> None:
        super().__init__()
        self.current: str | None = None
        self.depth = 0
        self.buffer: list[str] = []
        self.items: list[tuple[str, str]] = []

    def handle_starttag(self, tag: str, _attrs) -> None:
        if tag in self.wanted and self.current is None:
            self.current, self.depth, self.buffer = tag, 1, []
        elif self.current:
            self.depth += 1

    def handle_endtag(self, tag: str) -> None:
        if not self.current:
            return
        self.depth -= 1
        if tag == self.current and self.depth == 0:
            text = re.sub(r"\s+", " ", html.unescape("".join(self.buffer))).strip()
            if text:
                self.items.append((self.current, text))
            self.current, self.buffer = None, []

    def handle_data(self, data: str) -> None:
        if self.current:
            self.buffer.append(data)


def load_importer(script: Path):
    spec = importlib.util.spec_from_file_location("wordpress_import", script)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


def unique(values: list[str]) -> list[str]:
    seen, result = set(), []
    for value in values:
        key = value.casefold()
        if key not in seen:
            seen.add(key)
            result.append(value)
    return result


def convert(title: str, source: str) -> dict:
    parser = ContentParser()
    parser.feed(source)
    items = parser.items
    page_title = next((text for tag, text in items if tag == "h1"), html.unescape(title))
    first_h2 = next((i for i, (tag, _) in enumerate(items) if tag == "h2"), len(items))
    intro = unique([text for tag, text in items[:first_h2] if tag == "p" and len(text) > 35])
    sections, current = [], None
    for tag, text in items[first_h2:]:
        if tag == "h2":
            if current and (current["paragraphs"] or current["points"]):
                sections.append(current)
            current = {"title": text, "paragraphs": [], "points": []}
        elif current and tag == "p" and len(text) > 25:
            current["paragraphs"].append(text)
        elif current and tag in {"h3", "li"} and 2 < len(text) < 240:
            current["points"].append(text)
    if current and (current["paragraphs"] or current["points"]):
        sections.append(current)
    cleaned = []
    for section in sections:
        section["paragraphs"] = unique(section["paragraphs"])
        section["points"] = unique(section["points"])
        if not section["points"]:
            section.pop("points")
        cleaned.append(section)
    if not cleaned:
        cleaned = [{"title": page_title, "paragraphs": intro or [page_title]}]
    return {
        "title": page_title,
        "eyebrow": "Fastonmed UAE",
        "description": " ".join(intro[:2]) or next((p for s in cleaned for p in s["paragraphs"]), page_title),
        "sections": cleaned,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--database", required=True, type=Path)
    parser.add_argument("--importer", required=True, type=Path)
    parser.add_argument("--slugs", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    importer = load_importer(args.importer)
    wanted = set(json.loads(args.slugs.read_text())["slugs"])
    pages = {}
    for row in importer.table_rows(args.database, "wp_posts"):
        if len(row) < 23 or row[20] != "page" or row[7] != "publish" or row[11] not in wanted:
            continue
        pages[row[11]] = convert(row[5], row[4])
    missing = sorted(wanted - pages.keys())
    args.output.write_text(json.dumps(pages, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"extracted": len(pages), "missing": missing}, indent=2))


if __name__ == "__main__":
    main()
