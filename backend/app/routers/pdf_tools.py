import json

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import ValidationError

from app.config import settings
from app.llm.base import LLMStructuringError
from app.llm.factory import get_llm_provider
from app.ocr.base import OCRError
from app.ocr.factory import get_ocr_provider
from app.ocr.google_vision import MAX_SYNC_PDF_PAGES
from app.llm.summarizer import (
    SummarizerError,
    SummarizerNotConfiguredError,
    answer_question,
    summarize_text,
)
from app.schemas import (
    AskPayload,
    AskResult,
    CompareResult,
    FormFieldsResult,
    OrganizePayload,
    RedactPayload,
    SplitRangesPayload,
    SummaryResult,
    TableExtractionResult,
)
from app.translate.google_translate import (
    TranslationError,
    TranslationNoTextError,
    TranslationNotConfiguredError,
    translate_pdf as translate_pdf_document,
)
from app.utils import compare_ops, markdown_ops, office_ops, pdf_ops, powerpoint_ops
from app.utils.compare_ops import CompareToolError
from app.utils.markdown_ops import MarkdownToolError
from app.utils.office_ops import OfficeToolError
from app.utils.pdf_ops import PDFToolError
from app.utils.powerpoint_ops import PowerPointToolError

router = APIRouter(prefix="/api/pdf", tags=["pdf-tools"])

PDF_CONTENT_TYPE = "application/pdf"
IMAGE_CONTENT_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
DOCX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
PPTX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.presentationml.presentation"
WORD_EXTENSIONS = (".docx", ".doc")
POWERPOINT_EXTENSIONS = (".pptx", ".ppt")
EXCEL_EXTENSIONS = (".xlsx", ".xls")


async def _read_checked(upload: UploadFile, expected_type: str | None = None) -> bytes:
    if expected_type and upload.content_type != expected_type:
        raise HTTPException(
            400, f"Unsupported file type '{upload.content_type}'. Upload a PDF file."
        )
    file_bytes = await upload.read()
    if not file_bytes:
        raise HTTPException(400, "Uploaded file was empty.")
    if len(file_bytes) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(400, f"File exceeds the {settings.max_upload_mb}MB upload limit.")
    return file_bytes


async def _read_many_checked(uploads: list[UploadFile], expected_type: str | None = None) -> list[bytes]:
    total = 0
    out = []
    for upload in uploads:
        if expected_type and upload.content_type != expected_type:
            raise HTTPException(
                400, f"Unsupported file type '{upload.content_type}'. Upload PDF files."
            )
        file_bytes = await upload.read()
        if not file_bytes:
            raise HTTPException(400, f"'{upload.filename}' was empty.")
        total += len(file_bytes)
        if total > settings.max_upload_mb * 1024 * 1024:
            raise HTTPException(400, f"Combined upload exceeds the {settings.max_upload_mb}MB limit.")
        out.append(file_bytes)
    return out


def _parse_json_field(name: str, raw: str | None) -> dict | list | None:
    if raw is None:
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(400, f"{name} was not valid JSON: {exc}") from exc


def _pdf_response(data: bytes, filename: str) -> Response:
    return Response(
        content=data,
        media_type=PDF_CONTENT_TYPE,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _zip_response(data: bytes, filename: str) -> Response:
    return Response(
        content=data,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/merge")
async def merge(files: list[UploadFile] = File(...)) -> Response:
    file_bytes_list = await _read_many_checked(files, PDF_CONTENT_TYPE)
    try:
        result = pdf_ops.merge_pdfs(file_bytes_list)
    except PDFToolError as exc:
        raise HTTPException(400, str(exc)) from exc
    return _pdf_response(result, "merged.pdf")


@router.post("/split")
async def split(
    file: UploadFile = File(...),
    ranges_json: str = Form(...),
) -> Response:
    file_bytes = await _read_checked(file, PDF_CONTENT_TYPE)
    raw = _parse_json_field("ranges_json", ranges_json)
    try:
        payload = SplitRangesPayload.model_validate(
            {"ranges": raw.get("ranges", raw) if isinstance(raw, dict) else raw}
        )
    except ValidationError as exc:
        raise HTTPException(422, f"Invalid ranges: {exc.errors()}") from exc

    parsed_ranges = []
    for r in payload.ranges:
        try:
            start_str, end_str = r.split("-")
            parsed_ranges.append((int(start_str), int(end_str)))
        except ValueError:
            raise HTTPException(400, f"Range '{r}' isn't in 'start-end' form, e.g. '1-3'.")

    try:
        parts = pdf_ops.split_pdf(file_bytes, parsed_ranges)
    except PDFToolError as exc:
        raise HTTPException(400, str(exc)) from exc

    named = [(f"part-{i + 1}.pdf", part) for i, part in enumerate(parts)]
    return _zip_response(pdf_ops.zip_files(named), "split.zip")


@router.post("/rotate")
async def rotate(
    file: UploadFile = File(...),
    degrees: int = Form(...),
    pages_json: str | None = Form(default=None),
) -> Response:
    file_bytes = await _read_checked(file, PDF_CONTENT_TYPE)
    pages = _parse_json_field("pages_json", pages_json)
    try:
        result = pdf_ops.rotate_pdf(file_bytes, degrees, pages)
    except PDFToolError as exc:
        raise HTTPException(400, str(exc)) from exc
    return _pdf_response(result, "rotated.pdf")


@router.post("/organize")
async def organize(
    file: UploadFile = File(...),
    page_order_json: str = Form(...),
) -> Response:
    file_bytes = await _read_checked(file, PDF_CONTENT_TYPE)
    raw = _parse_json_field("page_order_json", page_order_json)
    try:
        payload = OrganizePayload.model_validate(
            {"page_order": raw.get("page_order", raw) if isinstance(raw, dict) else raw}
        )
    except ValidationError as exc:
        raise HTTPException(422, f"Invalid page order: {exc.errors()}") from exc

    try:
        result = pdf_ops.reorder_pages(file_bytes, payload.page_order)
    except PDFToolError as exc:
        raise HTTPException(400, str(exc)) from exc
    return _pdf_response(result, "organized.pdf")


@router.post("/crop")
async def crop(
    file: UploadFile = File(...),
    left: float = Form(...),
    top: float = Form(...),
    right: float = Form(...),
    bottom: float = Form(...),
    pages_json: str | None = Form(default=None),
) -> Response:
    file_bytes = await _read_checked(file, PDF_CONTENT_TYPE)
    pages = _parse_json_field("pages_json", pages_json)
    try:
        result = pdf_ops.crop_pdf(file_bytes, left, top, right, bottom, pages)
    except PDFToolError as exc:
        raise HTTPException(400, str(exc)) from exc
    return _pdf_response(result, "cropped.pdf")


@router.post("/page-numbers")
async def page_numbers(
    file: UploadFile = File(...),
    position: str = Form(...),
    start_number: int = Form(default=1),
) -> Response:
    file_bytes = await _read_checked(file, PDF_CONTENT_TYPE)
    try:
        result = pdf_ops.add_page_numbers(file_bytes, position, start_number)
    except PDFToolError as exc:
        raise HTTPException(400, str(exc)) from exc
    return _pdf_response(result, "numbered.pdf")


@router.post("/watermark")
async def watermark(
    file: UploadFile = File(...),
    text: str | None = Form(default=None),
    watermark_image: UploadFile | None = File(default=None),
    opacity: float = Form(default=0.3),
    position: str = Form(...),
) -> Response:
    file_bytes = await _read_checked(file, PDF_CONTENT_TYPE)
    image_bytes = await watermark_image.read() if watermark_image is not None else None
    try:
        result = pdf_ops.add_watermark(file_bytes, text, image_bytes, opacity, position)
    except PDFToolError as exc:
        raise HTTPException(400, str(exc)) from exc
    return _pdf_response(result, "watermarked.pdf")


@router.post("/protect")
async def protect(
    file: UploadFile = File(...),
    password: str = Form(...),
) -> Response:
    file_bytes = await _read_checked(file, PDF_CONTENT_TYPE)
    try:
        result = pdf_ops.protect_pdf(file_bytes, password)
    except PDFToolError as exc:
        raise HTTPException(400, str(exc)) from exc
    return _pdf_response(result, "protected.pdf")


@router.post("/unlock")
async def unlock(
    file: UploadFile = File(...),
    password: str = Form(...),
) -> Response:
    file_bytes = await _read_checked(file, PDF_CONTENT_TYPE)
    try:
        result = pdf_ops.unlock_pdf(file_bytes, password)
    except PDFToolError as exc:
        raise HTTPException(400, str(exc)) from exc
    return _pdf_response(result, "unlocked.pdf")


@router.post("/to-jpg")
async def to_jpg(
    file: UploadFile = File(...),
    dpi: int = Form(default=150),
) -> Response:
    file_bytes = await _read_checked(file, PDF_CONTENT_TYPE)
    try:
        images = pdf_ops.pdf_to_images(file_bytes, dpi)
    except PDFToolError as exc:
        raise HTTPException(400, str(exc)) from exc

    named = [(f"page-{i + 1}.jpg", img) for i, img in enumerate(images)]
    return _zip_response(pdf_ops.zip_files(named), "pages.zip")


@router.post("/from-images")
async def from_images(files: list[UploadFile] = File(...)) -> Response:
    for f in files:
        if f.content_type not in IMAGE_CONTENT_TYPES:
            raise HTTPException(
                400, f"Unsupported file type '{f.content_type}'. Upload JPG, PNG, or WEBP images."
            )
    image_bytes_list = await _read_many_checked(files)
    try:
        result = pdf_ops.images_to_pdf(image_bytes_list)
    except PDFToolError as exc:
        raise HTTPException(400, str(exc)) from exc
    return _pdf_response(result, "images.pdf")


@router.post("/compress")
async def compress(file: UploadFile = File(...)) -> Response:
    file_bytes = await _read_checked(file, PDF_CONTENT_TYPE)
    try:
        result = pdf_ops.compress_pdf(file_bytes)
    except PDFToolError as exc:
        raise HTTPException(400, str(exc)) from exc
    return _pdf_response(result, "compressed.pdf")


@router.post("/repair")
async def repair(file: UploadFile = File(...)) -> Response:
    file_bytes = await _read_checked(file, PDF_CONTENT_TYPE)
    try:
        result = pdf_ops.repair_pdf(file_bytes)
    except PDFToolError as exc:
        raise HTTPException(
            400, f"Couldn't repair this PDF — it may be too badly damaged: {exc}"
        ) from exc
    return _pdf_response(result, "repaired.pdf")


@router.post("/scan-to-pdf")
async def scan_to_pdf(
    files: list[UploadFile] = File(...),
    enhance: bool = Form(default=True),
) -> Response:
    for f in files:
        if f.content_type not in IMAGE_CONTENT_TYPES:
            raise HTTPException(
                400, f"Unsupported file type '{f.content_type}'. Upload JPG, PNG, or WEBP images."
            )
    image_bytes_list = await _read_many_checked(files)
    try:
        if enhance:
            image_bytes_list = [pdf_ops.enhance_scan_image(b) for b in image_bytes_list]
        result = pdf_ops.images_to_pdf(image_bytes_list)
    except PDFToolError as exc:
        raise HTTPException(400, str(exc)) from exc
    return _pdf_response(result, "scanned.pdf")


@router.post("/to-word")
async def to_word(file: UploadFile = File(...)) -> Response:
    file_bytes = await _read_checked(file, PDF_CONTENT_TYPE)

    try:
        has_text_layer = len(pdf_ops.extract_text_layer(file_bytes).strip()) >= 3
    except PDFToolError as exc:
        raise HTTPException(400, str(exc)) from exc

    if has_text_layer:
        try:
            result = office_ops.pdf_to_docx(file_bytes)
        except OfficeToolError as exc:
            raise HTTPException(400, str(exc)) from exc
        return Response(
            content=result,
            media_type=DOCX_CONTENT_TYPE,
            headers={"Content-Disposition": 'attachment; filename="converted.docx"'},
        )

    # No text layer (a scan/photo) — pdf2docx can't reconstruct paragraphs
    # from pixels, so fall back to this app's own OCR and build a plain
    # .docx from the recognized text instead. Layout isn't preserved here,
    # unlike the primary path above.
    ocr_provider = get_ocr_provider()
    try:
        ocr_result = ocr_provider.extract_text(file_bytes, PDF_CONTENT_TYPE)
    except OCRError as exc:
        raise HTTPException(502, f"OCR fallback failed: {exc}") from exc
    if len(ocr_result.text.strip()) < 3:
        raise HTTPException(
            422,
            "This PDF has no extractable text layer, and OCR couldn't read any text "
            "from it either — the scan quality may be too low.",
        )

    try:
        result = office_ops.text_to_docx(ocr_result.text)
    except OfficeToolError as exc:
        raise HTTPException(400, str(exc)) from exc
    return Response(
        content=result,
        media_type=DOCX_CONTENT_TYPE,
        headers={
            "Content-Disposition": 'attachment; filename="converted-ocr.docx"',
            "X-Conversion-Fallback": "no-text-layer",
        },
    )


async def _read_office_file_checked(
    file: UploadFile, allowed_extensions: tuple[str, ...], type_label: str
) -> tuple[bytes, str]:
    filename = file.filename or ""
    if not filename.lower().endswith(allowed_extensions):
        raise HTTPException(400, f"Upload a {type_label} file.")
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(400, "Uploaded file was empty.")
    if len(file_bytes) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(400, f"File exceeds the {settings.max_upload_mb}MB upload limit.")
    return file_bytes, filename


@router.post("/from-word")
async def from_word(file: UploadFile = File(...)) -> Response:
    file_bytes, filename = await _read_office_file_checked(file, WORD_EXTENSIONS, "DOC or DOCX")
    try:
        result = office_ops.docx_to_pdf(file_bytes, filename)
    except OfficeToolError as exc:
        status = 503 if "isn't installed" in str(exc) else 400
        raise HTTPException(status, str(exc)) from exc
    return _pdf_response(result, "converted.pdf")


@router.post("/from-powerpoint")
async def from_powerpoint(file: UploadFile = File(...)) -> Response:
    file_bytes, filename = await _read_office_file_checked(
        file, POWERPOINT_EXTENSIONS, "PPT or PPTX"
    )
    try:
        result = office_ops.pptx_to_pdf(file_bytes, filename)
    except OfficeToolError as exc:
        status = 503 if "isn't installed" in str(exc) else 400
        raise HTTPException(status, str(exc)) from exc
    return _pdf_response(result, "converted.pdf")


@router.post("/from-excel")
async def from_excel(file: UploadFile = File(...)) -> Response:
    file_bytes, filename = await _read_office_file_checked(file, EXCEL_EXTENSIONS, "XLS or XLSX")
    try:
        result = office_ops.xlsx_to_pdf(file_bytes, filename)
    except OfficeToolError as exc:
        status = 503 if "isn't installed" in str(exc) else 400
        raise HTTPException(status, str(exc)) from exc
    return _pdf_response(result, "converted.pdf")


@router.post("/to-powerpoint")
async def to_powerpoint(file: UploadFile = File(...)) -> Response:
    file_bytes = await _read_checked(file, PDF_CONTENT_TYPE)
    try:
        result = powerpoint_ops.pdf_to_pptx(file_bytes)
    except PowerPointToolError as exc:
        raise HTTPException(400, str(exc)) from exc
    return Response(
        content=result,
        media_type=PPTX_CONTENT_TYPE,
        headers={"Content-Disposition": 'attachment; filename="converted.pptx"'},
    )


@router.post("/extract-tables", response_model=TableExtractionResult)
async def extract_tables(file: UploadFile = File(...)) -> TableExtractionResult:
    """Direct, fields-free table extraction for PDFs that already have a
    real text layer (digitally generated, not a scan) — no OCR, no LLM,
    just PyMuPDF reading the document's own structure. Backs the "normal
    PDF" fast path on the PDF to Excel tool, distinct from the field-driven
    OCR path used for scans/handwriting."""
    file_bytes = await _read_checked(file, PDF_CONTENT_TYPE)

    try:
        has_text_layer = len(pdf_ops.extract_text_layer(file_bytes).strip()) >= 3
    except PDFToolError as exc:
        raise HTTPException(400, str(exc)) from exc
    if not has_text_layer:
        raise HTTPException(
            422,
            "This PDF has no selectable text — it looks like a scan or photo. "
            "Use the OCR option instead, which lets you define fields for accurate extraction.",
        )

    try:
        tables = pdf_ops.extract_tables(file_bytes)
    except PDFToolError as exc:
        raise HTTPException(400, str(exc)) from exc
    return TableExtractionResult(tables=tables)


@router.post("/redact")
async def redact(
    file: UploadFile = File(...),
    terms_json: str = Form(...),
) -> Response:
    file_bytes = await _read_checked(file, PDF_CONTENT_TYPE)
    raw = _parse_json_field("terms_json", terms_json)
    try:
        payload = RedactPayload.model_validate(
            {"terms": raw.get("terms", raw) if isinstance(raw, dict) else raw}
        )
    except ValidationError as exc:
        raise HTTPException(422, f"Invalid terms: {exc.errors()}") from exc

    try:
        result = pdf_ops.redact_pdf(file_bytes, payload.terms)
    except PDFToolError as exc:
        raise HTTPException(400, str(exc)) from exc
    return _pdf_response(result, "redacted.pdf")


@router.post("/form-fields", response_model=FormFieldsResult)
async def form_fields(file: UploadFile = File(...)) -> FormFieldsResult:
    file_bytes = await _read_checked(file, PDF_CONTENT_TYPE)
    try:
        fields = pdf_ops.get_form_fields(file_bytes)
    except PDFToolError as exc:
        raise HTTPException(400, str(exc)) from exc
    if not fields:
        raise HTTPException(
            422,
            "This PDF doesn't have any fillable form fields. Use PDF Forms only on "
            "documents that already contain a form (e.g. a government or application form).",
        )
    return FormFieldsResult(fields=fields)


@router.post("/fill-form")
async def fill_form(
    file: UploadFile = File(...),
    values_json: str = Form(...),
) -> Response:
    file_bytes = await _read_checked(file, PDF_CONTENT_TYPE)
    raw = _parse_json_field("values_json", values_json)
    if not isinstance(raw, dict):
        raise HTTPException(400, "values_json must be an object of field name -> value.")
    try:
        result = pdf_ops.fill_form(file_bytes, raw)
    except PDFToolError as exc:
        raise HTTPException(400, str(exc)) from exc
    return _pdf_response(result, "filled.pdf")


@router.post("/compare", response_model=CompareResult)
async def compare(
    file_a: UploadFile = File(...),
    file_b: UploadFile = File(...),
) -> CompareResult:
    bytes_a = await _read_checked(file_a, PDF_CONTENT_TYPE)
    bytes_b = await _read_checked(file_b, PDF_CONTENT_TYPE)
    try:
        segments = compare_ops.compare_pdfs(bytes_a, bytes_b)
    except CompareToolError as exc:
        raise HTTPException(400, str(exc)) from exc
    return CompareResult(segments=segments)


@router.post("/from-html")
async def from_html(url: str = Form(...)) -> Response:
    try:
        result = office_ops.html_to_pdf(url)
    except OfficeToolError as exc:
        status = 503 if "isn't installed" in str(exc) else 400
        raise HTTPException(status, str(exc)) from exc
    return _pdf_response(result, "webpage.pdf")


@router.post("/to-markdown")
async def to_markdown(file: UploadFile = File(...)) -> Response:
    file_bytes = await _read_checked(file, PDF_CONTENT_TYPE)

    try:
        has_text_layer = len(pdf_ops.extract_text_layer(file_bytes).strip()) >= 3
    except PDFToolError as exc:
        raise HTTPException(400, str(exc)) from exc

    if has_text_layer:
        try:
            markdown = markdown_ops.pdf_to_markdown(file_bytes)
        except MarkdownToolError as exc:
            raise HTTPException(400, str(exc)) from exc
        return Response(
            content=markdown.encode("utf-8"),
            media_type="text/markdown; charset=utf-8",
            headers={"Content-Disposition": 'attachment; filename="converted.md"'},
        )

    # No text layer (a scan/photo) — pymupdf4llm can't reconstruct headings
    # and paragraphs from pixels, so fall back to OCR and emit the
    # recognized text as plain Markdown. No heading/table structure here,
    # unlike the primary path above.
    ocr_provider = get_ocr_provider()
    try:
        ocr_result = ocr_provider.extract_text(file_bytes, PDF_CONTENT_TYPE)
    except OCRError as exc:
        raise HTTPException(502, f"OCR fallback failed: {exc}") from exc
    if len(ocr_result.text.strip()) < 3:
        raise HTTPException(
            422,
            "This PDF has no extractable text layer, and OCR couldn't read any text "
            "from it either — the scan quality may be too low.",
        )

    return Response(
        content=ocr_result.text.encode("utf-8"),
        media_type="text/markdown; charset=utf-8",
        headers={
            "Content-Disposition": 'attachment; filename="converted-ocr.md"',
            "X-Conversion-Fallback": "no-text-layer",
        },
    )


@router.post("/translate")
async def translate(
    file: UploadFile = File(...),
    source_language: str | None = Form(default=None),
    target_language: str = Form(...),
) -> Response:
    file_bytes = await _read_checked(file, PDF_CONTENT_TYPE)
    try:
        result = translate_pdf_document(file_bytes, source_language, target_language)
        return _pdf_response(result, "translated.pdf")
    except TranslationNotConfiguredError as exc:
        raise HTTPException(503, str(exc)) from exc
    except TranslationNoTextError:
        # Document Translation only translates an existing text layer — it
        # doesn't run OCR. A PDF with none (typically a photographed/scanned
        # document) fails there outright, so fall back to this app's own
        # OCR + plain-text LLM translation instead of just erroring out.
        # Layout isn't preserved in this path, unlike the primary one.
        pass
    except TranslationError as exc:
        raise HTTPException(502, str(exc)) from exc

    ocr_provider = get_ocr_provider()
    try:
        ocr_result = ocr_provider.extract_text(file_bytes, PDF_CONTENT_TYPE)
    except OCRError as exc:
        raise HTTPException(502, f"OCR fallback failed: {exc}") from exc
    if len(ocr_result.text.strip()) < 3:
        raise HTTPException(
            422,
            "This PDF has no extractable text layer, and OCR couldn't read any text "
            "from it either — the scan quality may be too low.",
        )

    llm_provider = get_llm_provider()
    try:
        translated_text = llm_provider.translate_text(ocr_result.text, target_language)
    except LLMStructuringError as exc:
        raise HTTPException(502, f"Translation fallback failed: {exc}") from exc

    return Response(
        content=translated_text.encode("utf-8"),
        media_type="text/plain; charset=utf-8",
        headers={
            "Content-Disposition": 'attachment; filename="translated-text-fallback.txt"',
            "X-Translation-Fallback": "no-text-layer",
        },
    )


@router.post("/ocr")
async def ocr(file: UploadFile = File(...)) -> Response:
    file_bytes = await _read_checked(file, PDF_CONTENT_TYPE)
    ocr_provider = get_ocr_provider()
    try:
        ocr_result = ocr_provider.extract_text(file_bytes, PDF_CONTENT_TYPE)
    except OCRError as exc:
        raise HTTPException(502, f"OCR provider failed: {exc}") from exc

    text = ocr_result.text
    try:
        page_count = pdf_ops.get_page_count(file_bytes)
    except PDFToolError:
        page_count = None
    if page_count is not None and page_count > MAX_SYNC_PDF_PAGES:
        text = (
            f"[Note: this document has {page_count} pages — only the first "
            f"{MAX_SYNC_PDF_PAGES} were processed.]\n\n" + text
        )

    return Response(
        content=text.encode("utf-8"),
        media_type="text/plain; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="ocr-text.txt"'},
    )


@router.post("/summarize", response_model=SummaryResult)
async def summarize(file: UploadFile = File(...)) -> SummaryResult:
    file_bytes = await _read_checked(file, PDF_CONTENT_TYPE)

    try:
        text = pdf_ops.extract_text_layer(file_bytes)
    except PDFToolError as exc:
        raise HTTPException(400, str(exc)) from exc

    if len(text.strip()) < 3:
        # No real text layer (a scan/photo) -- same OCR fallback used
        # elsewhere (PDF to Word/Markdown, Translate PDF).
        ocr_provider = get_ocr_provider()
        try:
            ocr_result = ocr_provider.extract_text(file_bytes, PDF_CONTENT_TYPE)
        except OCRError as exc:
            raise HTTPException(502, f"OCR fallback failed: {exc}") from exc
        if len(ocr_result.text.strip()) < 3:
            raise HTTPException(
                422,
                "This PDF has no extractable text layer, and OCR couldn't read any text "
                "from it either — the scan quality may be too low.",
            )
        text = ocr_result.text

    try:
        summary = summarize_text(text)
    except SummarizerNotConfiguredError as exc:
        raise HTTPException(503, str(exc)) from exc
    except SummarizerError as exc:
        raise HTTPException(502, str(exc)) from exc

    return SummaryResult(summary=summary, document_text=text)


@router.post("/ask", response_model=AskResult)
async def ask(payload: AskPayload) -> AskResult:
    history = [{"role": m.role, "content": m.content} for m in payload.history]
    try:
        answer = answer_question(payload.document_text, payload.question, history)
    except SummarizerNotConfiguredError as exc:
        raise HTTPException(503, str(exc)) from exc
    except SummarizerError as exc:
        raise HTTPException(502, str(exc)) from exc
    return AskResult(answer=answer)
