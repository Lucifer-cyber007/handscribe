"use client";

import { useState } from "react";
import ToolPageShell from "@/components/tools/ToolPageShell";
import FileDropZone from "@/components/tools/FileDropZone";
import { useToast } from "@/components/Toast";
import { ApiError, cropPdf } from "@/lib/api";
import { downloadBlob } from "@/lib/toolDownload";

export default function CropPdfPage() {
  const { showToast } = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [margins, setMargins] = useState({ left: 0, top: 0, right: 0, bottom: 0 });
  const [loading, setLoading] = useState(false);

  const handleCrop = async () => {
    if (files.length === 0) {
      showToast("Add a PDF to crop.", "error");
      return;
    }
    setLoading(true);
    try {
      const blob = await cropPdf(files[0], margins);
      downloadBlob(blob, "cropped.pdf");
      showToast("Cropped PDF downloaded.", "success");
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Crop failed.", "error");
    } finally {
      setLoading(false);
    }
  };

  const marginInput = (key: keyof typeof margins, label: string) => (
    <div>
      <label className="text-sm text-slate-600">{label} margin (points)</label>
      <input
        type="number"
        min={0}
        value={margins[key]}
        onChange={(e) => setMargins((m) => ({ ...m, [key]: Number(e.target.value) }))}
        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
    </div>
  );

  return (
    <ToolPageShell title="Crop PDF" description="Trim margins from every page of a PDF.">
      <div className="space-y-4">
        <FileDropZone
          files={files}
          onChange={setFiles}
          accept="application/pdf"
          acceptedTypes={["application/pdf"]}
          label="Select PDF file"
        />
        <div className="grid grid-cols-2 gap-3">
          {marginInput("left", "Left")}
          {marginInput("top", "Top")}
          {marginInput("right", "Right")}
          {marginInput("bottom", "Bottom")}
        </div>
        <button
          type="button"
          onClick={handleCrop}
          disabled={loading || files.length === 0}
          className="w-full rounded-md bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? "Cropping…" : "Crop PDF"}
        </button>
      </div>
    </ToolPageShell>
  );
}
