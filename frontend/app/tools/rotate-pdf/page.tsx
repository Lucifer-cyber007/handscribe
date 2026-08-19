"use client";

import { useState } from "react";
import ToolPageShell from "@/components/tools/ToolPageShell";
import FileDropZone from "@/components/tools/FileDropZone";
import { useToast } from "@/components/Toast";
import { ApiError, rotatePdf } from "@/lib/api";
import { downloadBlob } from "@/lib/toolDownload";

export default function RotatePdfPage() {
  const { showToast } = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [degrees, setDegrees] = useState(90);
  const [loading, setLoading] = useState(false);

  const handleRotate = async () => {
    if (files.length === 0) {
      showToast("Add a PDF to rotate.", "error");
      return;
    }
    setLoading(true);
    try {
      const blob = await rotatePdf(files[0], degrees);
      downloadBlob(blob, "rotated.pdf");
      showToast("Rotated PDF downloaded.", "success");
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Rotate failed.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ToolPageShell title="Rotate PDF" description="Rotate every page of a PDF by 90, 180, or 270 degrees.">
      <div className="space-y-4">
        <FileDropZone
          files={files}
          onChange={setFiles}
          accept="application/pdf"
          acceptedTypes={["application/pdf"]}
          label="Select PDF file"
        />
        <div>
          <label className="text-sm text-slate-600">Rotation</label>
          <select
            value={degrees}
            onChange={(e) => setDegrees(Number(e.target.value))}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value={90}>90°</option>
            <option value={180}>180°</option>
            <option value={270}>270°</option>
          </select>
        </div>
        <button
          type="button"
          onClick={handleRotate}
          disabled={loading || files.length === 0}
          className="w-full rounded-md bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? "Rotating…" : "Rotate PDF"}
        </button>
      </div>
    </ToolPageShell>
  );
}
