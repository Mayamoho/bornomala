#!/usr/bin/env python3
"""Stream a Bangla Wikipedia pages-articles dump into plain text lines.

Reads the .bz2 without ever unpacking the ~2.5GB XML to disk. Emits one
cleaned line per output line, NFC-normalised, Bangla-dominant lines only.

    python3 clean_wiki.py raw/bnwiki-pages-articles.xml.bz2 clean/wiki-bn.txt
"""

import bz2
import re
import sys
import unicodedata
import xml.etree.ElementTree as ET

BANGLA = re.compile(r"[ঀ-৿]")

# Order matters: refs and templates first, then links, then leftovers.
SUBS = [
    (re.compile(r"<ref[^>]*/>", re.S), " "),
    (re.compile(r"<ref[^>]*>.*?</ref>", re.S), " "),
    (re.compile(r"<!--.*?-->", re.S), " "),
    (re.compile(r"<[^>]+>"), " "),
    (re.compile(r"^\s*[|!{].*$", re.M), " "),          # table rows
    (re.compile(r"\[\[[^\]|]*:[^\]]*\]\]"), " "),      # File:, Category:, interwiki
    (re.compile(r"\[\[[^\]|]*\|([^\]]*)\]\]"), r"\1"), # piped link -> label
    (re.compile(r"\[\[([^\]]*)\]\]"), r"\1"),
    (re.compile(r"\[https?://\S+\s([^\]]*)\]"), r"\1"),
    (re.compile(r"https?://\S+"), " "),
    (re.compile(r"^[=]{2,}.*$", re.M), " "),           # headings
    (re.compile(r"'{2,}"), ""),
    (re.compile(r"^[*#:;]+", re.M), " "),
]

TEMPLATE_OPEN = "{{"
TEMPLATE_CLOSE = "}}"


def strip_templates(text: str) -> str:
    """Remove {{...}} including nested ones. Regex cannot nest; a counter can."""
    out = []
    depth = 0
    i = 0
    n = len(text)
    while i < n:
        if text.startswith(TEMPLATE_OPEN, i):
            depth += 1
            i += 2
        elif text.startswith(TEMPLATE_CLOSE, i):
            depth = max(0, depth - 1)
            i += 2
        else:
            if depth == 0:
                out.append(text[i])
            i += 1
    return "".join(out)


def clean(text: str) -> str:
    text = strip_templates(text)
    for pattern, repl in SUBS:
        text = pattern.sub(repl, text)
    return text


def bangla_ratio(line: str) -> float:
    letters = [c for c in line if not c.isspace()]
    if not letters:
        return 0.0
    return sum(1 for c in letters if BANGLA.match(c)) / len(letters)


def pages(path):
    """Yield article wikitext for namespace-0, non-redirect pages."""
    with bz2.open(path, "rb") as fh:
        title = ns = text = None
        redirect = False
        for event, elem in ET.iterparse(fh, events=("end",)):
            tag = elem.tag.split("}")[-1]
            if tag == "ns":
                ns = elem.text
            elif tag == "redirect":
                redirect = True
            elif tag == "title":
                title = elem.text
            elif tag == "text":
                text = elem.text
            elif tag == "page":
                if ns == "0" and not redirect and text:
                    yield title, text
                title = ns = text = None
                redirect = False
                elem.clear()


def main() -> int:
    if len(sys.argv) != 3:
        print(__doc__, file=sys.stderr)
        return 2
    src, dst = sys.argv[1], sys.argv[2]
    kept = seen = 0
    with open(dst, "w", encoding="utf-8") as out:
        for _title, wikitext in pages(src):
            for raw in clean(wikitext).split("\n"):
                line = unicodedata.normalize("NFC", " ".join(raw.split()))
                seen += 1
                if len(line) < 20 or bangla_ratio(line) < 0.6:
                    continue
                out.write(line + "\n")
                kept += 1
    print(f"kept {kept} of {seen} candidate lines -> {dst}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
