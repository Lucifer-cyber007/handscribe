"use client";

import { useState } from "react";
import ToolPageShell from "@/components/tools/ToolPageShell";
import FileDropZone from "@/components/tools/FileDropZone";
import { useToast } from "@/components/Toast";
import { ApiError, compressPdf } from "@/lib/api";
import { downloadBlob } from "@/lib/toolDownload";

export default function CompressPdfPage() {
  const { showToast } = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);

  const handleCompress = async () => {
    if (files.length === 0) {
      showToast("Add a PDF first.", "error");
      return;
    }
    setLoading(true);
    try {
      const original = files[0].size;
      const blob = await compressPdf(files[0]);
      downloadBlob(blob, "compressed.pdf");
      const savedPct = Math.max(0, Math.round((1 - blob.size / original) * 100));
      showToast(
        savedPct > 0
          ? `Compressed PDF downloaded — ${savedPct}% smaller.`
          : "Compressed PDF downloaded (already well-optimized, minimal size change).",
        "success"
      );
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Compression failed.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ToolPageShell title="Compress PDF" description="Reduce a PDF's file size with a lossless cleanup pass.">
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
          onClick={handleCompress}
          disabled={loading || files.length === 0}
          className="w-full rounded-md bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? "Compressing…" : "Compress PDF"}
        </button>
      </div>
    </ToolPageShell>
  );
}
