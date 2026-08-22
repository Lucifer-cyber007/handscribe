"""
Flattens client-authored annotation objects (text/rect/ellipse/line/path/
image) permanently into a PDF's page content, backing /api/pdf/edit.

Mirrors pdf_ops.py's style: pure bytes-in/bytes-out, PDFToolError on bad
input, reuses its _open/_resolve_page_indices helpers.

Coordinate system: verified live against this project's installed
PyMuPDF==1.28.2 that Page-level draw/insert calls use a top-left origin
with y increasing downward (a rect drawn at small y renders near the top
of the page) — the same convention as canvas/DOM pixel coordinates, so the
frontend's per-page pixel coordinates (already divided by its render
scale to recover PDF points) need no Y-flip here. Also verified: color
tuples are 0-1 float RGB, and fill=None on draw_rect/draw_oval/
draw_polyline means stroke-only (unfilled interior) — matching this
file's inputs, which the frontend sends as already-normalized 0-1 floats.
"""
import base64
import binascii

import fitz  # PyMuPDF

from app.utils.pdf_ops import PDFToolError, _open, _resolve_page_indices


def _decode_data_url(data_url: str) -> bytes:
    try:
        _, encoded = data_url.split(",", 1)
        return base64.b64decode(encoded)
    except (ValueError, binascii.Error) as exc:
        raise PDFToolError(f"Couldn't decode an inserted image: {exc}") from exc


def _opt_color(obj: dict, key: str) -> tuple | None:
    value = obj.get(key)
    return tuple(value) if value is not None else None


def _draw_one(page: fitz.Page, obj: dict) -> None:
    kind = obj.get("type")
    if kind == "text":
        page.insert_text(
            (obj["x"], obj["y"] + obj["fontSize"]),
            obj["content"],
            fontsize=obj["fontSize"],
            color=tuple(obj["color"]),
        )
    elif kind == "rect":
        rect = fitz.Rect(obj["x"], obj["y"], obj["x"] + obj["width"], obj["y"] + obj["height"])
        page.draw_rect(
            rect,
            color=tuple(obj["strokeColor"]),
            fill=_opt_color(obj, "fillColor"),
            width=obj["strokeWidth"],
        )
    elif kind == "ellipse":
        rect = fitz.Rect(obj["x"], obj["y"], obj["x"] + obj["width"], obj["y"] + obj["height"])
        page.draw_oval(
            rect,
            color=tuple(obj["strokeColor"]),
            fill=_opt_color(obj, "fillColor"),
            width=obj["strokeWidth"],
        )
    elif kind == "line":
        page.draw_line(
            (obj["x"], obj["y"]),
            (obj["x2"], obj["y2"]),
            color=tuple(obj["strokeColor"]),
            width=obj["strokeWidth"],
        )
    elif kind == "path":
        points = [fitz.Point(px, py) for px, py in obj["points"]]
        if len(points) < 2:
            return
        page.draw_polyline(
            points,
            color=tuple(obj["strokeColor"]),
            fill=None,
            width=obj["strokeWidth"],
        )
    elif kind == "image":
        rect = fitz.Rect(obj["x"], obj["y"], obj["x"] + obj["width"], obj["y"] + obj["height"])
        page.insert_image(rect, stream=_decode_data_url(obj["dataUrl"]), overlay=True)
    else:
        raise PDFToolError(f"Unknown annotation type '{kind}'.")


def apply_edits(file_bytes: bytes, objects: list[dict]) -> bytes:
    if not objects:
        raise PDFToolError("No annotations to apply.")

    with _open(file_bytes) as doc:
        by_page: dict[int, list[dict]] = {}
        for obj in objects:
            by_page.setdefault(obj["page"], []).append(obj)

        # Validates every referenced page number before any drawing happens,
        # so a bad page number never leaves the document half-edited.
        _resolve_page_indices(doc, list(by_page.keys()))

        for page_num, page_objects in by_page.items():
            page = doc[page_num - 1]
            for obj in page_objects:
                _draw_one(page, obj)

        return doc.tobytes(garbage=4, deflate=True, clean=True)
