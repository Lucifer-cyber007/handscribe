"use client";

import { useState } from "react";
import ToolPageShell from "@/components/tools/ToolPageShell";
import FileDropZone from "@/components/tools/FileDropZone";
import { useToast } from "@/components/Toast";
import { ApiError, pdfToWord } from "@/lib/api";
import { downloadBlob } from "@/lib/toolDownload";

export default function PdfToWordPage() {
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
      const { blob, isOcrFallback } = await pdfToWord(files[0]);
      downloadBlob(blob, "converted.docx");
      if (isOcrFallback) {
        showToast(
          "This PDF had no extractable text (likely a scan/photo), so it was OCR'd instead — " +
            "the text is editable, but the original layout couldn't be preserved.",
          "info"
        );
      } else {
        showToast("Word document downloaded.", "success");
      }
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Conversion failed.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ToolPageShell
      title="PDF to Word"
      description="Turn a PDF into an editable DOCX document, preserving text, tables, and images as closely as possible."
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
          {loading ? "Converting…" : "Convert to Word"}
        </button>
      </div>
    </ToolPageShell>
  );
}
