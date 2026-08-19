"use client";

import { useMemo } from "react";
import { statusOf } from "@/lib/fieldStatus";
import { CHECK_FILL, DUPLICATE_FILL } from "@/lib/excelStyles";
import { BatchItem } from "@/lib/types";
import { useToast } from "@/components/Toast";

interface BatchResultsTableProps {
  items: BatchItem[];
  onChange: (items: BatchItem[]) => void;
}

const INVOICE_NUMBER_NAMES = new Set(["invoice number", "invoice no", "invoice no."]);

function isInvoiceNumberField(name: string): boolean {
  return INVOICE_NUMBER_NAMES.has(name.trim().toLowerCase());
}

export default function BatchResultsTable({ items, onChange }: BatchResultsTableProps) {
  const { showToast } = useToast();

  // All documents in a batch share one field/verification schema, so pull
  // column order from the first successful result.
  const firstDone = useMemo(
    () => items.find((i) => i.status === "done" && i.result),
    [items]
  );
  const fieldNames = firstDone?.result?.fields.map((f) => f.name) ?? [];
  const verificationLabels = firstDone?.result?.verifications.map((v) => v.label) ?? [];

  // Values that repeat across more than one document's Invoice Number field.
  const duplicateInvoiceNumbers = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) {
      if (item.status !== "done" || !item.result) continue;
      for (const field of item.result.fields) {
        if (!isInvoiceNumberField(field.name)) continue;
        const value = field.value.trim();
        if (!value) continue;
        counts.set(value, (counts.get(value) ?? 0) + 1);
      }
    }
    return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([v]) => v));
  }, [items]);

  const doneCount = items.filter((i) => i.status === "done").length;
  const errorCount = items.filter((i) => i.status === "error").length;
  const pendingCount = items.length - doneCount - errorCount;

  const updateFieldValue = (itemId: string, fieldIndex: number, value: string) => {
    onChange(
      items.map((item) => {
        if (item.id !== itemId || !item.result) return item;
        const fields = item.result.fields.slice();
        fields[fieldIndex] = { ...fields[fieldIndex], value };
        return { ...item, result: { ...item.result, fields } };
      })
    );
  };

  const exportCsv = () => {
    const headers = ["Source File", ...fieldNames, ...verificationLabels.map((l) => `${l} (verified)`)];
    const rows = items.map((item) => {
      if (item.status !== "done" || !item.result) {
        return [item.file.name, `ERROR: ${item.error ?? "not processed"}`];
      }
      const values = item.result.fields.map((f) => f.value);
      const verifs = item.result.verifications.map((v) => (v.found ? "Found" : "Not found"));
      return [item.file.name, ...values, ...verifs];
    });
    const escape = (cell: string) => {
      const escaped = cell.replace(/"/g, '""');
      return /[",\n]/.test(cell) ? `"${escaped}"` : escaped;
    };
    const csv = [headers, ...rows].map((row) => row.map(escape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "handscribe-extraction.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportExcel = async () => {
    try {
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Extraction");

      const headers = ["Source File", ...fieldNames, ...verificationLabels.map((l) => `${l} (verified)`)];
      const headerRow = sheet.addRow(headers);
      headerRow.font = { bold: true };

      for (const item of items) {
        if (item.status !== "done" || !item.result) {
          const row = sheet.addRow([item.file.name, `ERROR: ${item.error ?? "not processed"}`]);
          row.getCell(2).fill = DUPLICATE_FILL;
          continue;
        }
        const values = item.result.fields.map((f) => f.value);
        const verifs = item.result.verifications.map((v) => (v.found ? "Found" : "Not found"));
        const row = sheet.addRow([item.file.name, ...values, ...verifs]);

        item.result.fields.forEach((field, index) => {
          const column = index + 2; // +1 for 1-based, +1 for Source File column
          const isDuplicate =
            isInvoiceNumberField(field.name) && duplicateInvoiceNumbers.has(field.value.trim());
          if (isDuplicate) {
            row.getCell(column).fill = DUPLICATE_FILL;
          } else if (statusOf(field) === "Check") {
            row.getCell(column).fill = CHECK_FILL;
          }
        });

        item.result.verifications.forEach((v, index) => {
          const column = index + 2 + fieldNames.length;
          if (!v.found) row.getCell(column).fill = CHECK_FILL;
        });
      }

      sheet.columns.forEach((col) => {
        col.width = 22;
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "handscribe-extraction.xlsx";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      showToast("Couldn't generate the Excel file.", "error");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600">
          {doneCount} processed
          {errorCount > 0 && `, ${errorCount} failed`}
          {pendingCount > 0 && `, ${pendingCount} pending`}
          {duplicateInvoiceNumbers.size > 0 &&
            ` — ${duplicateInvoiceNumbers.size} duplicate invoice number(s) found`}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={exportCsv}
            disabled={doneCount === 0}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={exportExcel}
            disabled={doneCount === 0}
            className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            title="Highlights 'Check' fields in orange and duplicate invoice numbers in red"
          >
            Export Excel
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="whitespace-nowrap px-4 py-2">Source File</th>
              {fieldNames.map((name) => (
                <th key={name} className="whitespace-nowrap px-4 py-2">
                  {name}
                </th>
              ))}
              {verificationLabels.map((label) => (
                <th key={label} className="whitespace-nowrap px-4 py-2">
                  {label} (verified)
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item) => (
              <tr key={item.id}>
                <td className="whitespace-nowrap px-4 py-2 font-medium text-slate-700">
                  {item.file.name}
                </td>
                {item.status !== "done" || !item.result ? (
                  <td
                    colSpan={fieldNames.length + verificationLabels.length || 1}
                    className={`px-4 py-2 text-xs ${
                      item.status === "error" ? "text-red-600" : "text-slate-400"
                    }`}
                  >
                    {item.status === "error"
                      ? `Error: ${item.error ?? "extraction failed"}`
                      : item.status === "processing"
                      ? "Processing…"
                      : "Pending…"}
                  </td>
                ) : (
                  <>
                    {item.result.fields.map((field, fieldIndex) => {
                      const isDuplicate =
                        isInvoiceNumberField(field.name) &&
                        duplicateInvoiceNumbers.has(field.value.trim());
                      const status = statusOf(field);
                      const bg = isDuplicate
                        ? "bg-red-100"
                        : status === "Check"
                        ? "bg-orange-100"
                        : status === "Missing"
                        ? "bg-red-50"
                        : "";
                      return (
                        <td key={field.name} className={`px-2 py-1 ${bg}`}>
                          <input
                            type="text"
                            value={field.value}
                            onChange={(e) => updateFieldValue(item.id, fieldIndex, e.target.value)}
                            className="w-32 rounded border border-transparent bg-transparent px-1.5 py-1 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                          />
                        </td>
                      );
                    })}
                    {item.result.verifications.map((v) => (
                      <td
                        key={v.label}
                        className={`whitespace-nowrap px-4 py-2 text-xs ${
                          v.found ? "text-emerald-700" : "text-red-600"
                        }`}
                      >
                        {v.found ? "✓ Found" : "✗ Not found"}
                      </td>
                    ))}
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
