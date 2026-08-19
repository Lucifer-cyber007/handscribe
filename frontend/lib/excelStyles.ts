import type ExcelJS from "exceljs";

// Field needs manual verification (status "Check").
export const CHECK_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFFFE0B2" }, // light orange
};

// Value duplicates another row in the same batch (e.g. repeated invoice number).
export const DUPLICATE_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFFFCDD2" }, // light red/pink
};
