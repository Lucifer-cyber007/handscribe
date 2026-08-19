"use client";

import { useState } from "react";
import ToolPageShell from "@/components/tools/ToolPageShell";
import FileDropZone from "@/components/tools/FileDropZone";
import { useToast } from "@/components/Toast";
import { ApiError, imagesToPdf } from "@/lib/api";
import { downloadBlob } from "@/lib/toolDownload";

export default function JpgToPdfPage() {
  const { showToast } = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);

  const handleConvert = async () => {
    if (files.length === 0) {
      showToast("Add at least one image.", "error");
      return;
    }
    setLoading(true);
    try {
      const blob = await imagesToPdf(files);
      downloadBlob(blob, "images.pdf");
      showToast("PDF downloaded.", "success");
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Conversion failed.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ToolPageShell title="JPG to PDF" description="Convert JPG images into a single PDF in seconds.">
      <div className="space-y-4">
        <FileDropZone
          files={files}
          onChange={setFiles}
          accept="image/jpeg,image/png,image/webp"
          acceptedTypes={["image/jpeg", "image/png", "image/webp"]}
          multiple
          label="Select images"
          hint="or drop them here — JPG, PNG, or WEBP"
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
