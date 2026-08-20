"use client";

import { useState } from "react";
import ToolPageShell from "@/components/tools/ToolPageShell";
import FileDropZone from "@/components/tools/FileDropZone";
import { useToast } from "@/components/Toast";
import { ApiError, organizePdf } from "@/lib/api";
import { downloadBlob } from "@/lib/toolDownload";

export default function OrganizePdfPage() {
  const { showToast } = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [orderText, setOrderText] = useState("");
  const [loading, setLoading] = useState(false);

  const handleOrganize = async () => {
    if (files.length === 0) {
      showToast("Add a PDF to organize.", "error");
      return;
    }
    const pageOrder = orderText
      .split(",")
      .map((p) => parseInt(p.trim(), 10))
      .filter((n) => !Number.isNaN(n));
    if (pageOrder.length === 0) {
      showToast("Enter the final page order, e.g. 3,1,2.", "error");
      return;
    }
    setLoading(true);
    try {
      const blob = await organizePdf(files[0], pageOrder);
      downloadBlob(blob, "organized.pdf");
      showToast("Organized PDF downloaded.", "success");
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Organize failed.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ToolPageShell title="Organize PDF" description="Reorder or delete pages in a PDF.">
      <div className="space-y-4">
        <FileDropZone
          files={files}
          onChange={setFiles}
          accept="application/pdf"
          acceptedTypes={["application/pdf"]}
          label="Select PDF file"
        />
        <div>
          <label className="text-sm text-slate-600 dark:text-slate-300">
            Final page order (comma-separated, e.g. <code>3,1,2</code> — omit a page number to
            delete that page)
          </label>
          <input
            type="text"
            value={orderText}
            onChange={(e) => setOrderText(e.target.value)}
            placeholder="e.g. 3,1,2"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600"
          />
        </div>
        <button
          type="button"
          onClick={handleOrganize}
          disabled={loading || files.length === 0}
          className="w-full rounded-md bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? "Organizing…" : "Organize PDF"}
        </button>
      </div>
    </ToolPageShell>
  );
}
