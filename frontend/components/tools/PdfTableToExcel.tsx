"use client";

import { useState } from "react";
import BatchImageUpload from "@/components/BatchImageUpload";
import { useToast } from "@/components/Toast";
import { runWithConcurrency } from "@/lib/concurrency";
import { ApiError, extractPdfTables } from "@/lib/api";
import { BatchItem, ExtractedTable } from "@/lib/types";

const MAX_FILES = 50;
const CONCURRENCY = 4;

function sanitizeSheetName(fileName: string): string {
  const withoutExtension = fileName.replace(/\.[^/.]+$/, "");
  const cleaned = withoutExtension.replace(/[:\\/?*[\]]/g, " ").trim();
  return (cleaned || "Sheet").slice(0, 28);
}

async function buildAndDownloadWorkbook(
  items: BatchItem[],
  tablesByItemId: Record<string, ExtractedTable[]>
): Promise<void> {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  const usedNames = new Set<string>();

  for (const item of items) {
    const tables = tablesByItemId[item.id];
    if (!tables || tables.length === 0) continue;

    const base = sanitizeSheetName(item.file.name);
    let sheetName = base;
    let suffix = 2;
    while (usedNames.has(sheetName)) {
      sheetName = `${base} ${suffix++}`;
    }
    usedNames.add(sheetName);

    const sheet = workbook.addWorksheet(sheetName);
    for (const table of tables) {
      const labelRow = sheet.addRow([`Page ${table.page}`]);
      labelRow.font = { italic: true, color: { argb: "FF64748B" } };
      const [header, ...rest] = table.rows;
      if (header) {
        const headerRow = sheet.addRow(header);
        headerRow.font = { bold: true };
      }
      rest.forEach((row) => sheet.addRow(row));
      sheet.addRow([]);
    }
    sheet.columns.forEach((col) => {
      col.width = 24;
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "pdfboii-tables.xlsx";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function PdfTableToExcel() {
  const { showToast } = useToast();
  const [items, setItems] = useState<BatchItem[]>([]);
  const [processing, setProcessing] = useState(false);

  const handleConvert = async () => {
    if (items.length === 0) {
      showToast("Add at least one PDF first.", "error");
      return;
    }

    setProcessing(true);
    setItems((prev) => prev.map((item) => ({ ...item, status: "pending" as const, error: undefined })));

    const toProcess = items;
    const tablesByItemId: Record<string, ExtractedTable[]> = {};

    await runWithConcurrency(toProcess, CONCURRENCY, async (item) => {
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, status: "processing" as const } : i))
      );
      try {
        const result = await extractPdfTables(item.file);
        tablesByItemId[item.id] = result.tables;
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, status: "done" as const } : i))
        );
      } catch (err) {
        const message = err instanceof ApiError ? err.message : "Conversion failed.";
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, status: "error" as const, error: message } : i))
        );
      }
    });

    setProcessing(false);

    const successCount = Object.keys(tablesByItemId).length;
    if (successCount === 0) {
      showToast("None of the files could be converted — see the status below.", "error");
      return;
    }

    await buildAndDownloadWorkbook(toProcess, tablesByItemId);
    showToast(
      successCount === toProcess.length
        ? `Excel file downloaded — ${successCount} file(s) converted.`
        : `Excel file downloaded for ${successCount} of ${toProcess.length} file(s) — some failed, see status below.`,
      successCount === toProcess.length ? "success" : "info"
    );
  };

  return (
    <div className="space-y-4">
      <BatchImageUpload
        items={items}
        onChange={setItems}
        maxFiles={MAX_FILES}
        acceptedTypes={["application/pdf"]}
        uploadHint="or click to browse — PDF files only"
      />
      <button
        type="button"
        onClick={handleConvert}
        disabled={processing || items.length === 0}
        className="rounded-md bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {processing
          ? `Converting… (${items.filter((i) => i.status === "done" || i.status === "error").length}/${items.length})`
          : `Convert to Excel${items.length > 1 ? ` (${items.length} files)` : ""}`}
      </button>

      {items.length > 0 && (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white text-sm dark:border-slate-700 dark:divide-slate-700 dark:bg-slate-900">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between px-3 py-2">
              <span className="truncate text-slate-700 dark:text-slate-200">{item.file.name}</span>
              <span
                className={
                  item.status === "done"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : item.status === "error"
                    ? "text-red-600 dark:text-red-400"
                    : item.status === "processing"
                    ? "text-brand-600 dark:text-brand-400"
                    : "text-slate-400 dark:text-slate-500"
                }
              >
                {item.status === "done"
                  ? "Done"
                  : item.status === "error"
                  ? item.error ?? "Failed"
                  : item.status === "processing"
                  ? "Converting…"
                  : "Pending"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
