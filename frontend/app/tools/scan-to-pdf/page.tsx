"use client";

import { useState } from "react";
import ToolPageShell from "@/components/tools/ToolPageShell";
import FileDropZone from "@/components/tools/FileDropZone";
import { useToast } from "@/components/Toast";
import { ApiError, scanToPdf } from "@/lib/api";
import { downloadBlob } from "@/lib/toolDownload";

export default function ScanToPdfPage() {
  const { showToast } = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [enhance, setEnhance] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleConvert = async () => {
    if (files.length === 0) {
      showToast("Add at least one photo first.", "error");
      return;
    }
    setLoading(true);
    try {
      const blob = await scanToPdf(files, enhance);
      downloadBlob(blob, "scanned.pdf");
      showToast("PDF downloaded.", "success");
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Conversion failed.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ToolPageShell
      title="Scan to PDF"
      description="Capture document scans (phone photos work too) and turn them into a single PDF."
    >
      <div className="space-y-4">
        <FileDropZone
          files={files}
          onChange={setFiles}
          accept="image/jpeg,image/png,image/webp"
          acceptedTypes={["image/jpeg", "image/jpg", "image/png", "image/webp"]}
          multiple
          label="Select photos"
          hint="or drop them here — one page per photo, in order"
        />
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <input
            type="checkbox"
            checked={enhance}
            onChange={(e) => setEnhance(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-slate-600"
          />
          Auto-enhance (grayscale + contrast boost, like a scanner app)
        </label>
        <button
          type="button"
          onClick={handleConvert}
          disabled={loading || files.length === 0}
          className="w-full rounded-md bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? "Converting…" : `Convert to PDF${files.length > 1 ? ` (${files.length} pages)` : ""}`}
        </button>
      </div>
    </ToolPageShell>
  );
}
