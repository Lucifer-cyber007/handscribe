"use client";

import { useState } from "react";
import ToolPageShell from "@/components/tools/ToolPageShell";
import FileDropZone from "@/components/tools/FileDropZone";
import { useToast } from "@/components/Toast";
import { ApiError, splitPdf } from "@/lib/api";
import { downloadBlob } from "@/lib/toolDownload";

export default function SplitPdfPage() {
  const { showToast } = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [rangesText, setRangesText] = useState("1-1");
  const [loading, setLoading] = useState(false);

  const handleSplit = async () => {
    if (files.length === 0) {
      showToast("Add a PDF to split.", "error");
      return;
    }
    const ranges = rangesText
      .split(",")
      .map((r) => r.trim())
      .filter(Boolean);
    if (ranges.length === 0) {
      showToast("Enter at least one page range, e.g. 1-3.", "error");
      return;
    }
    setLoading(true);
    try {
      const blob = await splitPdf(files[0], ranges);
      downloadBlob(blob, "split.zip");
      showToast("Split PDF downloaded as a ZIP.", "success");
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Split failed.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ToolPageShell title="Split PDF" description="Break a PDF into separate files by page range.">
      <div className="space-y-4">
        <FileDropZone
          files={files}
          onChange={setFiles}
          accept="application/pdf"
          acceptedTypes={["application/pdf"]}
          label="Select PDF file"
        />
        <div>
          <label className="text-sm text-slate-600">
            Page ranges (comma-separated, e.g. <code>1-3, 4-6</code>)
          </label>
          <input
            type="text"
            value={rangesText}
            onChange={(e) => setRangesText(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <button
          type="button"
          onClick={handleSplit}
          disabled={loading || files.length === 0}
          className="w-full rounded-md bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? "Splitting…" : "Split PDF"}
        </button>
      </div>
    </ToolPageShell>
  );
}
