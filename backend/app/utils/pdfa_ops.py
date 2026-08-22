"""
PDF -> PDF/A conversion backing /api/pdf/to-pdfa.

Uses Ghostscript (`gs`/`gswin64c`) rather than PyMuPDF — genuine PDF/A
compliance needs ICC color-profile embedding, XMP conformance metadata, and
guaranteed font embedding, none of which PyMuPDF alone can produce in a way
a real validator would accept. Ghostscript's pdfwrite device with -dPDFA
handles all of that; verified against a real PDF by checking the output's
XMP metadata actually declares pdfaid:conformance.

Targets PDF/A-2b (-dPDFA=2): supports transparency/JPEG2000 unlike the
older, stricter PDF/A-1b, and is the more commonly requested archival
level today.
"""
import glob
import os
import shutil
import subprocess
import tempfile

from app.config import settings

_CONVERSION_TIMEOUT_SECONDS = 120

_WINDOWS_GHOSTSCRIPT_GLOBS = [
    r"C:\Program Files\gs\gs*\bin\gswin64c.exe",
    r"C:\Program Files (x86)\gs\gs*\bin\gswin32c.exe",
]


class PdfAToolError(RuntimeError):
    """Raised when a PDF can't be converted to PDF/A — callers turn this
    into a 400/503."""


def _ghostscript_path() -> str:
    if settings.ghostscript_path and os.path.isfile(settings.ghostscript_path):
        return settings.ghostscript_path

    for name in ("gs", "gswin64c", "gswin64c.exe"):
        found = shutil.which(name)
        if found:
            return found

    for pattern in _WINDOWS_GHOSTSCRIPT_GLOBS:
        # Newest version-numbered install directory wins if several exist.
        matches = sorted(glob.glob(pattern), reverse=True)
        if matches:
            return matches[0]

    raise PdfAToolError(
        "Ghostscript isn't installed on the server, so PDF to PDF/A "
        "conversion isn't available right now."
    )


def pdf_to_pdfa(file_bytes: bytes) -> bytes:
    gs = _ghostscript_path()

    with tempfile.TemporaryDirectory() as tmp_dir:
        in_path = os.path.join(tmp_dir, "input.pdf")
        out_path = os.path.join(tmp_dir, "output.pdf")
        with open(in_path, "wb") as f:
            f.write(file_bytes)

        try:
            result = subprocess.run(
                [
                    gs,
                    "-dPDFA=2",
                    "-dBATCH",
                    "-dNOPAUSE",
                    "-dNOOUTERSAVE",
                    "-dPDFACompatibilityPolicy=1",
                    "-sColorConversionStrategy=RGB",
                    "-sDEVICE=pdfwrite",
                    f"-sOutputFile={out_path}",
                    in_path,
                ],
                capture_output=True,
                timeout=_CONVERSION_TIMEOUT_SECONDS,
            )
        except subprocess.TimeoutExpired as exc:
            raise PdfAToolError("PDF/A conversion timed out.") from exc
        except FileNotFoundError as exc:
            raise PdfAToolError(
                "Ghostscript isn't installed on the server, so PDF to PDF/A "
                "conversion isn't available right now."
            ) from exc

        if result.returncode != 0 or not os.path.isfile(out_path):
            stderr = result.stderr.decode("utf-8", errors="replace").strip()
            raise PdfAToolError(
                "PDF/A conversion failed"
                + (f": {stderr[-500:]}" if stderr else " (unreadable or corrupt document).")
            )

        with open(out_path, "rb") as f:
            return f.read()
