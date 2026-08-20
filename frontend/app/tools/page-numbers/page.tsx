"use client";

import { useState } from "react";
import ToolPageShell from "@/components/tools/ToolPageShell";
import FileDropZone from "@/components/tools/FileDropZone";
import { useToast } from "@/components/Toast";
import { ApiError, addPageNumbers } from "@/lib/api";
import { downloadBlob } from "@/lib/toolDownload";

const POSITIONS = [
  { value: "bottom-right", label: "Bottom right" },
  { value: "bottom-left", label: "Bottom left" },
  { value: "top-right", label: "Top right" },
  { value: "top-left", label: "Top left" },
  { value: "center", label: "Center" },
];

export default function PageNumbersPage() {
  const { showToast } = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [position, setPosition] = useState("bottom-right");
  const [startNumber, setStartNumber] = useState(1);
  const [loading, setLoading] = useState(false);

  const handleAdd = async () => {
    if (files.length === 0) {
      showToast("Add a PDF first.", "error");
      return;
    }
    setLoading(true);
    try {
      const blob = await addPageNumbers(files[0], position, startNumber);
      downloadBlob(blob, "numbered.pdf");
      showToast("Numbered PDF downloaded.", "success");
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Adding page numbers failed.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ToolPageShell title="Page numbers" description="Add page numbers to a PDF in the position you choose.">
      <div className="space-y-4">
        <FileDropZone
          files={files}
          onChange={setFiles}
          accept="application/pdf"
          acceptedTypes={["application/pdf"]}
          label="Select PDF file"
        />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-slate-600 dark:text-slate-300">Position</label>
            <select
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600"
            >
              {POSITIONS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm text-slate-600 dark:text-slate-300">Start at</label>
            <input
              type="number"
              min={1}
              value={startNumber}
              onChange={(e) => setStartNumber(Number(e.target.value))}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={handleAdd}
          disabled={loading || files.length === 0}
          className="w-full rounded-md bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? "Adding…" : "Add page numbers"}
        </button>
      </div>
    </ToolPageShell>
  );
}
