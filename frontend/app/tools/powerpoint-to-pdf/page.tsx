"use client";

import { useState } from "react";
import ToolPageShell from "@/components/tools/ToolPageShell";
import FileDropZone from "@/components/tools/FileDropZone";
import { useToast } from "@/components/Toast";
import { ApiError, powerpointToPdf } from "@/lib/api";
import { downloadBlob } from "@/lib/toolDownload";

const POWERPOINT_MIME_TYPES = [
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-powerpoint",
];

export default function PowerpointToPdfPage() {
  const { showToast } = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);

  const handleConvert = async () => {
    if (files.length === 0) {
      showToast("Add a PowerPoint file first.", "error");
      return;
    }
    setLoading(true);
    try {
      const blob = await powerpointToPdf(files[0]);
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
      title="PowerPoint to PDF"
      description="Make PPT and PPTX slideshows easy to view by converting them to PDF."
    >
      <div className="space-y-4">
        <FileDropZone
          files={files}
          onChange={setFiles}
          accept=".ppt,.pptx"
          acceptedTypes={POWERPOINT_MIME_TYPES}
          label="Select PowerPoint file"
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
