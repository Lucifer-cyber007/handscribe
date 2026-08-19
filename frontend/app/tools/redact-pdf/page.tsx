"use client";

import { useState } from "react";
import ToolPageShell from "@/components/tools/ToolPageShell";
import FileDropZone from "@/components/tools/FileDropZone";
import { useToast } from "@/components/Toast";
import { ApiError, redactPdf } from "@/lib/api";
import { downloadBlob } from "@/lib/toolDownload";

export default function RedactPdfPage() {
  const { showToast } = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [terms, setTerms] = useState<string[]>([]);
  const [termInput, setTermInput] = useState("");
  const [loading, setLoading] = useState(false);

  const addTerm = () => {
    const value = termInput.trim();
    if (!value) return;
    if (!terms.includes(value)) setTerms([...terms, value]);
    setTermInput("");
  };

  const removeTerm = (term: string) => {
    setTerms(terms.filter((t) => t !== term));
  };

  const handleRedact = async () => {
    if (files.length === 0) {
      showToast("Add a PDF first.", "error");
      return;
    }
    if (terms.length === 0) {
      showToast("Add at least one word or phrase to redact.", "error");
      return;
    }
    setLoading(true);
    try {
      const blob = await redactPdf(files[0], terms);
      downloadBlob(blob, "redacted.pdf");
      showToast("Redacted PDF downloaded.", "success");
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Redaction failed.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ToolPageShell
      title="Redact PDF"
      description="Permanently remove every occurrence of specific words or phrases from a PDF — the underlying text is stripped, not just visually covered."
    >
      <div className="space-y-4">
        <FileDropZone
          files={files}
          onChange={setFiles}
          accept="application/pdf"
          acceptedTypes={["application/pdf"]}
          label="Select PDF file"
        />

        <div>
          <label className="text-sm text-slate-600">Words or phrases to redact</label>
          <div className="mt-1 flex gap-2">
            <input
              type="text"
              value={termInput}
              onChange={(e) => setTermInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTerm();
                }
              }}
              placeholder="e.g. John Smith"
              className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <button
              type="button"
              onClick={addTerm}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Add
            </button>
          </div>
          {terms.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {terms.map((term) => (
                <span
                  key={term}
                  className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700"
                >
                  {term}
                  <button
                    type="button"
                    onClick={() => removeTerm(term)}
                    aria-label={`Remove ${term}`}
                    className="font-medium text-red-500 hover:text-red-700"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleRedact}
          disabled={loading || files.length === 0 || terms.length === 0}
          className="w-full rounded-md bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? "Redacting…" : "Redact PDF"}
        </button>
      </div>
    </ToolPageShell>
  );
}
