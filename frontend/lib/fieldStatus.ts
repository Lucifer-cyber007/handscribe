import { ExtractedField } from "./types";

export type FieldStatus = "Missing" | "Check" | "Valid";

export function statusOf(field: ExtractedField): FieldStatus {
  if (field.required && !field.value.trim()) return "Missing";
  if (!field.valid) return "Check";
  return "Valid";
}
