"""
PDF vs PDF comparison backing /api/pdf/compare.

A true visual/pixel diff needs a page-image viewer this app doesn't have
yet, so this compares extracted text instead — line-level diffing via
Python's stdlib `difflib`, the same algorithm behind `diff`/git's line
diff. Text is extracted per page with a page-marker line injected between
pages, so the diff naturally shows which page a change falls on even when
whole pages were added or removed (SequenceMatcher aligns around the
marker lines like any other line, rather than assuming both documents
have the same page count).

Like extract_tables/markdown_ops, this reads each PDF's own text layer —
a scanned/photographed PDF with no text layer can't be compared this way.
"""
import difflib

import fitz  # PyMuPDF


class CompareToolError(RuntimeError):
    """Raised when a PDF can't be compared — callers turn this into a 400."""


def _page_marked_lines(file_bytes: bytes, label: str) -> list[str]:
    try:
        doc = fitz.open(stream=file_bytes, filetype="pdf")
    except Exception as exc:
        raise CompareToolError(f"Couldn't read {label} as a PDF: {exc}") from exc

    try:
        lines: list[str] = []
        has_text = False
        for page_index, page in enumerate(doc):
            lines.append(f"===== Page {page_index + 1} =====")
            page_lines = [line for line in page.get_text().splitlines() if line.strip()]
            if page_lines:
                has_text = True
            lines.extend(page_lines)
        if not has_text:
            raise CompareToolError(
                f"{label} has no selectable text — it looks like a scan or photo. "
                "Run it through OCR PDF first, then compare the results."
            )
        return lines
    finally:
        doc.close()


def compare_pdfs(file_bytes_a: bytes, file_bytes_b: bytes) -> list[dict]:
    lines_a = _page_marked_lines(file_bytes_a, "The first file")
    lines_b = _page_marked_lines(file_bytes_b, "The second file")

    matcher = difflib.SequenceMatcher(None, lines_a, lines_b, autojunk=False)
    return [
        {"type": tag, "a_lines": lines_a[i1:i2], "b_lines": lines_b[j1:j2]}
        for tag, i1, i2, j1, j2 in matcher.get_opcodes()
    ]
