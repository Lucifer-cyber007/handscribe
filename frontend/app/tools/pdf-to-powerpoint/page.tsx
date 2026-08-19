"use client";

import { useState } from "react";
import ToolPageShell from "@/components/tools/ToolPageShell";
import FileDropZone from "@/components/tools/FileDropZone";
import { useToast } from "@/components/Toast";
import { ApiError, pdfToPowerpoint } from "@/lib/api";
import { downloadBlob } from "@/lib/toolDownload";

export default function PdfToPowerpointPage() {
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
      const blob = await pdfToPowerpoint(files[0]);
      downloadBlob(blob, "converted.pptx");
      showToast("PowerPoint file downloaded.", "success");
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Conversion failed.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ToolPageShell
      title="PDF to PowerPoint"
      description="Turn each page of a PDF into a slide, ready to present in PowerPoint. Each slide is an image of the page — great for presenting or annotating, but the text itself isn't editable."
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
          {loading ? "Converting…" : "Convert to PowerPoint"}
        </button>
      </div>
    </ToolPageShell>
  );
}
