import type {
  AskResult,
  AuthResponse,
  ChatMessage,
  CompareResult,
  EditObject,
  ExtractionHistoryItem,
  ExtractionResult,
  FieldSchema,
  FormFieldsResult,
  SummaryResult,
  TableExtractionResult,
  Template,
  User,
  VerificationItem,
} from "./types";
import { getToken } from "./authToken";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

function authHeaders(): HeadersInit {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `Request failed with status ${res.status}`;
    try {
      const body = await res.json();
      message = body.detail ? String(body.detail) : message;
    } catch {
      // response wasn't JSON — keep the generic message
    }
    throw new ApiError(message, res.status);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

async function handleBlobResponse(res: Response): Promise<Blob> {
  if (!res.ok) {
    let message = `Request failed with status ${res.status}`;
    try {
      const body = await res.json();
      message = body.detail ? String(body.detail) : message;
    } catch {
      // response wasn't JSON — keep the generic message
    }
    throw new ApiError(message, res.status);
  }
  return res.blob();
}

export async function listTemplates(): Promise<Template[]> {
  const res = await fetch(`${API_BASE}/api/templates`, {
    cache: "no-store",
    headers: authHeaders(),
  });
  return handleResponse<Template[]>(res);
}

export async function createTemplate(
  name: string,
  fields: FieldSchema[]
): Promise<Template> {
  const res = await fetch(`${API_BASE}/api/templates`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ name, fields }),
  });
  return handleResponse<Template>(res);
}

export async function updateTemplate(
  id: string,
  name: string,
  fields: FieldSchema[]
): Promise<Template> {
  const res = await fetch(`${API_BASE}/api/templates/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ name, fields }),
  });
  return handleResponse<Template>(res);
}

export async function deleteTemplate(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/templates/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  return handleResponse<void>(res);
}

export async function signup(email: string, password: string, name: string): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name }),
  });
  return handleResponse<AuthResponse>(res);
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return handleResponse<AuthResponse>(res);
}

export async function googleSignIn(idToken: string): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/api/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id_token: idToken }),
  });
  return handleResponse<AuthResponse>(res);
}

export async function getMe(): Promise<User> {
  const res = await fetch(`${API_BASE}/api/auth/me`, {
    cache: "no-store",
    headers: authHeaders(),
  });
  return handleResponse<User>(res);
}

export async function extractDocument(params: {
  image: File;
  templateId?: string;
  fields?: FieldSchema[];
  verifications?: VerificationItem[];
}): Promise<ExtractionResult> {
  const form = new FormData();
  form.append("image", params.image);
  if (params.templateId) {
    form.append("template_id", params.templateId);
  } else if (params.fields) {
    form.append("fields_json", JSON.stringify({ fields: params.fields }));
  }
  if (params.verifications && params.verifications.length > 0) {
    form.append("verifications_json", JSON.stringify({ verifications: params.verifications }));
  }
  const res = await fetch(`${API_BASE}/api/extract`, {
    method: "POST",
    headers: authHeaders(),
    body: form,
  });
  return handleResponse<ExtractionResult>(res);
}

export async function listHistory(): Promise<ExtractionHistoryItem[]> {
  const res = await fetch(`${API_BASE}/api/history`, { cache: "no-store" });
  return handleResponse<ExtractionHistoryItem[]>(res);
}

// --- PDF tools ---

export async function mergePdfs(files: File[]): Promise<Blob> {
  const form = new FormData();
  files.forEach((f) => form.append("files", f));
  const res = await fetch(`${API_BASE}/api/pdf/merge`, { method: "POST", body: form });
  return handleBlobResponse(res);
}

export async function splitPdf(file: File, ranges: string[]): Promise<Blob> {
  const form = new FormData();
  form.append("file", file);
  form.append("ranges_json", JSON.stringify({ ranges }));
  const res = await fetch(`${API_BASE}/api/pdf/split`, { method: "POST", body: form });
  return handleBlobResponse(res);
}

export async function rotatePdf(
  file: File,
  degrees: number,
  pages?: number[]
): Promise<Blob> {
  const form = new FormData();
  form.append("file", file);
  form.append("degrees", String(degrees));
  if (pages && pages.length > 0) form.append("pages_json", JSON.stringify(pages));
  const res = await fetch(`${API_BASE}/api/pdf/rotate`, { method: "POST", body: form });
  return handleBlobResponse(res);
}

export async function organizePdf(file: File, pageOrder: number[]): Promise<Blob> {
  const form = new FormData();
  form.append("file", file);
  form.append("page_order_json", JSON.stringify({ page_order: pageOrder }));
  const res = await fetch(`${API_BASE}/api/pdf/organize`, { method: "POST", body: form });
  return handleBlobResponse(res);
}

export async function cropPdf(
  file: File,
  margins: { left: number; top: number; right: number; bottom: number },
  pages?: number[]
): Promise<Blob> {
  const form = new FormData();
  form.append("file", file);
  form.append("left", String(margins.left));
  form.append("top", String(margins.top));
  form.append("right", String(margins.right));
  form.append("bottom", String(margins.bottom));
  if (pages && pages.length > 0) form.append("pages_json", JSON.stringify(pages));
  const res = await fetch(`${API_BASE}/api/pdf/crop`, { method: "POST", body: form });
  return handleBlobResponse(res);
}

export async function addPageNumbers(
  file: File,
  position: string,
  startNumber = 1
): Promise<Blob> {
  const form = new FormData();
  form.append("file", file);
  form.append("position", position);
  form.append("start_number", String(startNumber));
  const res = await fetch(`${API_BASE}/api/pdf/page-numbers`, { method: "POST", body: form });
  return handleBlobResponse(res);
}

export async function addWatermark(
  file: File,
  params: { text?: string; image?: File; opacity: number; position: string }
): Promise<Blob> {
  const form = new FormData();
  form.append("file", file);
  if (params.text) form.append("text", params.text);
  if (params.image) form.append("watermark_image", params.image);
  form.append("opacity", String(params.opacity));
  form.append("position", params.position);
  const res = await fetch(`${API_BASE}/api/pdf/watermark`, { method: "POST", body: form });
  return handleBlobResponse(res);
}

export async function protectPdf(file: File, password: string): Promise<Blob> {
  const form = new FormData();
  form.append("file", file);
  form.append("password", password);
  const res = await fetch(`${API_BASE}/api/pdf/protect`, { method: "POST", body: form });
  return handleBlobResponse(res);
}

export async function unlockPdf(file: File, password: string): Promise<Blob> {
  const form = new FormData();
  form.append("file", file);
  form.append("password", password);
  const res = await fetch(`${API_BASE}/api/pdf/unlock`, { method: "POST", body: form });
  return handleBlobResponse(res);
}

export async function pdfToJpg(file: File, dpi = 150): Promise<Blob> {
  const form = new FormData();
  form.append("file", file);
  form.append("dpi", String(dpi));
  const res = await fetch(`${API_BASE}/api/pdf/to-jpg`, { method: "POST", body: form });
  return handleBlobResponse(res);
}

export async function imagesToPdf(files: File[]): Promise<Blob> {
  const form = new FormData();
  files.forEach((f) => form.append("files", f));
  const res = await fetch(`${API_BASE}/api/pdf/from-images`, { method: "POST", body: form });
  return handleBlobResponse(res);
}

export async function compressPdf(file: File): Promise<Blob> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/api/pdf/compress`, { method: "POST", body: form });
  return handleBlobResponse(res);
}

export interface PdfToWordResult {
  blob: Blob;
  /** True when the PDF had no extractable text layer (a scan/photo), so the
   * backend fell back to OCR + a plain-text .docx instead of a
   * layout-preserving conversion. */
  isOcrFallback: boolean;
}

export async function pdfToWord(file: File): Promise<PdfToWordResult> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/api/pdf/to-word`, { method: "POST", body: form });
  const blob = await handleBlobResponse(res);
  return { blob, isOcrFallback: res.headers.get("X-Conversion-Fallback") === "no-text-layer" };
}

export async function wordToPdf(file: File): Promise<Blob> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/api/pdf/from-word`, { method: "POST", body: form });
  return handleBlobResponse(res);
}

export interface PdfToMarkdownResult {
  blob: Blob;
  /** True when the PDF had no extractable text layer (a scan/photo), so the
   * backend fell back to OCR + plain-text Markdown instead of a
   * structure-preserving conversion (headings/tables). */
  isOcrFallback: boolean;
}

export async function pdfToMarkdown(file: File): Promise<PdfToMarkdownResult> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/api/pdf/to-markdown`, { method: "POST", body: form });
  const blob = await handleBlobResponse(res);
  return { blob, isOcrFallback: res.headers.get("X-Conversion-Fallback") === "no-text-layer" };
}

export async function powerpointToPdf(file: File): Promise<Blob> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/api/pdf/from-powerpoint`, { method: "POST", body: form });
  return handleBlobResponse(res);
}

export async function pdfToPowerpoint(file: File): Promise<Blob> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/api/pdf/to-powerpoint`, { method: "POST", body: form });
  return handleBlobResponse(res);
}

export interface TranslatePdfResult {
  blob: Blob;
  /** True when the PDF had no extractable text layer for layout-preserving
   * Document Translation, and the backend fell back to OCR + plain-text
   * translation instead (a .txt result, not a translated PDF). */
  isTextFallback: boolean;
}

export async function translatePdf(
  file: File,
  sourceLanguage: string | null,
  targetLanguage: string
): Promise<TranslatePdfResult> {
  const form = new FormData();
  form.append("file", file);
  if (sourceLanguage) form.append("source_language", sourceLanguage);
  form.append("target_language", targetLanguage);
  const res = await fetch(`${API_BASE}/api/pdf/translate`, { method: "POST", body: form });
  const blob = await handleBlobResponse(res);
  return { blob, isTextFallback: res.headers.get("X-Translation-Fallback") === "no-text-layer" };
}

export async function repairPdf(file: File): Promise<Blob> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/api/pdf/repair`, { method: "POST", body: form });
  return handleBlobResponse(res);
}

export async function pdfToPdfA(file: File): Promise<Blob> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/api/pdf/to-pdfa`, { method: "POST", body: form });
  return handleBlobResponse(res);
}

export async function editPdf(file: File, objects: EditObject[]): Promise<Blob> {
  const form = new FormData();
  form.append("file", file);
  form.append("edits_json", JSON.stringify({ objects }));
  const res = await fetch(`${API_BASE}/api/pdf/edit`, { method: "POST", body: form });
  return handleBlobResponse(res);
}

export async function scanToPdf(files: File[], enhance: boolean): Promise<Blob> {
  const form = new FormData();
  files.forEach((f) => form.append("files", f));
  form.append("enhance", String(enhance));
  const res = await fetch(`${API_BASE}/api/pdf/scan-to-pdf`, { method: "POST", body: form });
  return handleBlobResponse(res);
}

export async function excelToPdf(file: File): Promise<Blob> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/api/pdf/from-excel`, { method: "POST", body: form });
  return handleBlobResponse(res);
}

export async function htmlToPdf(url: string): Promise<Blob> {
  const form = new FormData();
  form.append("url", url);
  const res = await fetch(`${API_BASE}/api/pdf/from-html`, { method: "POST", body: form });
  return handleBlobResponse(res);
}

export async function redactPdf(file: File, terms: string[]): Promise<Blob> {
  const form = new FormData();
  form.append("file", file);
  form.append("terms_json", JSON.stringify({ terms }));
  const res = await fetch(`${API_BASE}/api/pdf/redact`, { method: "POST", body: form });
  return handleBlobResponse(res);
}

export async function getFormFields(file: File): Promise<FormFieldsResult> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/api/pdf/form-fields`, { method: "POST", body: form });
  return handleResponse<FormFieldsResult>(res);
}

export async function fillForm(file: File, values: Record<string, string>): Promise<Blob> {
  const form = new FormData();
  form.append("file", file);
  form.append("values_json", JSON.stringify(values));
  const res = await fetch(`${API_BASE}/api/pdf/fill-form`, { method: "POST", body: form });
  return handleBlobResponse(res);
}

export async function comparePdfs(fileA: File, fileB: File): Promise<CompareResult> {
  const form = new FormData();
  form.append("file_a", fileA);
  form.append("file_b", fileB);
  const res = await fetch(`${API_BASE}/api/pdf/compare`, { method: "POST", body: form });
  return handleResponse<CompareResult>(res);
}

export async function summarizePdf(file: File): Promise<SummaryResult> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/api/pdf/summarize`, { method: "POST", body: form });
  return handleResponse<SummaryResult>(res);
}

export async function askAboutPdf(
  documentText: string,
  question: string,
  history: ChatMessage[]
): Promise<AskResult> {
  const res = await fetch(`${API_BASE}/api/pdf/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ document_text: documentText, question, history }),
  });
  return handleResponse<AskResult>(res);
}

export async function extractPdfTables(file: File): Promise<TableExtractionResult> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/api/pdf/extract-tables`, { method: "POST", body: form });
  return handleResponse<TableExtractionResult>(res);
}

export async function ocrPdf(file: File): Promise<Blob> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/api/pdf/ocr`, { method: "POST", body: form });
  return handleBlobResponse(res);
}
