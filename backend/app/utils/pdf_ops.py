"""
Pure PDF-manipulation operations backing the /api/pdf/* tool endpoints.

All functions take and return raw bytes (never touch FastAPI/Pydantic), so
they're independently testable and mirror the style of type_validation.py.
Built on PyMuPDF (fitz) — the one library in this stack that covers page
structure edits, encryption, and raster conversion (PDF<->JPG) without a
second dependency or an external system binary (Poppler/qpdf).
"""
import io
import zipfile

import fitz  # PyMuPDF
from PIL import Image, ImageOps


class PDFToolError(RuntimeError):
    """Raised when a PDF operation can't be completed (bad input, wrong
    password, invalid page range, etc.) — callers turn this into a 400."""


def _open(file_bytes: bytes) -> fitz.Document:
    try:
        doc = fitz.open(stream=file_bytes, filetype="pdf")
    except Exception as exc:  # PyMuPDF raises plain Exception/RuntimeError on bad input
        raise PDFToolError(f"Couldn't read this file as a PDF: {exc}") from exc
    if doc.is_encrypted:
        raise PDFToolError(
            "This PDF is password-protected. Use Unlock PDF first."
        )
    return doc


def _resolve_page_indices(doc: fitz.Document, pages: list[int] | None) -> list[int]:
    """1-based page numbers from the caller -> validated 0-based indices."""
    if pages is None:
        return list(range(doc.page_count))
    indices = []
    for p in pages:
        if p < 1 or p > doc.page_count:
            raise PDFToolError(
                f"Page {p} is out of range — this document has {doc.page_count} page(s)."
            )
        indices.append(p - 1)
    return indices


def merge_pdfs(file_bytes_list: list[bytes]) -> bytes:
    if len(file_bytes_list) < 2:
        raise PDFToolError("Upload at least two PDFs to merge.")
    merged = fitz.open()
    for file_bytes in file_bytes_list:
        with _open(file_bytes) as doc:
            merged.insert_pdf(doc)
    try:
        return merged.tobytes()
    finally:
        merged.close()


def split_pdf(file_bytes: bytes, ranges: list[tuple[int, int]]) -> list[bytes]:
    if not ranges:
        raise PDFToolError("Provide at least one page range to split on.")
    with _open(file_bytes) as doc:
        outputs = []
        for start, end in ranges:
            if start < 1 or end > doc.page_count or start > end:
                raise PDFToolError(
                    f"Range {start}-{end} is invalid for a {doc.page_count}-page document."
                )
            part = fitz.open()
            part.insert_pdf(doc, from_page=start - 1, to_page=end - 1)
            outputs.append(part.tobytes())
            part.close()
        return outputs


def rotate_pdf(file_bytes: bytes, degrees: int, pages: list[int] | None) -> bytes:
    if degrees % 90 != 0:
        raise PDFToolError("Rotation must be a multiple of 90 degrees.")
    with _open(file_bytes) as doc:
        for idx in _resolve_page_indices(doc, pages):
            page = doc[idx]
            page.set_rotation((page.rotation + degrees) % 360)
        return doc.tobytes()


def reorder_pages(file_bytes: bytes, page_order: list[int]) -> bytes:
    if not page_order:
        raise PDFToolError("Provide the final page order (e.g. 3,1,2).")
    with _open(file_bytes) as doc:
        indices = _resolve_page_indices(doc, page_order)
        doc.select(indices)
        return doc.tobytes()


def crop_pdf(
    file_bytes: bytes, left: float, top: float, right: float, bottom: float, pages: list[int] | None
) -> bytes:
    if left < 0 or top < 0 or right < 0 or bottom < 0:
        raise PDFToolError("Crop margins must be zero or positive.")
    with _open(file_bytes) as doc:
        for idx in _resolve_page_indices(doc, pages):
            page = doc[idx]
            rect = page.rect
            new_rect = fitz.Rect(
                rect.x0 + left, rect.y0 + top, rect.x1 - right, rect.y1 - bottom
            )
            if new_rect.is_empty or new_rect.width <= 0 or new_rect.height <= 0:
                raise PDFToolError(
                    f"Crop margins are larger than page {idx + 1} itself."
                )
            page.set_cropbox(new_rect)
        return doc.tobytes()


_POSITION_POINTS = {
    "top-left": lambda r, m: (m, m),
    "top-right": lambda r, m: (r.width - m, m),
    "bottom-left": lambda r, m: (m, r.height - m),
    "bottom-right": lambda r, m: (r.width - m, r.height - m),
    "center": lambda r, m: (r.width / 2, r.height / 2),
}


def add_page_numbers(file_bytes: bytes, position: str, start_number: int) -> bytes:
    if position not in _POSITION_POINTS:
        raise PDFToolError(f"Unknown position '{position}'.")
    with _open(file_bytes) as doc:
        for i, page in enumerate(doc):
            x, y = _POSITION_POINTS[position](page.rect, 24)
            page.insert_text(
                (x, y), str(start_number + i), fontsize=10, color=(0, 0, 0)
            )
        return doc.tobytes()


def add_watermark(
    file_bytes: bytes,
    text: str | None,
    image_bytes: bytes | None,
    opacity: float,
    position: str,
) -> bytes:
    if not text and not image_bytes:
        raise PDFToolError("Provide watermark text or an image.")
    if not (0.0 <= opacity <= 1.0):
        raise PDFToolError("Opacity must be between 0 and 1.")
    if position not in _POSITION_POINTS:
        raise PDFToolError(f"Unknown position '{position}'.")

    with _open(file_bytes) as doc:
        for page in doc:
            rect = page.rect
            if image_bytes:
                w, h = rect.width * 0.3, rect.height * 0.3
                cx, cy = _POSITION_POINTS[position](rect, 0)
                target = fitz.Rect(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2)
                page.insert_image(target, stream=image_bytes, overlay=True)
            else:
                # insert_text's own `rotate` only accepts axis-aligned values
                # (0/90/180/270) — an arbitrary 45-degree diagonal needs the
                # lower-level `morph` (fixpoint, matrix) rotation instead.
                center = fitz.Point(rect.width / 4, rect.height / 2)
                page.insert_text(
                    center,
                    text,
                    fontsize=40,
                    color=(0.6, 0.6, 0.6),
                    fill_opacity=opacity,
                    morph=(center, fitz.Matrix(45)),
                )
        return doc.tobytes()


def protect_pdf(file_bytes: bytes, password: str) -> bytes:
    if not password:
        raise PDFToolError("Provide a password to protect this PDF with.")
    with _open(file_bytes) as doc:
        doc.save(
            (buf := io.BytesIO()),
            encryption=fitz.PDF_ENCRYPT_AES_256,
            owner_pw=password,
            user_pw=password,
        )
        return buf.getvalue()


def unlock_pdf(file_bytes: bytes, password: str) -> bytes:
    try:
        doc = fitz.open(stream=file_bytes, filetype="pdf")
    except Exception as exc:
        raise PDFToolError(f"Couldn't read this file as a PDF: {exc}") from exc

    if doc.is_encrypted:
        if not doc.authenticate(password):
            raise PDFToolError("Incorrect password.")
    try:
        return doc.tobytes()
    finally:
        doc.close()


def pdf_to_images(file_bytes: bytes, dpi: int) -> list[bytes]:
    if dpi < 50 or dpi > 600:
        raise PDFToolError("dpi must be between 50 and 600.")
    with _open(file_bytes) as doc:
        images = []
        for page in doc:
            pix = page.get_pixmap(dpi=dpi)
            images.append(pix.tobytes("jpeg"))
        return images


def images_to_pdf(image_bytes_list: list[bytes]) -> bytes:
    if not image_bytes_list:
        raise PDFToolError("Upload at least one image.")
    doc = fitz.open()
    try:
        for image_bytes in image_bytes_list:
            try:
                img = fitz.open(stream=image_bytes, filetype="image")
            except Exception as exc:
                raise PDFToolError(f"Couldn't read one of the images: {exc}") from exc
            with img:
                rect = img[0].rect
                pdf_bytes = img.convert_to_pdf()
            page = doc.new_page(width=rect.width, height=rect.height)
            page.show_pdf_page(page.rect, fitz.open("pdf", pdf_bytes), 0)
        return doc.tobytes()
    finally:
        doc.close()


def enhance_scan_image(image_bytes: bytes) -> bytes:
    """Grayscale + auto-contrast pass used by Scan to PDF — approximates
    what a dedicated scanner app does to a phone photo of a document
    (flattens uneven lighting/shadow, boosts text-vs-background contrast),
    entirely local via Pillow, no OCR/cloud involved."""
    try:
        with Image.open(io.BytesIO(image_bytes)) as img:
            gray = ImageOps.grayscale(img)
            enhanced = ImageOps.autocontrast(gray, cutoff=1)
            buf = io.BytesIO()
            enhanced.convert("RGB").save(buf, format="JPEG", quality=90)
            return buf.getvalue()
    except Exception as exc:
        raise PDFToolError(f"Couldn't process one of the images: {exc}") from exc


def compress_pdf(file_bytes: bytes) -> bytes:
    with _open(file_bytes) as doc:
        return doc.tobytes(garbage=4, deflate=True, clean=True)


def repair_pdf(file_bytes: bytes) -> bytes:
    """Reopens and re-saves a PDF, rebuilding its object structure and
    cross-reference table. MuPDF already attempts to recover a broken
    xref/stream structure on open (most files that are "damaged" but not
    completely unreadable succeed here for that reason alone) — re-saving
    with garbage collection then discards anything broken or orphaned that
    the read silently worked around, producing a clean, valid file."""
    with _open(file_bytes) as doc:
        return doc.tobytes(garbage=4, deflate=True, clean=True)


def redact_pdf(file_bytes: bytes, terms: list[str]) -> bytes:
    """Permanently removes every occurrence of the given words/phrases —
    search-based, not click-to-draw-a-box, since that needs a page-image
    viewer this app doesn't have yet. `search_for` is case-insensitive by
    default. `apply_redactions()` actually strips the underlying text/
    drawing content under each box, unlike a plain black rectangle drawn
    on top (which would just visually hide, not remove, the data)."""
    cleaned_terms = [t.strip() for t in terms if t.strip()]
    if not cleaned_terms:
        raise PDFToolError("Provide at least one word or phrase to redact.")

    with _open(file_bytes) as doc:
        any_match = False
        for page in doc:
            for term in cleaned_terms:
                hits = page.search_for(term)
                for rect in hits:
                    page.add_redact_annot(rect, fill=(0, 0, 0))
                    any_match = True
            page.apply_redactions()

        if not any_match:
            raise PDFToolError(
                "None of the given words or phrases were found in this document."
            )
        return doc.tobytes(garbage=4, deflate=True)


_WIDGET_TYPE_NAMES = {
    fitz.PDF_WIDGET_TYPE_TEXT: "text",
    fitz.PDF_WIDGET_TYPE_CHECKBOX: "checkbox",
    fitz.PDF_WIDGET_TYPE_RADIOBUTTON: "radio",
    fitz.PDF_WIDGET_TYPE_COMBOBOX: "select",
    fitz.PDF_WIDGET_TYPE_LISTBOX: "select",
    fitz.PDF_WIDGET_TYPE_SIGNATURE: "signature",
}


def get_form_fields(file_bytes: bytes) -> list[dict]:
    """Lists a PDF's existing AcroForm fields (its own creator already
    defined these — this reads them, it doesn't design new ones)."""
    with _open(file_bytes) as doc:
        fields = []
        for page_index, page in enumerate(doc):
            for widget in page.widgets() or []:
                fields.append(
                    {
                        "name": widget.field_name,
                        "type": _WIDGET_TYPE_NAMES.get(widget.field_type, "text"),
                        "page": page_index + 1,
                        "value": widget.field_value or "",
                    }
                )
        return fields


def fill_form(file_bytes: bytes, values: dict[str, str]) -> bytes:
    """Writes values into an existing PDF's form fields, keyed by field
    name (from get_form_fields). Checkbox values are given as
    truthy/falsy strings ("true"/"false") from the frontend's checkbox
    input; everything else is written as plain text."""
    with _open(file_bytes) as doc:
        matched = False
        for page in doc:
            for widget in page.widgets() or []:
                if widget.field_name not in values:
                    continue
                matched = True
                raw_value = values[widget.field_name]
                if widget.field_type == fitz.PDF_WIDGET_TYPE_CHECKBOX:
                    widget.field_value = raw_value.strip().lower() in ("true", "on", "1", "yes")
                else:
                    widget.field_value = raw_value
                widget.update()

        if not matched:
            raise PDFToolError(
                "None of the provided values matched a form field in this document."
            )
        return doc.tobytes(garbage=4, deflate=True)


def get_page_count(file_bytes: bytes) -> int:
    with _open(file_bytes) as doc:
        return doc.page_count


def extract_tables(file_bytes: bytes) -> list[dict]:
    """Detects tables in a PDF's native text layer (no OCR/LLM involved) and
    returns them page by page — used by the "normal PDF" fast path for PDF
    to Excel, where the document already has real, digitally-generated
    tabular data and doesn't need field-driven OCR extraction.

    PyMuPDF's default table-detection strategy looks for ruling lines
    (borders); many real documents (e.g. exported from Word/LibreOffice)
    have no visible borders at all, so the whitespace-alignment "text"
    strategy is tried as a fallback per page. Rows that come back fully
    blank (an artifact of the "text" strategy on loosely-spaced rows) are
    dropped. Pages with real text but no detectable table still contribute
    a single-column "table" of their text lines, so nothing is silently
    lost for less-structured pages within an otherwise tabular document.
    """
    with _open(file_bytes) as doc:
        results = []
        for page_index, page in enumerate(doc):
            found_tables = page.find_tables().tables
            if not found_tables:
                found_tables = page.find_tables(strategy="text").tables

            page_had_table = False
            for table in found_tables:
                rows = [
                    [cell or "" for cell in row]
                    for row in table.extract()
                    if any((cell or "").strip() for cell in row)
                ]
                if rows:
                    results.append({"page": page_index + 1, "rows": rows})
                    page_had_table = True

            if not page_had_table:
                lines = [line for line in page.get_text().splitlines() if line.strip()]
                if lines:
                    results.append({"page": page_index + 1, "rows": [[line] for line in lines]})
        return results


def extract_text_layer(file_bytes: bytes) -> str:
    """The PDF's own embedded text, if any — distinct from OCR, which reads
    pixels. Used to detect scanned/photographed PDFs that have no real text
    layer for pdf2docx (or Document Translation) to work from."""
    with _open(file_bytes) as doc:
        return "\n".join(page.get_text() for page in doc)


def zip_files(named_blobs: list[tuple[str, bytes]]) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for name, blob in named_blobs:
            zf.writestr(name, blob)
    return buf.getvalue()
