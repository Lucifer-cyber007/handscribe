"""
Google Cloud Translation - Advanced (v3) client, used only for Translate PDF.

Document Translation (translateDocument) is IAM-only — it does not support
plain API keys, unlike Vision — so this authenticates with a service account
via google-auth (already a dependency) and calls the REST endpoint directly,
matching this codebase's preference for direct REST calls over heavy SDKs
(see app/ocr/google_vision.py).
"""
import base64
import time

import requests
from google.auth.transport.requests import Request
from google.oauth2 import service_account

from app.config import settings

TRANSLATE_ENDPOINT_TEMPLATE = (
    "https://translation.googleapis.com/v3/projects/{project_id}/locations/global:translateDocument"
)

_SCOPES = ["https://www.googleapis.com/auth/cloud-platform"]

# Retried because these are transient by nature — a rate-limit burst (429) or
# a momentary backend hiccup (5xx) — unlike a 400 (bad request) or 403 (auth),
# which retrying can't fix.
_RETRYABLE_STATUS_CODES = {429, 500, 502, 503, 504}
_MAX_ATTEMPTS = 3
_REQUEST_TIMEOUT_SECONDS = 180


class TranslationError(RuntimeError):
    """Raised when Translate PDF can't be completed — missing config, auth
    failure, or the API call itself failing."""


class TranslationNotConfiguredError(TranslationError):
    """Raised when GOOGLE_TRANSLATE_PROJECT_ID / GOOGLE_TRANSLATE_CREDENTIALS
    aren't set — distinct from a runtime API failure so callers can return a
    different status code (503, not 502)."""


class TranslationNoTextError(TranslationError):
    """Raised when Document Translation reports it found no extractable text
    layer in the PDF (typical of a photographed/scanned document with no OCR
    text embedded) — Document Translation only translates existing text, it
    doesn't run OCR itself. Distinct so callers can fall back to this app's
    own OCR + plain-text translation instead of just failing."""


_cached_credentials: service_account.Credentials | None = None


def _get_credentials() -> service_account.Credentials:
    global _cached_credentials
    if _cached_credentials is None:
        try:
            _cached_credentials = service_account.Credentials.from_service_account_file(
                settings.google_translate_credentials, scopes=_SCOPES
            )
        except (OSError, ValueError) as exc:
            raise TranslationError(f"Couldn't load translation credentials: {exc}") from exc
    if not _cached_credentials.valid:
        _cached_credentials.refresh(Request())
    return _cached_credentials


def translate_pdf(file_bytes: bytes, source_language: str | None, target_language: str) -> bytes:
    if not settings.google_translate_project_id or not settings.google_translate_credentials:
        raise TranslationNotConfiguredError(
            "Translate PDF isn't configured — set GOOGLE_TRANSLATE_PROJECT_ID and "
            "GOOGLE_TRANSLATE_CREDENTIALS in backend/.env."
        )

    credentials = _get_credentials()
    url = TRANSLATE_ENDPOINT_TEMPLATE.format(project_id=settings.google_translate_project_id)
    payload = {
        "targetLanguageCode": target_language,
        "documentInputConfig": {
            "content": base64.b64encode(file_bytes).decode("ascii"),
            "mimeType": "application/pdf",
        },
    }
    # Omitting sourceLanguageCode entirely (not sending an empty string) is
    # what triggers the API's language auto-detection.
    if source_language:
        payload["sourceLanguageCode"] = source_language
    headers = {
        "Authorization": f"Bearer {credentials.token}",
        "Content-Type": "application/json",
    }

    last_error: TranslationError | None = None
    for attempt in range(1, _MAX_ATTEMPTS + 1):
        try:
            response = requests.post(
                url, headers=headers, json=payload, timeout=_REQUEST_TIMEOUT_SECONDS
            )
        except requests.Timeout as exc:
            last_error = TranslationError(
                f"Translation API timed out after {_REQUEST_TIMEOUT_SECONDS}s "
                f"(attempt {attempt}/{_MAX_ATTEMPTS}): {exc}"
            )
            _sleep_before_retry(attempt)
            continue
        except requests.RequestException as exc:
            raise TranslationError(f"Translation API request failed: {exc}") from exc

        try:
            body = response.json()
        except ValueError as exc:
            raise TranslationError(
                f"Translation API returned a non-JSON response (status {response.status_code})"
            ) from exc

        if not response.ok:
            message = body.get("error", {}).get("message", f"status {response.status_code}")
            if "no text extracted" in message.lower():
                raise TranslationNoTextError(message)
            last_error = TranslationError(
                f"Translation API request failed (status {response.status_code}, "
                f"attempt {attempt}/{_MAX_ATTEMPTS}): {message}"
            )
            if response.status_code in _RETRYABLE_STATUS_CODES and attempt < _MAX_ATTEMPTS:
                _sleep_before_retry(attempt)
                continue
            raise last_error

        try:
            encoded = body["documentTranslation"]["byteStreamOutputs"][0]
        except (KeyError, IndexError) as exc:
            raise TranslationError(
                "Translation API response didn't include a translated document."
            ) from exc

        return base64.b64decode(encoded)

    assert last_error is not None
    raise last_error


def _sleep_before_retry(attempt: int) -> None:
    time.sleep(2**attempt)  # 2s, 4s, ... — simple exponential backoff
