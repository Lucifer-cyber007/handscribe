"""Pydantic request/response schemas, including server-side field validation."""
import re
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field, field_validator, model_validator


_EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class SignupRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(min_length=1, max_length=255)

    @field_validator("email")
    @classmethod
    def validate_email_format(cls, v: str) -> str:
        if not _EMAIL_PATTERN.match(v):
            raise ValueError("Enter a valid email address.")
        return v.strip().lower()


class LoginRequest(BaseModel):
    email: str = Field(min_length=1)
    password: str = Field(min_length=1)


class GoogleAuthRequest(BaseModel):
    id_token: str = Field(min_length=1)


class UserOut(BaseModel):
    id: str
    email: str
    name: str
    is_subscribed: bool

    class Config:
        from_attributes = True


class AuthResponse(BaseModel):
    access_token: str
    user: UserOut


class FieldType(str, Enum):
    NUMERIC = "numeric"
    ALPHABETIC = "alphabetic"
    ALPHANUMERIC = "alphanumeric"
    DATE = "date"
    CURRENCY = "currency"
    EMAIL = "email"
    PHONE = "phone"
    GST_NUMBER = "gst_number"
    CUSTOM_REGEX = "custom_regex"


class FieldSchemaIn(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    field_type: FieldType
    regex_pattern: str | None = None
    required: bool = False

    @model_validator(mode="after")
    def validate_regex_present_when_needed(self) -> "FieldSchemaIn":
        if self.field_type == FieldType.CUSTOM_REGEX:
            if not self.regex_pattern or not self.regex_pattern.strip():
                raise ValueError(
                    f"Field '{self.name}' has type custom_regex but no regex_pattern was provided."
                )
            try:
                re.compile(self.regex_pattern)
            except re.error as exc:
                raise ValueError(
                    f"Field '{self.name}' has an invalid regex pattern: {exc}"
                ) from exc
        return self


class FieldSchemaOut(FieldSchemaIn):
    id: str
    position: int

    class Config:
        from_attributes = True


class TemplateCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    fields: list[FieldSchemaIn] = Field(min_length=1)

    @field_validator("fields")
    @classmethod
    def unique_field_names(cls, fields: list[FieldSchemaIn]) -> list[FieldSchemaIn]:
        names = [f.name.strip().lower() for f in fields]
        if len(names) != len(set(names)):
            raise ValueError("Field names within a template must be unique.")
        return fields


class TemplateUpdate(TemplateCreate):
    pass


class FieldsPayload(BaseModel):
    """Ad-hoc field schema sent alongside an /api/extract upload (no template saved)."""

    fields: list[FieldSchemaIn] = Field(min_length=1)

    @field_validator("fields")
    @classmethod
    def unique_field_names(cls, fields: list[FieldSchemaIn]) -> list[FieldSchemaIn]:
        names = [f.name.strip().lower() for f in fields]
        if len(names) != len(set(names)):
            raise ValueError("Field names must be unique.")
        return fields


class TemplateOut(BaseModel):
    id: str
    name: str
    created_at: datetime
    updated_at: datetime
    fields: list[FieldSchemaOut]

    class Config:
        from_attributes = True


class SplitRangesPayload(BaseModel):
    """Ad-hoc page ranges sent alongside a /api/pdf/split upload, e.g. ["1-3", "4-6"]."""

    ranges: list[str] = Field(min_length=1)


class OrganizePayload(BaseModel):
    """Final 1-based page order sent alongside a /api/pdf/organize upload.
    Omitting a page number deletes that page; e.g. [3, 1, 2] on a 4-page
    document drops page 4 and reorders the rest."""

    page_order: list[int] = Field(min_length=1)


class RedactPayload(BaseModel):
    """Words/phrases sent alongside a /api/pdf/redact upload — every
    occurrence of each is found and permanently removed."""

    terms: list[str] = Field(min_length=1)


class DiffSegment(BaseModel):
    type: str  # "equal" | "replace" | "delete" | "insert" (difflib opcode tags)
    a_lines: list[str]
    b_lines: list[str]


class CompareResult(BaseModel):
    segments: list[DiffSegment]


class FormField(BaseModel):
    name: str
    type: str
    page: int
    value: str


class FormFieldsResult(BaseModel):
    fields: list[FormField]


class SummaryResult(BaseModel):
    summary: str
    # Returned so the frontend can hold onto it for follow-up chat
    # questions (/api/pdf/ask) without re-uploading the file or re-running
    # OCR on every single question.
    document_text: str


class ChatMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class AskPayload(BaseModel):
    document_text: str = Field(min_length=1)
    question: str = Field(min_length=1, max_length=2000)
    history: list[ChatMessage] = []


class AskResult(BaseModel):
    answer: str


class ExtractedTable(BaseModel):
    page: int
    rows: list[list[str]]


class TableExtractionResult(BaseModel):
    tables: list[ExtractedTable]


class ExtractedField(BaseModel):
    name: str
    value: str
    valid: bool
    required: bool
    field_type: FieldType
    reason: str | None = None


class VerificationItemIn(BaseModel):
    """
    A standalone, ad-hoc value to check for presence in the document —
    independent of the field builder and not saved as part of any template.
    E.g. label="Buyer GSTIN", value="27AAPFU0939F1ZV".
    """

    label: str = Field(min_length=1, max_length=255)
    value: str = Field(min_length=1, max_length=500)


class VerificationResult(BaseModel):
    label: str
    value: str
    found: bool
    # 1.0 = exact match. Below 1.0, this is how close the nearest match in
    # the document text was — handwriting OCR often misreads a character
    # or two, so a near-miss is still reported instead of a flat "not found".
    similarity: float
    matched_text: str | None = None


class ExtractionResult(BaseModel):
    id: str
    template_id: str | None
    template_name: str | None
    created_at: datetime
    raw_ocr_text: str
    fields: list[ExtractedField]
    verifications: list[VerificationResult] = []

    class Config:
        from_attributes = True


class ExtractionHistoryItem(BaseModel):
    id: str
    template_name: str | None
    created_at: datetime
    preview: str

    class Config:
        from_attributes = True
