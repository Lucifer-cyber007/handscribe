"use client";

import { useState } from "react";
import ToolPageShell from "@/components/tools/ToolPageShell";
import FileDropZone from "@/components/tools/FileDropZone";
import { useToast } from "@/components/Toast";
import { ApiError, mergePdfs } from "@/lib/api";
import { downloadBlob } from "@/lib/toolDownload";

export default function MergePdfPage() {
  const { showToast } = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);

  const handleMerge = async () => {
    if (files.length < 2) {
      showToast("Add at least two PDFs to merge.", "error");
      return;
    }
    setLoading(true);
    try {
      const blob = await mergePdfs(files);
      downloadBlob(blob, "merged.pdf");
      showToast("Merged PDF downloaded.", "success");
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Merge failed.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ToolPageShell title="Merge PDF" description="Combine multiple PDFs into one document, in the order you add them.">
      <div className="space-y-4">
        <FileDropZone
          files={files}
          onChange={setFiles}
          accept="application/pdf"
          acceptedTypes={["application/pdf"]}
          multiple
          label="Select PDF files"
          hint="or drop them here — add at least two"
        />
        <button
          type="button"
          onClick={handleMerge}
          disabled={loading || files.length < 2}
          className="w-full rounded-md bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? "Merging…" : "Merge PDF"}
        </button>
      </div>
    </ToolPageShell>
  );
}
