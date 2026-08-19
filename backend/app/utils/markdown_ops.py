"""
PDF -> Markdown conversion backing /api/pdf/to-markdown.

Uses `pymupdf4llm` (from the PyMuPDF team, purpose-built for this exact
conversion) rather than hand-rolling font-size heuristics — it already
reconstructs headings (from relative font size), paragraphs, and tables
into clean Markdown, and takes an in-memory fitz.Document directly so no
temp file is needed.

Like pdf2docx, it works off the PDF's existing text layer only — a
scanned/photographed PDF with no text layer converts to an empty string,
which callers should detect via app.utils.pdf_ops.extract_text_layer
before choosing whether to route through OCR instead.
"""
import fitz  # PyMuPDF
import pymupdf4llm


class MarkdownToolError(RuntimeError):
    """Raised when a PDF can't be converted to Markdown — callers turn
    this into a 400."""


def pdf_to_markdown(file_bytes: bytes) -> str:
    try:
        doc = fitz.open(stream=file_bytes, filetype="pdf")
    except Exception as exc:
        raise MarkdownToolError(f"Couldn't read this file as a PDF: {exc}") from exc

    try:
        return pymupdf4llm.to_markdown(doc)
    except Exception as exc:
        raise MarkdownToolError(f"Markdown conversion failed: {exc}") from exc
    finally:
        doc.close()
