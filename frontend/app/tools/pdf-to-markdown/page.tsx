"use client";

import { useState } from "react";
import ToolPageShell from "@/components/tools/ToolPageShell";
import FileDropZone from "@/components/tools/FileDropZone";
import { useToast } from "@/components/Toast";
import { ApiError, pdfToMarkdown } from "@/lib/api";
import { downloadBlob } from "@/lib/toolDownload";

export default function PdfToMarkdownPage() {
  const { showToast } = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);

  const handleConvert = async () => {
    if (files.length === 0) {
      showToast("Add a PDF first.", "error");
      return;
    }
    setLoading(true);
    try {
      const { blob, isOcrFallback } = await pdfToMarkdown(files[0]);
      downloadBlob(blob, "converted.md");
      if (isOcrFallback) {
        showToast(
          "This PDF had no extractable text (likely a scan/photo), so it was OCR'd instead — " +
            "headings and tables couldn't be detected, just plain text.",
          "info"
        );
      } else {
        showToast("Markdown file downloaded.", "success");
      }
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Conversion failed.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ToolPageShell
      title="PDF to Markdown"
      description="Turn a PDF into a Markdown file, with headings and tables reconstructed — perfect for notes, docs, and LLMs."
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
          onClick={handleConvert}
          disabled={loading || files.length === 0}
          className="w-full rounded-md bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? "Converting…" : "Convert to Markdown"}
        </button>
      </div>
    </ToolPageShell>
  );
}
