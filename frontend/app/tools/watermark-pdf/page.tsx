"use client";

import { useState } from "react";
import ToolPageShell from "@/components/tools/ToolPageShell";
import FileDropZone from "@/components/tools/FileDropZone";
import { useToast } from "@/components/Toast";
import { ApiError, addWatermark } from "@/lib/api";
import { downloadBlob } from "@/lib/toolDownload";

const POSITIONS = [
  { value: "center", label: "Center" },
  { value: "top-left", label: "Top left" },
  { value: "top-right", label: "Top right" },
  { value: "bottom-left", label: "Bottom left" },
  { value: "bottom-right", label: "Bottom right" },
];

export default function WatermarkPdfPage() {
  const { showToast } = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [text, setText] = useState("");
  const [opacity, setOpacity] = useState(0.3);
  const [position, setPosition] = useState("center");
  const [loading, setLoading] = useState(false);

  const handleWatermark = async () => {
    if (files.length === 0) {
      showToast("Add a PDF first.", "error");
      return;
    }
    if (!text.trim()) {
      showToast("Enter watermark text.", "error");
      return;
    }
    setLoading(true);
    try {
      const blob = await addWatermark(files[0], { text, opacity, position });
      downloadBlob(blob, "watermarked.pdf");
      showToast("Watermarked PDF downloaded.", "success");
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Watermark failed.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ToolPageShell title="Watermark" description="Stamp text over every page of a PDF.">
      <div className="space-y-4">
        <FileDropZone
          files={files}
          onChange={setFiles}
          accept="application/pdf"
          acceptedTypes={["application/pdf"]}
          label="Select PDF file"
        />
        <div>
          <label className="text-sm text-slate-600">Watermark text</label>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. CONFIDENTIAL"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-slate-600">Position</label>
            <select
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              {POSITIONS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm text-slate-600">Opacity ({opacity})</label>
            <input
              type="range"
              min={0.1}
              max={1}
              step={0.1}
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
              className="mt-3 w-full"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={handleWatermark}
          disabled={loading || files.length === 0}
          className="w-full rounded-md bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? "Applying…" : "Add watermark"}
        </button>
      </div>
    </ToolPageShell>
  );
}
