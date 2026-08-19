"use client";

import { useState } from "react";
import ToolPageShell from "@/components/tools/ToolPageShell";
import FileDropZone from "@/components/tools/FileDropZone";
import { useToast } from "@/components/Toast";
import { ApiError, excelToPdf } from "@/lib/api";
import { downloadBlob } from "@/lib/toolDownload";

const EXCEL_MIME_TYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
];

export default function ExcelToPdfPage() {
  const { showToast } = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);

  const handleConvert = async () => {
    if (files.length === 0) {
      showToast("Add an Excel file first.", "error");
      return;
    }
    setLoading(true);
    try {
      const blob = await excelToPdf(files[0]);
      downloadBlob(blob, "converted.pdf");
      showToast("PDF downloaded.", "success");
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Conversion failed.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ToolPageShell
      title="Excel to PDF"
      description="Make Excel spreadsheets easy to read by converting them to PDF."
    >
      <div className="space-y-4">
        <FileDropZone
          files={files}
          onChange={setFiles}
          accept=".xls,.xlsx"
          acceptedTypes={EXCEL_MIME_TYPES}
          label="Select Excel file"
        />
        <button
          type="button"
          onClick={handleConvert}
          disabled={loading || files.length === 0}
          className="w-full rounded-md bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? "Converting…" : "Convert to PDF"}
        </button>
      </div>
    </ToolPageShell>
  );
}
