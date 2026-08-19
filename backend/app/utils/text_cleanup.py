"""
Repairs common "mojibake" — UTF-8 bytes that got misread as Latin-1/
Windows-1252 somewhere upstream (often already baked into a source document
before it was ever scanned/photographed, e.g. copy-pasted from a web page
with a mismatched encoding). OCR faithfully transcribes whatever's visually
on the page, so it reproduces this exactly rather than introducing it.

Applied as a targeted replace of the handful of sequences that account for
the vast majority of real-world cases, rather than a blanket re-decode
attempt — OCR text here is often multi-script (e.g. Korean + Latin digits
in the same string), and Latin-1 re-decoding a string containing non-Latin-1
characters would just raise, not help.
"""
import re

_MOJIBAKE_REPLACEMENTS = {
    "Â°": "°",
    "â€™": "’",  # right single quote
    "â€˜": "‘",  # left single quote
    "â€œ": "“",  # left double quote
    "â€\x9d": "”",  # right double quote
    "â€“": "–",  # en dash
    "â€”": "—",  # em dash
    "â€¦": "…",  # ellipsis
    "Â ": " ",  # non-breaking space misread as "Â" + space
    "Ã©": "é",
    "Ã¨": "è",
    "Ã±": "ñ",
    "Ã¼": "ü",
    "Ã¶": "ö",
    "Ã¤": "ä",
}

_MOJIBAKE_PATTERN = re.compile("|".join(re.escape(k) for k in _MOJIBAKE_REPLACEMENTS))


def fix_common_mojibake(text: str) -> str:
    if "Â" not in text and "â€" not in text and "Ã" not in text:
        return text
    return _MOJIBAKE_PATTERN.sub(lambda m: _MOJIBAKE_REPLACEMENTS[m.group(0)], text)
