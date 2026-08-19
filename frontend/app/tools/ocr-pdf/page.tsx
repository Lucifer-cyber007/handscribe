"use client";

import { useState } from "react";
import ToolPageShell from "@/components/tools/ToolPageShell";
import FileDropZone from "@/components/tools/FileDropZone";
import { useToast } from "@/components/Toast";
import { ApiError, ocrPdf } from "@/lib/api";
import { downloadBlob } from "@/lib/toolDownload";

export default function OcrPdfPage() {
  const { showToast } = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);

  const handleOcr = async () => {
    if (files.length === 0) {
      showToast("Add a PDF first.", "error");
      return;
    }
    setLoading(true);
    try {
      const blob = await ocrPdf(files[0]);
      downloadBlob(blob, "ocr-text.txt");
      showToast("Extracted text downloaded.", "success");
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "OCR failed.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ToolPageShell
      title="OCR PDF"
      description="Extract the text from a scanned PDF using OCR — downloads as a plain-text file. (Only the first 5 pages are processed on longer documents.)"
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
          onClick={handleOcr}
          disabled={loading || files.length === 0}
          className="w-full rounded-md bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? "Running OCR…" : "Extract text"}
        </button>
      </div>
    </ToolPageShell>
  );
}
