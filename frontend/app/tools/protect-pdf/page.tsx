"use client";

import { useState } from "react";
import ToolPageShell from "@/components/tools/ToolPageShell";
import FileDropZone from "@/components/tools/FileDropZone";
import { useToast } from "@/components/Toast";
import { ApiError, protectPdf } from "@/lib/api";
import { downloadBlob } from "@/lib/toolDownload";

export default function ProtectPdfPage() {
  const { showToast } = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleProtect = async () => {
    if (files.length === 0) {
      showToast("Add a PDF first.", "error");
      return;
    }
    if (!password) {
      showToast("Enter a password to protect this PDF with.", "error");
      return;
    }
    setLoading(true);
    try {
      const blob = await protectPdf(files[0], password);
      downloadBlob(blob, "protected.pdf");
      showToast("Protected PDF downloaded.", "success");
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Protect failed.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ToolPageShell title="Protect PDF" description="Encrypt a PDF with a password.">
      <div className="space-y-4">
        <FileDropZone
          files={files}
          onChange={setFiles}
          accept="application/pdf"
          acceptedTypes={["application/pdf"]}
          label="Select PDF file"
        />
        <div>
          <label className="text-sm text-slate-600">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <button
          type="button"
          onClick={handleProtect}
          disabled={loading || files.length === 0}
          className="w-full rounded-md bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? "Protecting…" : "Protect PDF"}
        </button>
      </div>
    </ToolPageShell>
  );
}
