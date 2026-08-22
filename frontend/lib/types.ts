export interface User {
  id: string;
  email: string;
  name: string;
  is_subscribed: boolean;
}

export interface AuthResponse {
  access_token: string;
  user: User;
}

export type RGBColor = [number, number, number]; // 0-1 float range

interface EditObjectBase {
  page: number; // 1-based
  x: number; // PDF points, top-left origin
  y: number;
  width: number;
  height: number;
  rotation: number;
}

export interface TextEditObject extends EditObjectBase {
  type: "text";
  content: string;
  fontSize: number;
  color: RGBColor;
}

export interface ShapeEditObject extends EditObjectBase {
  type: "rect" | "ellipse";
  strokeColor: RGBColor;
  strokeWidth: number;
  fillColor: RGBColor | null;
}

export interface LineEditObject extends EditObjectBase {
  type: "line";
  x2: number;
  y2: number;
  strokeColor: RGBColor;
  strokeWidth: number;
}

export interface PathEditObject extends EditObjectBase {
  type: "path";
  points: [number, number][];
  strokeColor: RGBColor;
  strokeWidth: number;
}

export interface ImageEditObject extends EditObjectBase {
  type: "image";
  dataUrl: string;
}

export type EditObject =
  | TextEditObject
  | ShapeEditObject
  | LineEditObject
  | PathEditObject
  | ImageEditObject;

export type FieldType =
  | "numeric"
  | "alphabetic"
  | "alphanumeric"
  | "date"
  | "currency"
  | "email"
  | "phone"
  | "gst_number"
  | "custom_regex";

export const FIELD_TYPE_OPTIONS: { value: FieldType; label: string }[] = [
  { value: "numeric", label: "Numeric" },
  { value: "alphabetic", label: "Alphabetic" },
  { value: "alphanumeric", label: "Alphanumeric" },
  { value: "date", label: "Date" },
  { value: "currency", label: "Currency" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "gst_number", label: "GST Number" },
  { value: "custom_regex", label: "Custom Regex" },
];

export interface FieldSchema {
  id?: string;
  name: string;
  field_type: FieldType;
  regex_pattern?: string | null;
  required: boolean;
  position?: number;
}

export interface Template {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  fields: FieldSchema[];
}

export interface ExtractedField {
  name: string;
  value: string;
  valid: boolean;
  required: boolean;
  field_type: FieldType;
  reason?: string | null;
}

export interface VerificationItem {
  label: string;
  value: string;
}

export interface VerificationResult {
  label: string;
  value: string;
  found: boolean;
  similarity: number;
  matched_text?: string | null;
}

export interface ExtractionResult {
  id: string;
  template_id: string | null;
  template_name: string | null;
  created_at: string;
  raw_ocr_text: string;
  fields: ExtractedField[];
  verifications: VerificationResult[];
}

export interface ExtractionHistoryItem {
  id: string;
  template_name: string | null;
  created_at: string;
  preview: string;
}

export interface ExtractedTable {
  page: number;
  rows: string[][];
}

export interface TableExtractionResult {
  tables: ExtractedTable[];
}

export type DiffSegmentType = "equal" | "replace" | "delete" | "insert";

export interface DiffSegment {
  type: DiffSegmentType;
  a_lines: string[];
  b_lines: string[];
}

export interface CompareResult {
  segments: DiffSegment[];
}

export type FormFieldType = "text" | "checkbox" | "radio" | "select" | "signature";

export interface FormField {
  name: string;
  type: FormFieldType;
  page: number;
  value: string;
}

export interface FormFieldsResult {
  fields: FormField[];
}

export interface SummaryResult {
  summary: string;
  document_text: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AskResult {
  answer: string;
}

export type BatchItemStatus = "pending" | "processing" | "done" | "error";

export interface BatchItem {
  id: string;
  file: File;
  status: BatchItemStatus;
  result?: ExtractionResult;
  error?: string;
}
