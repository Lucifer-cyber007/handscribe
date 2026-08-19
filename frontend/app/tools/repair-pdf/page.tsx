"use client";

import { useState } from "react";
import ToolPageShell from "@/components/tools/ToolPageShell";
import FileDropZone from "@/components/tools/FileDropZone";
import { useToast } from "@/components/Toast";
import { ApiError, repairPdf } from "@/lib/api";
import { downloadBlob } from "@/lib/toolDownload";

export default function RepairPdfPage() {
  const { showToast } = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);

  const handleRepair = async () => {
    if (files.length === 0) {
      showToast("Add a PDF first.", "error");
      return;
    }
    setLoading(true);
    try {
      const blob = await repairPdf(files[0]);
      downloadBlob(blob, "repaired.pdf");
      showToast("Repaired PDF downloaded.", "success");
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Repair failed.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ToolPageShell
      title="Repair PDF"
      description="Fix a damaged PDF and recover its data by rebuilding its internal structure."
    >
      <div className="space-y-4">
        <FileDropZone
          files={files}
          onChange={setFiles}
          accept="application/pdf"
          acceptedTypes={["application/pdf"]}
          label="Select PDF file"
        />
        <button
          type="button"
          onClick={handleRepair}
          disabled={loading || files.length === 0}
          className="w-full rounded-md bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? "Repairing…" : "Repair PDF"}
        </button>
      </div>
    </ToolPageShell>
  );
}
