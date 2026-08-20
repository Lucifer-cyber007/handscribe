"""
PDF <-> Word and PDF <-> PowerPoint conversions backing /api/pdf/to-word,
/api/pdf/from-word, and /api/pdf/from-powerpoint (/api/pdf/to-powerpoint
lives in powerpoint_ops.py — it doesn't go through LibreOffice at all).

PDF -> Word uses `pdf2docx` (pure Python, built on PyMuPDF) — reconstructs
paragraphs/tables/images into an editable .docx directly, no external
binary needed.

*-to-PDF conversions (Word, PowerPoint) go through headless LibreOffice
(`soffice --headless --convert-to pdf`) via subprocess — python-docx/
python-pptx plus a PDF writer can't faithfully reproduce arbitrary
document layout (styles, tables, images, headers/footers, slide masters)
— LibreOffice's own rendering engine is what actually gets that right,
same approach iLovePDF-style services use in production. Word and
PowerPoint share this same conversion path since both are just "open in
LibreOffice, export as PDF."
"""
import io
import ipaddress
import os
import shutil
import socket
import subprocess
import tempfile
from urllib.parse import urljoin, urlparse

import requests
from docx import Document
from pdf2docx import Converter

from app.config import settings


class OfficeToolError(RuntimeError):
    """Raised when an office-document conversion can't be completed —
    callers turn this into a 400/503."""


_WINDOWS_LIBREOFFICE_PATHS = [
    r"C:\Program Files\LibreOffice\program\soffice.exe",
    r"C:\Program Files (x86)\LibreOffice\program\soffice.exe",
]

_WORD_EXTENSIONS = (".docx", ".doc")
_POWERPOINT_EXTENSIONS = (".pptx", ".ppt")
_EXCEL_EXTENSIONS = (".xlsx", ".xls")

_CONVERSION_TIMEOUT_SECONDS = 120


def _soffice_path() -> str:
    if settings.libreoffice_path and os.path.isfile(settings.libreoffice_path):
        return settings.libreoffice_path

    found = shutil.which("soffice") or shutil.which("soffice.exe")
    if found:
        return found

    for path in _WINDOWS_LIBREOFFICE_PATHS:
        if os.path.isfile(path):
            return path

    raise OfficeToolError(
        "LibreOffice isn't installed on the server, so Word<->PDF conversion "
        "isn't available right now."
    )


def pdf_to_docx(file_bytes: bytes) -> bytes:
    """Converts PDF bytes to .docx bytes, preserving text/table/image layout
    as closely as pdf2docx's page-reconstruction can manage."""
    with tempfile.TemporaryDirectory() as tmp_dir:
        in_path = os.path.join(tmp_dir, "input.pdf")
        out_path = os.path.join(tmp_dir, "output.docx")
        with open(in_path, "wb") as f:
            f.write(file_bytes)

        try:
            converter = Converter(in_path)
        except Exception as exc:
            raise OfficeToolError(f"Couldn't read this file as a PDF: {exc}") from exc
        try:
            converter.convert(out_path)
        except Exception as exc:
            raise OfficeToolError(f"PDF to Word conversion failed: {exc}") from exc
        finally:
            converter.close()

        if not os.path.isfile(out_path):
            raise OfficeToolError("Conversion didn't produce an output file.")
        with open(out_path, "rb") as f:
            return f.read()


def text_to_docx(text: str) -> bytes:
    """Builds a plain .docx from OCR'd text — used when the source PDF has
    no real text layer for pdf2docx to reconstruct from (a scan/photo), so
    there's no page structure to preserve, just recognized text."""
    document = Document()
    for line in text.splitlines():
        document.add_paragraph(line)
    buf = io.BytesIO()
    document.save(buf)
    return buf.getvalue()


def docx_to_pdf(file_bytes: bytes, original_filename: str) -> bytes:
    """Converts Word document bytes to PDF bytes via headless LibreOffice."""
    return _office_document_to_pdf(file_bytes, original_filename, _WORD_EXTENSIONS, ".docx")


def pptx_to_pdf(file_bytes: bytes, original_filename: str) -> bytes:
    """Converts PowerPoint bytes to PDF bytes via headless LibreOffice."""
    return _office_document_to_pdf(file_bytes, original_filename, _POWERPOINT_EXTENSIONS, ".pptx")


def xlsx_to_pdf(file_bytes: bytes, original_filename: str) -> bytes:
    """Converts Excel spreadsheet bytes to PDF bytes via headless LibreOffice."""
    return _office_document_to_pdf(file_bytes, original_filename, _EXCEL_EXTENSIONS, ".xlsx")


_HTML_FETCH_TIMEOUT_SECONDS = 30
_HTML_MAX_REDIRECTS = 5
_HTML_USER_AGENT = "Mozilla/5.0 (compatible; PDFBoiiBot/1.0; +https://pdfboii.local)"


def _validate_public_url(url: str) -> None:
    """Blocks the server-side-request-forgery angle of "convert this URL":
    without this, a user could point the fetch at cloud metadata endpoints
    (169.254.169.254), localhost, or other internal-network addresses the
    server itself can reach but the public internet can't."""
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise OfficeToolError("The URL must start with http:// or https://.")
    if not parsed.hostname:
        raise OfficeToolError("That doesn't look like a valid URL.")

    try:
        resolved = socket.getaddrinfo(parsed.hostname, None)
    except socket.gaierror as exc:
        raise OfficeToolError(f"Couldn't resolve that URL's hostname: {exc}") from exc

    for family, _, _, _, sockaddr in resolved:
        ip = ipaddress.ip_address(sockaddr[0])
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
            raise OfficeToolError(
                "That URL points to a private or internal address, which isn't allowed."
            )


def _fetch_html(url: str) -> str:
    """Fetches the page's HTML, validating every hop (not just the
    starting URL) — a redirect to an internal address would otherwise
    bypass the SSRF check above entirely."""
    current_url = url
    for _ in range(_HTML_MAX_REDIRECTS + 1):
        _validate_public_url(current_url)
        try:
            response = requests.get(
                current_url,
                timeout=_HTML_FETCH_TIMEOUT_SECONDS,
                allow_redirects=False,
                headers={"User-Agent": _HTML_USER_AGENT},
            )
        except requests.RequestException as exc:
            raise OfficeToolError(f"Couldn't fetch that URL: {exc}") from exc

        if response.is_redirect or response.is_permanent_redirect:
            next_url = response.headers.get("Location")
            if not next_url:
                break
            current_url = urljoin(current_url, next_url)
            continue

        if not response.ok:
            raise OfficeToolError(f"That URL returned an error (status {response.status_code}).")
        return response.text

    raise OfficeToolError("That URL redirected too many times.")


def html_to_pdf(url: str) -> bytes:
    """Fetches a webpage and renders it to PDF via headless LibreOffice
    (Writer/Web can open .html directly, so this reuses the same
    conversion path as Word/PowerPoint/Excel). LibreOffice's HTML
    rendering doesn't execute JavaScript and has imperfect CSS support —
    fine for articles/blogs/simple pages, not single-page-app-style sites.
    A <base> tag is injected so the page's own relative image/stylesheet
    links resolve against the original site instead of failing (the HTML
    is rendered from a local temp file, not served from its real origin)."""
    html = _fetch_html(url)

    if "<base " not in html.lower() and "<base>" not in html.lower():
        base_tag = f'<base href="{url}">'
        lower_html = html.lower()
        head_idx = lower_html.find("<head")
        if head_idx != -1:
            close_idx = html.index(">", head_idx) + 1
            html = html[:close_idx] + base_tag + html[close_idx:]
        else:
            html = base_tag + html

    return _office_document_to_pdf(html.encode("utf-8"), "page.html", (".html",), ".html")


def _office_document_to_pdf(
    file_bytes: bytes,
    original_filename: str,
    allowed_extensions: tuple[str, ...],
    default_extension: str,
) -> bytes:
    ext = os.path.splitext(original_filename or "")[1].lower()
    if ext not in allowed_extensions:
        ext = default_extension

    soffice = _soffice_path()

    with tempfile.TemporaryDirectory() as tmp_dir:
        in_path = os.path.join(tmp_dir, f"input{ext}")
        with open(in_path, "wb") as f:
            f.write(file_bytes)

        # A dedicated, per-call profile dir avoids "user installation" lock
        # conflicts between concurrent requests sharing the default profile.
        profile_dir = os.path.join(tmp_dir, "lo_profile")
        profile_uri = "file:///" + profile_dir.replace(os.sep, "/")

        try:
            result = subprocess.run(
                [
                    soffice,
                    "--headless",
                    "--norestore",
                    f"-env:UserInstallation={profile_uri}",
                    "--convert-to",
                    "pdf",
                    "--outdir",
                    tmp_dir,
                    in_path,
                ],
                capture_output=True,
                timeout=_CONVERSION_TIMEOUT_SECONDS,
            )
        except subprocess.TimeoutExpired as exc:
            raise OfficeToolError("Conversion to PDF timed out.") from exc
        except FileNotFoundError as exc:
            raise OfficeToolError(
                "LibreOffice isn't installed on the server, so this conversion "
                "isn't available right now."
            ) from exc

        out_path = os.path.join(tmp_dir, "input.pdf")
        if result.returncode != 0 or not os.path.isfile(out_path):
            stderr = result.stderr.decode("utf-8", errors="replace").strip()
            raise OfficeToolError(
                "Conversion to PDF failed"
                + (f": {stderr}" if stderr else " (unreadable or corrupt document).")
            )

        with open(out_path, "rb") as f:
            return f.read()
