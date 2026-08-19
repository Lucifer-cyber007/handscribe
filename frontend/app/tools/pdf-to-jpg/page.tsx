"use client";

import { useState } from "react";
import ToolPageShell from "@/components/tools/ToolPageShell";
import FileDropZone from "@/components/tools/FileDropZone";
import { useToast } from "@/components/Toast";
import { ApiError, pdfToJpg } from "@/lib/api";
import { downloadBlob } from "@/lib/toolDownload";

export default function PdfToJpgPage() {
  const { showToast } = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [dpi, setDpi] = useState(150);
  const [loading, setLoading] = useState(false);

  const handleConvert = async () => {
    if (files.length === 0) {
      showToast("Add a PDF first.", "error");
      return;
    }
    setLoading(true);
    try {
      const blob = await pdfToJpg(files[0], dpi);
      downloadBlob(blob, "pages.zip");
      showToast("Pages downloaded as a ZIP of JPGs.", "success");
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Conversion failed.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ToolPageShell title="PDF to JPG" description="Convert each PDF page into a JPG image.">
      <div className="space-y-4">
        <FileDropZone
          files={files}
          onChange={setFiles}
          accept="application/pdf"
          acceptedTypes={["application/pdf"]}
          label="Select PDF file"
        />
        <div>
          <label className="text-sm text-slate-600">Image quality (DPI)</label>
          <input
            type="number"
            min={50}
            max={600}
            value={dpi}
            onChange={(e) => setDpi(Number(e.target.value))}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <button
          type="button"
          onClick={handleConvert}
          disabled={loading || files.length === 0}
          className="w-full rounded-md bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? "Converting…" : "Convert to JPG"}
        </button>
      </div>
    </ToolPageShell>
  );
}
