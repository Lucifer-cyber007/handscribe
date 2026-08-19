"use client";

import { useState } from "react";
import ToolPageShell from "@/components/tools/ToolPageShell";
import FileDropZone from "@/components/tools/FileDropZone";
import { useToast } from "@/components/Toast";
import { ApiError, wordToPdf } from "@/lib/api";
import { downloadBlob } from "@/lib/toolDownload";

const WORD_MIME_TYPES = [
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
];

export default function WordToPdfPage() {
  const { showToast } = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);

  const handleConvert = async () => {
    if (files.length === 0) {
      showToast("Add a Word document first.", "error");
      return;
    }
    setLoading(true);
    try {
      const blob = await wordToPdf(files[0]);
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
      title="Word to PDF"
      description="Make DOC and DOCX files easy to view by converting them to PDF."
    >
      <div className="space-y-4">
        <FileDropZone
          files={files}
          onChange={setFiles}
          accept=".doc,.docx"
          acceptedTypes={WORD_MIME_TYPES}
          label="Select Word file"
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
